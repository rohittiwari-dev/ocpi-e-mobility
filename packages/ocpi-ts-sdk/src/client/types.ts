import type { OcpiLogger } from "../logger/index.js";

/**
 * All OCPI module identifiers — used to key endpoint discovery cache
 * and manual endpoint overrides.
 */
export type OcpiModuleId =
  | "locations"
  | "sessions"
  | "cdrs"
  | "tariffs"
  | "tokens"
  | "commands"
  | "credentials"
  | "versions"
  | "charging_profiles";

export interface OcpiClientConfig {
  /**
   * Partner's OCPI /versions endpoint URL.
   * This is the ONLY URL you need to provide — the client discovers
   * all module endpoints from here via the OCPI handshake.
   */
  versionsUrl: string;

  /**
   * Token C — received after the credentials handshake.
   * This is what you received FROM the partner to use when calling THEM.
   * (Not to be confused with the token you gave the partner.)
   */
  credentialsToken: string;

  /** Your party ID (ISO 3166 alpha-2 party, e.g. 'ABC') */
  partyId: string;

  /** Your country code ISO 3166-1 alpha-2 (e.g. 'US', 'DE') */
  countryCode: string;

  /**
   * Preferred OCPI version.
   * The actual version is negotiated with the partner during init().
   * Defaults to '2.2.1'.
   */
  version?: "2.1.1" | "2.2.1";

  /**
   * Token encoding in the Authorization header.
   * - 'base64' (default): OCPI 2.2.1-compliant — encodes token as UTF-8 Base64
   * - 'plain': For compatibility with older 2.1.1 hubs that expect raw token
   */
  tokenEncoding?: "base64" | "plain";

  /**
   * Manual endpoint URL overrides — bypass auto-discovery for specific modules.
   * Useful for non-standard partners that don't follow the versions handshake.
   * Any module NOT listed here will use the auto-discovered URL from init().
   */
  endpoints?: Partial<Record<OcpiModuleId, string>>;

  /** Max retries for 429/5xx responses (default: 3) */
  retries?: number;

  /** Per-request timeout in milliseconds (default: 10_000) */
  timeoutMs?: number;

  /**
   * Circuit breaker config — prevents retry storms when a partner hub is down.
   * After `failureThreshold` consecutive failures, the circuit trips to OPEN.
   * Requests are rejected immediately until `cooldownMs` has elapsed.
   */
  circuitBreaker?: {
    /** Number of consecutive failures before tripping (default: 5) */
    failureThreshold?: number;
    /** Cooldown period in ms before probing recovery (default: 30_000) */
    cooldownMs?: number;
  };

  /**
   * TTL for the endpoint discovery cache in milliseconds.
   * After this period, the next call to resolveEndpoint() will re-discover.
   * Default: 3_600_000 (1 hour)
   */
  discoveryTtlMs?: number;

  /**
   * Logger configuration.
   * - enabled: false → completely silent (default: true)
   * - logger: any voltlog-io / pino / winston compatible logger instance
   *   If logger.child() is available, the SDK creates a scoped child logger
   *   with { partner: partyId, countryCode } context automatically.
   * - If omitted entirely, defaults to a console-based logger.
   */
  logging?: {
    enabled?: boolean;
    logger?: OcpiLogger;
  };

  /**
   * Optional tenant identifier — used by OcpiClientRegistry for labeling.
   * Has no effect on the client's network behaviour.
   */
  tenantId?: string;
}

// Re-export remaining shared header/response types

export interface OcpiHeaders {
  "X-Limit-Remaining"?: string;
  "X-Total-Count"?: string;
  "X-Limit"?: string;
  "X-Request-ID": string;
  "X-Correlation-ID": string;
  "OCPI-from-party-id"?: string;
  "OCPI-from-country-code"?: string;
}

export interface OcpiResponse<T> {
  data: T;
  status_code: number;
  status_message?: string;
  timestamp: string;
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
  date_from?: string;
  date_to?: string;
}
