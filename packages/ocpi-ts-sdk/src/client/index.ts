import { EventEmitter } from "node:events";
import { type OcpiLogger, resolveLogger } from "../logger/index.js";
import { OcpiCdrsModule } from "../modules/cdrs.js";
import { OcpiCommandsModule } from "../modules/commands.js";
import { OcpiCredentialsModule } from "../modules/credentials.js";
// Module imports — each module class is wired to this client
import { OcpiLocationsModule } from "../modules/locations.js";
import { OcpiSessionsModule } from "../modules/sessions.js";
import { OcpiTariffsModule } from "../modules/tariffs.js";
import { OcpiTokensModule } from "../modules/tokens.js";
import { OcpiResponseSchema } from "../schemas/common.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import {
  OcpiCircuitOpenError,
  OcpiDiscoveryError,
  OcpiError,
  OcpiHttpError,
  OcpiRateLimitError,
} from "./errors.js";
import { OcpiPagination } from "./pagination.js";
import { PartnerRateLimiter } from "./rate-limiter.js";
import type { OcpiClientConfig, OcpiModuleId } from "./types.js";

export {
  OcpiLocationsModule,
  OcpiSessionsModule,
  OcpiCdrsModule,
  OcpiTariffsModule,
  OcpiTokensModule,
  OcpiCommandsModule,
  OcpiCredentialsModule,
};
export * from "./errors.js";
export * from "./pagination.js";
export * from "./types.js";

interface EndpointCacheEntry {
  url: string;
  expiresAt: number;
}

export interface FetchOptions extends RequestInit {
  /** Idempotency key — sent as Idempotency-Key header (prevents double-push on retries) */
  idempotencyKey?: string;
  /** Skip circuit breaker check — for credential handshake probes only */
  skipCircuitBreaker?: boolean;
}

/**
 * OCPIClient — the main entry point for the ocpi-ts-sdk.
 *
 * Features:
 * - OCPI 2.2.1 + 2.1.1 compatible (Base64 or plain token encoding)
 * - Dynamic endpoint discovery via /versions handshake (with TTL cache)
 * - Auto-wired module access: partner.locations, partner.sessions, etc.
 * - Circuit breaker per partner connection
 * - Proactive rate-limit handling
 * - Async generator streaming for large datasets (no OOM)
 * - Idempotency keys for CDR/Session push
 * - EventEmitter for observability hooks
 * - voltlog-io / pino / winston logger support (console default)
 */
export class OCPIClient extends EventEmitter {
  // ── Auto-wired module access ─────────────────────────────────────────────
  public readonly locations: OcpiLocationsModule;
  public readonly sessions: OcpiSessionsModule;
  public readonly cdrs: OcpiCdrsModule;
  public readonly tariffs: OcpiTariffsModule;
  public readonly tokens: OcpiTokensModule;
  public readonly commands: OcpiCommandsModule;
  public readonly credentials: OcpiCredentialsModule;

  // ── Internal infrastructure ─────────────────────────────────────────────
  public readonly pagination: OcpiPagination;
  private readonly _log: OcpiLogger;
  private readonly _circuit: CircuitBreaker;
  private readonly _limiter: PartnerRateLimiter;
  private readonly _endpointCache = new Map<string, EndpointCacheEntry>();
  private readonly _encodedToken: string;

  constructor(public readonly config: OcpiClientConfig) {
    super();

    // Wire all modules — user accesses via partner.locations, partner.sessions, etc.
    this.locations = new OcpiLocationsModule(this);
    this.sessions = new OcpiSessionsModule(this);
    this.cdrs = new OcpiCdrsModule(this);
    this.tariffs = new OcpiTariffsModule(this);
    this.tokens = new OcpiTokensModule(this);
    this.commands = new OcpiCommandsModule(this);
    this.credentials = new OcpiCredentialsModule(this);
    this.pagination = new OcpiPagination(this);

    // Logger — creates a scoped child logger if the logger supports child()
    this._log = resolveLogger(config.logging, {
      partner: config.partyId,
      countryCode: config.countryCode,
      ...(config.tenantId ? { tenantId: config.tenantId } : {}),
    });

    // Circuit breaker — emits events for monitoring
    this._circuit = new CircuitBreaker(config.circuitBreaker, (state) => {
      if (state === "OPEN") {
        this._log.warn("Circuit opened — partner requests paused", {
          failureThreshold: config.circuitBreaker?.failureThreshold ?? 5,
        });
        this.emit("circuitOpen");
      } else if (state === "CLOSED") {
        this._log.info("Circuit recovered — resuming partner requests");
        this.emit("circuitClose");
      }
    });

    this._limiter = new PartnerRateLimiter();

    // Encode token once at construction time
    // OCPI 2.2.1 requires Base64-encoded token. 2.1.1 compat hubs expect plain.
    const encoding = config.tokenEncoding ?? "base64";
    this._encodedToken =
      encoding === "base64"
        ? Buffer.from(config.credentialsToken, "utf-8").toString("base64")
        : config.credentialsToken;
  }

