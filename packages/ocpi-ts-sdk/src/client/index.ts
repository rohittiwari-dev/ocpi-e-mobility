export * from "./pagination.js";
export * from "./rate-limit.js";
export * from "./types.js";

import { OcpiPagination } from "./pagination.js";
import { RateLimitTracker } from "./rate-limit.js";
import type { OcpiClientConfig } from "./types.js";

export class OcpiClient {
  public pagination: OcpiPagination;
  public rateLimit: RateLimitTracker;

  constructor(private readonly config: OcpiClientConfig) {
    this.pagination = new OcpiPagination(this);
    this.rateLimit = new RateLimitTracker();
  }

  /**
   * Helper to build properly authenticated JSON headers for OCPI calls.
   */
  private buildHeaders(customHeaders?: Record<string, string>): Headers {
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Token ${this.config.token}`,
      "X-Request-ID": crypto.randomUUID(),
      "X-Correlation-ID": crypto.randomUUID(),
    });

    if (this.config.partyId) {
      headers.set("OCPI-from-party-id", this.config.partyId);
    }
    if (this.config.countryCode) {
      headers.set("OCPI-from-country-code", this.config.countryCode);
    }
    if (this.config.version) {
      headers.set("OCPI-from-version", this.config.version);
    }

    if (customHeaders) {
      for (const [k, v] of Object.entries(customHeaders)) {
        headers.set(k, v);
      }
    }

    return headers;
  }

  /**
   * Core generic fetch with built-in retries (429/5xx).
   */
  public async fetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<{ data: T; headers: Headers }> {
    const url = new URL(path, this.config.baseUrl).toString();
    const headers = this.buildHeaders(
      options.headers as Record<string, string>,
    );
    let attempt = 0;
    const maxRetries = this.config.retries ?? 3;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const response = await fetch(url, { ...options, headers });

        // Track rate limits on every response
        this.rateLimit.updateFromResponse(response.headers);

        if (response.ok) {
          const json = await response.json();
          // OCPI responses wrap data in a generic envelope usually `{ data, status_code, status_message }`
          if (json.status_code === 1000) {
            return { data: json.data as T, headers: response.headers };
          }
          // Some custom 2xxx codes are still "success" structurally but require app handling
          if (json.status_code >= 2000 && json.status_code < 3000) {
            return { data: json.data as T, headers: response.headers };
          }
          throw new Error(
            `OCPI Application Error ${json.status_code}: ${json.status_message}`,
          );
        }

        // Retry on 429 Too Many Requests
        if (response.status === 429) {
          if (attempt > maxRetries)
            throw new Error("Rate limit exceeded (Max retries reached)");
          const retryAfter = response.headers.get("Retry-After");
          const delayMs = retryAfter
            ? Number.parseInt(retryAfter, 10) * 1000
            : 2000 * attempt;
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        // Retry on temporary server errors
        if (response.status >= 500) {
          if (attempt > maxRetries) throw new Error(`HTTP ${response.status}`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }

        // Unrecoverable HTTP error
        throw new Error(`HTTP Error ${response.status} ${response.statusText}`);
      } catch (err) {
        if (attempt > maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    throw new Error("Unreachable");
  }

  // --- CRUD Helpers ---

  public async get<T>(
    path: string,
    query?: Record<string, string>,
  ): Promise<{ data: T; headers: Headers }> {
    const searchParams = new URLSearchParams(query);
    const fullPath =
      query && searchParams.toString()
        ? `${path}?${searchParams.toString()}`
        : path;
    return this.fetch<T>(fullPath, { method: "GET" });
  }

  public async put<T>(
    path: string,
    body: unknown,
  ): Promise<{ data: T; headers: Headers }> {
    return this.fetch<T>(path, { method: "PUT", body: JSON.stringify(body) });
  }

  public async patch<T>(
    path: string,
    body: unknown,
  ): Promise<{ data: T; headers: Headers }> {
    return this.fetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  public async post<T>(
    path: string,
    body: unknown,
  ): Promise<{ data: T; headers: Headers }> {
    return this.fetch<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  public async delete<T>(path: string): Promise<{ data: T; headers: Headers }> {
    return this.fetch<T>(path, { method: "DELETE" });
  }
}
