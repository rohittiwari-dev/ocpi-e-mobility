import type { ZodIssue } from "zod";

/**
 * Base OCPI error — carries the OCPI-level status_code and status_message.
 * Thrown whenever the OCPI response envelope contains a non-1000 status code.
 */
export class OcpiError extends Error {
  public readonly statusCode: number;
  public readonly statusMessage: string;

  constructor(statusCode: number, statusMessage: string) {
    super(`OCPI ${statusCode}: ${statusMessage}`);
    this.name = "OcpiError";
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
  }
}

/**
 * HTTP-level transport error — the HTTP response itself was an error (4xx/5xx),
 * before any OCPI envelope was parsed.
 */
export class OcpiHttpError extends OcpiError {
  public readonly httpStatus: number;

  constructor(httpStatus: number, statusText: string) {
    super(httpStatus, statusText);
    this.name = "OcpiHttpError";
    this.httpStatus = httpStatus;
  }
}

/**
 * Circuit breaker is OPEN — the partner is currently considered unavailable.
 * Do not retry immediately. The circuit will probe again after `cooldownMs`.
 */
export class OcpiCircuitOpenError extends OcpiError {
  constructor(partyId: string) {
    super(
      0,
      `Circuit open for partner ${partyId}. Requests paused during cooldown.`,
    );
    this.name = "OcpiCircuitOpenError";
  }
}

/**
 * Rate limit hit — either 429 from the partner or proactive queue overflow.
 * Check `retryAfterMs` before re-attempting.
 */
export class OcpiRateLimitError extends OcpiError {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(429, `Rate limit exceeded. Retry after ${retryAfterMs}ms.`);
    this.name = "OcpiRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Discovery error — the `/versions` endpoint was unreachable or returned
 * malformed data. Re-run the credentials handshake.
 */
export class OcpiDiscoveryError extends OcpiError {
  constructor(message: string) {
    super(0, `Endpoint discovery failed: ${message}`);
    this.name = "OcpiDiscoveryError";
  }
}

/**
 * Validation error — the payload failed Zod schema validation.
 * Contains the list of Zod issues for debugging.
 */
export class OcpiValidationError extends OcpiError {
  public readonly issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    super(
      2000,
      `Schema validation failed: ${issues.map((i) => i.message).join(", ")}`,
    );
    this.name = "OcpiValidationError";
    this.issues = issues;
  }
}