  // ── Endpoint Discovery ───────────────────────────────────────────────────

  /**
   * Runs the OCPI version negotiation handshake once at startup.
   * 1. GET versionsUrl → list of supported versions
   * 2. Find highest mutually-supported version
   * 3. GET that version's detail URL → get module endpoint URLs
   * 4. Cache all endpoint URLs with TTL
   *
   * Call this once before using any module methods.
   */
  async init(): Promise<this> {
    this._log.info("Starting OCPI endpoint discovery", {
      versionsUrl: this.config.versionsUrl,
    });

    try {
      // Step 1: fetch versions list
      const versionsRes = await fetch(this.config.versionsUrl, {
        headers: this._buildRawHeaders(),
      });

      if (!versionsRes.ok) {
        throw new OcpiDiscoveryError(
          `Versions endpoint returned HTTP ${versionsRes.status}`,
        );
      }

      const versionsEnvelope = OcpiResponseSchema.parse(
        await versionsRes.json(),
      );
      if (versionsEnvelope.status_code !== 1000) {
        throw new OcpiDiscoveryError(
          `Versions endpoint OCPI error ${versionsEnvelope.status_code}`,
        );
      }

      const versions = versionsEnvelope.data as Array<{
        version: string;
        url: string;
      }>;

      // Step 2: find best matching version
      const preferred = this.config.version ?? "2.2.1";
      const match =
        versions.find((v) => v.version === preferred) ??
        versions[versions.length - 1];

      if (!match) {
        throw new OcpiDiscoveryError("Partner returned empty versions list");
      }

      // Step 3: fetch version detail to get module endpoint URLs
      const detailRes = await fetch(match.url, {
        headers: this._buildRawHeaders(),
      });

      if (!detailRes.ok) {
        throw new OcpiDiscoveryError(
          `Version detail endpoint returned HTTP ${detailRes.status}`,
        );
      }

      const detailEnvelope = OcpiResponseSchema.parse(await detailRes.json());
      if (detailEnvelope.status_code !== 1000) {
        throw new OcpiDiscoveryError(
          `Version detail OCPI error ${detailEnvelope.status_code}`,
        );
      }

      const detail = detailEnvelope.data as {
        version: string;
        endpoints: Array<{ identifier: string; role: string; url: string }>;
      };

      // Step 4: cache endpoints with TTL
      const ttl = this.config.discoveryTtlMs ?? 3_600_000;
      const expiresAt = Date.now() + ttl;

      for (const ep of detail.endpoints) {
        this._endpointCache.set(ep.identifier, { url: ep.url, expiresAt });
      }

      this._log.info("OCPI endpoint discovery complete", {
        version: detail.version,
        modules: detail.endpoints.map((e) => e.identifier),
      });
      this.emit("discoveryComplete", {
        version: detail.version,
        modules: detail.endpoints.map((e) => e.identifier),
      });
    } catch (err) {
      if (err instanceof OcpiDiscoveryError) throw err;
      throw new OcpiDiscoveryError(
        err instanceof Error ? err.message : String(err),
      );
    }

    return this;
  }

