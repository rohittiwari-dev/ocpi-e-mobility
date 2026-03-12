import type { OcpiLogger } from "../logger/index.js";

/** Info about an authenticated OCPI partner (resolved from tokenAuth) */
export interface OcpiPartner {
  /** The partner's party ID */
  partyId: string;
  /** The partner's country code */
  countryCode: string;
  /** Optional tenant identifier (for multi-tenant SaaS) */
  tenantId?: string;
  /** Any additional partner metadata you want to attach */
  [key: string]: unknown;
}

/** Context passed to every OCPI handler */
export interface OcpiRouterContext {
  /** Resolved partner from tokenAuth */
  partner: OcpiPartner;
  /** Tenant ID — present when :tenantId is in the prefix */
  tenantId?: string;
  /** Negotiated OCPI version */
  version: string;
  /** X-Request-ID from the incoming request */
  requestId: string;
  /** X-Correlation-ID from the incoming request */
  correlationId: string;
  /** OCPI module being accessed (e.g. 'locations', 'sessions') */
  module: string;
  /** HTTP method */
  method: string;
  /** URL params extracted from the path (locationId, evseUid, etc.) */
  params: Record<string, string>;
}

/** Success result from an OCPI handler */
export interface OcpiHandlerSuccess {
  status_code: 1000;
  data?: unknown;
}

/** Error result from an OCPI handler */
export interface OcpiHandlerError {
  status_code: number;
  status_message: string;
}

export type OcpiHandlerResult = OcpiHandlerSuccess | OcpiHandlerError;

/** Typed handler function — receives validated data and context */
export type OcpiHandler<T> = (
  data: T,
  ctx: OcpiRouterContext,
) => Promise<OcpiHandlerResult>;

/** Config for OCPIRouter */
export interface OcpiRouterConfig {
  /**
   * URL path prefix.
   * Use :tenantId for SaaS path-based tenancy.
   * Examples:
   *   '/ocpi'            → single-tenant
   *   '/ocpi/:tenantId'  → multi-tenant SaaS
   */
  prefix?: string;

  /** OCPI version this router handles */
  version: "2.2.1" | "2.1.1";

  /**
   * Validate the Authorization: Token header.
   * Return OcpiPartner if valid, null → 401 Unauthorized.
   * tenantId is passed when :tenantId is in the prefix.
   */
  tokenAuth: (token: string, tenantId?: string) => Promise<OcpiPartner | null>;

  /**
   * Optional fine-grained authorization.
   * Return false → 403 Forbidden.
   */
  authorize?: (
    partner: OcpiPartner,
    module: string,
    method: string,
  ) => boolean | Promise<boolean>;

  /** Error handler (called before returning 500 response) */
  onError?: (err: Error, ctx: Partial<OcpiRouterContext>) => void;

  /** Logger config */
  logging?: { enabled?: boolean; logger?: OcpiLogger };

  /** Your versions URL — returned in credentials responses */
  versionsUrl?: string;

  /**
   * Called during credential registration (POST /credentials).
   * Return your credentials to complete the handshake.
   */
  onRegister?: (
    credentials: { token: string; url: string; roles: unknown[] },
    ctx: OcpiRouterContext,
  ) => Promise<{ url: string; token: string; roles: unknown[] }>;

  /**
   * Defines how strict the router should be when validating incoming payloads.
   * - "strict-2.2.1" (default): Fails request with HTTP 400 (OCPI 2001) if payload misses required 2.2.1 fields.
   * - "lenient": Logs a warning but allows the payload to pass through (useful for older 2.1.1 partners).
   */
  schemaValidation?: "strict-2.2.1" | "lenient";

  /**
   * Router behavior mode.
   * - "ENDPOINT" (default): Executes local event handlers (e.g., location:put)
   * - "HUB": Acts as an OCPI proxy. If the OCPI-to-party-id header is present,
   *   it looks up the destination partner and proxies the HTTP request seamlessly.
   */
  mode?: "ENDPOINT" | "HUB";

  /**
   * Required when mode === "HUB".
   * Given the incoming HTTP headers (OCPI-to-party-id and OCPI-to-country-code) and the authenticated sender,
   * resolve the destination partner's base URL and credentials token.
   * Return null if the destination is unknown or unauthorized.
   */
  resolveHubDestination?: (
    sender: OcpiPartner,
    toCountryCode: string,
    toPartyId: string,
  ) => Promise<{ baseUrl: string; token: string } | null>;
}