  /**
   * Returns the resolved URL for a module.
   * Priority order:
   * 1. Manual override from config.endpoints
   * 2. Discovery cache (if not expired)
   * 3. Throws OcpiDiscoveryError (call init() first)
   */
  resolveEndpoint(module: OcpiModuleId): string {
    // Manual override takes priority
    if (this.config.endpoints?.[module]) {
      return this.config.endpoints[module] as string;
    }

    // Check discovery cache
    const cached = this._endpointCache.get(module);
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        return cached.url;
      }
      // Expired — remove and fall through to error
      this._endpointCache.delete(module);
      this._log.debug("Endpoint cache expired, re-discovery needed", {
        module,
      });
    }

    throw new OcpiDiscoveryError(
      `No endpoint URL for module '${module}'. Call partner.init() first, or provide config.endpoints.${module}.`,
    );
  }

  // ── Core HTTP Client ─────────────────────────────────────────────────────

  /**
   * Core authenticated fetch with:
   * - Circuit breaker check
   * - Proactive rate-limit queue
   * - OCPI envelope validation (Zod)
   * - Correct error code mapping (1000=ok, 2xxx/3xxx=OcpiError)
   * - Retry on 429/5xx with exponential backoff
   * - Idempotency-Key header support
   */
  public async fetch<T>(
    url: string,
    options: FetchOptions = {},
  ): Promise<{ data: T; headers: Headers }> {
    const { idempotencyKey, skipCircuitBreaker, ...fetchInit } = options;

    // Circuit breaker check
    if (!skipCircuitBreaker && !this._circuit.canAttempt()) {
      this._log.warn("Circuit is OPEN — request rejected", { url });
      throw new OcpiCircuitOpenError(this.config.partyId);
    }

    // Proactive rate limit queue
    if (this._limiter.isLimited()) {
      this._log.debug("Rate limited — waiting for reset", { url });
      await this._limiter.waitForSlot();
    }

    const headers = this._buildRawHeaders(
      fetchInit.headers as Record<string, string>,
    );
    if (idempotencyKey) {
      headers.set("Idempotency-Key", idempotencyKey);
    }

    const maxRetries = this.config.retries ?? 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs ?? 10_000,
        );

        let response: Response;
        try {
          response = await fetch(url, {
            ...fetchInit,
            headers,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        // Update rate limiter from response headers
        this._limiter.updateFromHeaders(response.headers);
        if (this._limiter.isNearLimit()) {
          this._log.warn("Rate limit approaching", {
            remaining: this._limiter.getRemainingCount(),
          });
          this.emit("rateLimitWarning");
        }

        // Retry on 429
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const delayMs = retryAfter
            ? Number.parseInt(retryAfter, 10) * 1000
            : 2000 * attempt;

          if (attempt > maxRetries) {
            this._circuit.recordFailure();
            throw new OcpiRateLimitError(delayMs);
          }
          this._log.debug("429 rate limited — retrying", {
            attempt,
            delayMs,
            url,
          });
          this.emit("retryAttempt", { attempt, url, delayMs });
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        // Retry on 5xx server errors
        if (response.status >= 500) {
          if (attempt > maxRetries) {
            this._circuit.recordFailure();
            throw new OcpiHttpError(response.status, response.statusText);
          }
          const delayMs = 1000 * attempt;
          this._log.debug("5xx error — retrying", {
            attempt,
            status: response.status,
            url,
          });
          this.emit("retryAttempt", { attempt, url, delayMs });
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        // Non-retryable HTTP error (4xx except 429)
        if (!response.ok) {
          this._circuit.recordFailure();
          throw new OcpiHttpError(response.status, response.statusText);
        }

        // Parse and validate OCPI response envelope
        let json: unknown;
        try {
          json = await response.json();
        } catch {
          this._circuit.recordFailure();
          throw new OcpiHttpError(
            response.status,
            "Response body is not valid JSON",
          );
        }

        const envelope = OcpiResponseSchema.parse(json);

        // Only 1000 is success per OCPI spec — 2xxx/3xxx are errors
        if (envelope.status_code !== 1000) {
          this._circuit.recordFailure();
          throw new OcpiError(
            envelope.status_code,
            envelope.status_message ?? "OCPI error",
          );
        }

        this._circuit.recordSuccess();
        return { data: envelope.data as T, headers: response.headers };
      } catch (err) {
        // Re-throw our own typed errors immediately — don't retry
        if (
          err instanceof OcpiError ||
          err instanceof OcpiHttpError ||
          err instanceof OcpiRateLimitError ||
          err instanceof OcpiCircuitOpenError
        ) {
          throw err;
        }

        // Network/timeout errors — retry
        if (attempt > maxRetries) {
          this._circuit.recordFailure();
          this.emit("requestError", { url, error: err, attempt });
          throw err;
        }
        const delayMs = 1000 * attempt;
        this._log.debug("Network error — retrying", {
          attempt,
          url,
          error: err instanceof Error ? err.message : String(err),
        });
        this.emit("retryAttempt", { attempt, url, delayMs });
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    throw new Error("Unreachable");
  }

  // ── HTTP Verb Helpers ────────────────────────────────────────────────────

  public async get<T>(
    url: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<{ data: T; headers: Headers }> {
    const params = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) params.set(k, String(v));
      }
    }
    const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
    return this.fetch<T>(fullUrl, { method: "GET" });
  }

  public async put<T>(
    url: string,
    body: unknown,
    opts?: { idempotencyKey?: string },
  ): Promise<{ data: T; headers: Headers }> {
    return this.fetch<T>(url, {
      method: "PUT",
      body: JSON.stringify(body),
      idempotencyKey: opts?.idempotencyKey,
    });
  }

  public async patch<T>(
    url: string,
    body: unknown,
  ): Promise<{ data: T; headers: Headers }> {
    return this.fetch<T>(url, { method: "PATCH", body: JSON.stringify(body) });
  }

  public async post<T>(
    url: string,
    body: unknown,
    opts?: { idempotencyKey?: string },
  ): Promise<{ data: T; headers: Headers }> {
    return this.fetch<T>(url, {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey: opts?.idempotencyKey,
    });
  }

  public async delete<T>(url: string): Promise<{ data: T; headers: Headers }> {
    return this.fetch<T>(url, { method: "DELETE" });
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private _buildRawHeaders(customHeaders?: Record<string, string>): Headers {
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Token ${this._encodedToken}`,
      "X-Request-ID": crypto.randomUUID(),
      "X-Correlation-ID": crypto.randomUUID(),
    });

    headers.set("OCPI-from-party-id", this.config.partyId);
    headers.set("OCPI-from-country-code", this.config.countryCode);
    if (this.config.version) {
      headers.set("OCPI-from-version", this.config.version);
    }

    if (customHeaders) {
      for (const [k, v] of Object.entries(customHeaders)) headers.set(k, v);
    }

    return headers;
  }
}
