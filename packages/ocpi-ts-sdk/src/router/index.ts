import type { IncomingMessage, ServerResponse } from "node:http";
import type { OcpiLogger } from "../logger/index.js";
import { resolveLogger } from "../logger/index.js";
import type {
  OcpiHandlerResult,
  OcpiPartner,
  OcpiRouterConfig,
  OcpiRouterContext,
} from "./context.js";
import type { RouterEvent, RouterEventMap } from "./events.js";
import { EventSchemaMap } from "./schemas.js";

/**
 * OCPIRouter — Framework-agnostic OCPI receiver.
 *
 * Core is built on Web Standard Request → Response (Fetch API).
 * Works natively in: Bun, Cloudflare Workers, Deno, Hono.
 * Framework adapters available: .express(), .fastify(), .node()
 *
 * @example Single-tenant
 * const router = new OCPIRouter({
 *   version: '2.2.1',
 *   tokenAuth: async (token) => db.partners.findByToken(token),
 * });
 * router.on('location:put', async (location, ctx) => {
 *   await db.locations.upsert(location);
 *   return { status_code: 1000 };
 * });
 *
 * @example Multi-tenant SaaS
 * const router = new OCPIRouter({
 *   prefix: '/ocpi/:tenantId',
 *   version: '2.2.1',
 *   tokenAuth: async (token, tenantId) =>
 *     db.partners.findByTokenAndTenant(token, tenantId),
 * });
 */
export class OCPIRouter {
  private readonly handlers = new Map<
    RouterEvent,
    (data: unknown, ctx: OcpiRouterContext) => Promise<OcpiHandlerResult>
  >();
  private readonly _log: OcpiLogger;
  private readonly prefix: string;

  constructor(private readonly config: OcpiRouterConfig) {
    this.prefix = config.prefix ?? "/ocpi";
    this._log = resolveLogger(config.logging, { component: "OCPIRouter" });
  }

  on<E extends RouterEvent>(event: E, handler: RouterEventMap[E]): this {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.handlers.set(event, handler as any);
    return this;
  }

  /**
   * Web Standard handle() — works in Bun, CF Workers, Deno, Hono.
   * Fully self-contained: auth → route → validate → dispatch → respond.
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    const requestId =
      request.headers.get("X-Request-ID") ?? crypto.randomUUID();
    const correlationId =
      request.headers.get("X-Correlation-ID") ?? crypto.randomUUID();

    // Extract token from Authorization: Token <encoded>
    const authHeader = request.headers.get("Authorization") ?? "";
    const rawToken = authHeader.startsWith("Token ")
      ? authHeader.slice(6).trim()
      : null;

    if (!rawToken) {
      return this._errorResponse(
        2010,
        "Missing Authorization header",
        requestId,
        correlationId,
        401,
      );
    }

    // Extract tenantId from path if :tenantId is in prefix
    const { tenantId, basePath } = this._extractTenantId(pathname);

    // Decode token (may be Base64 or plain depending on partner version)
    let decodedToken: string;
    try {
      decodedToken = Buffer.from(rawToken, "base64").toString("utf-8");
    } catch {
      decodedToken = rawToken; // plain token fallback
    }

    // Authenticate
    let partner: OcpiPartner | null = null;
    try {
      partner = await this.config.tokenAuth(decodedToken, tenantId);
      // Also try raw token if base64-decoded fails auth
      if (!partner && decodedToken !== rawToken) {
        partner = await this.config.tokenAuth(rawToken, tenantId);
      }
    } catch (err) {
      this._log.error(
        "tokenAuth threw",
        err instanceof Error ? err : { error: String(err) },
      );
      return this._errorResponse(
        3000,
        "Internal Server Error",
        requestId,
        correlationId,
        500,
      );
    }

    if (!partner) {
      return this._errorResponse(
        2010,
        "Unknown or invalid token",
        requestId,
        correlationId,
        401,
      );
    }

    // Route the request
    const { event, params, module } = this._route(
      method,
      basePath,
      this.config.version,
    );

    if (!event) {
      return this._errorResponse(
        2000,
        `No route for ${method} ${basePath}`,
        requestId,
        correlationId,
        404,
      );
    }

    // Authorization check
    if (this.config.authorize) {
      const allowed = await this.config.authorize(partner, module, method);
      if (!allowed) {
        return this._errorResponse(
          2010,
          "Not authorized",
          requestId,
          correlationId,
          403,
        );
      }
    }

    const ctx: OcpiRouterContext = {
      partner,
      tenantId,
      version: this.config.version,
      requestId,
      correlationId,
      module,
      method,
      params,
    };

    // === HUB PROXY MODE ===
    // If router is configured as a HUB, we proxy everything EXCEPT the credentials module
    if (this.config.mode === "HUB" && module !== "credentials") {
      const toCountryCode = request.headers.get("OCPI-to-country-code");
      const toPartyId = request.headers.get("OCPI-to-party-id");

      if (!toCountryCode || !toPartyId) {
        return this._errorResponse(
          2001,
          "Missing OCPI-to-country-code or OCPI-to-party-id for HUB routing",
          requestId,
          correlationId,
          400,
        );
      }

      if (!this.config.resolveHubDestination) {
        return this._errorResponse(
          3000,
          "Hub routing is not properly configured (missing resolveHubDestination)",
          requestId,
          correlationId,
          500,
        );
      }

      const destination = await this.config.resolveHubDestination(
        partner,
        toCountryCode,
        toPartyId,
      );

      if (!destination) {
        return this._errorResponse(
          2000,
          `Unknown destination party ${toCountryCode}-${toPartyId}`,
          requestId,
          correlationId,
          404,
        );
      }

      const proxyUrl = destination.baseUrl.replace(/\/$/, "") + basePath;
      const proxyHeaders = new Headers(request.headers);

      // Pass our credentials to the destination
      proxyHeaders.set(
        "Authorization",
        `Token ${Buffer.from(destination.token).toString("base64")}`,
      );

      // Remove host so fetch() generates it naturally from proxyUrl
      proxyHeaders.delete("host");

      const proxyReq = new Request(proxyUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : await request.clone().arrayBuffer(),
      });

      try {
        return await fetch(proxyReq);
      } catch (err) {
        this._log.error(
          `Hub Proxy Error forwarding to ${proxyUrl}`,
          err instanceof Error ? err : { error: String(err) },
        );
        return this._errorResponse(
          3000,
          "Hub proxy failed to reach destination",
          requestId,
          correlationId,
          502,
        );
      }
    }
    // === END HUB PROXY MODE ===

    // Dispatch to handler
    const handler = this.handlers.get(event);
    if (!handler) {
      // No handler registered — return 404 with OCPI code
      return this._errorResponse(
        2000,
        `No handler registered for ${event}`,
        requestId,
        correlationId,
        404,
      );
    }

    // Parse body
    let body: unknown;
    if (["PUT", "POST", "PATCH"].includes(method)) {
      try {
        body = await request.json();
      } catch {
        return this._errorResponse(
          2000,
          "Invalid JSON body",
          requestId,
          correlationId,
          400,
        );
      }

      // Validate payload via Zod schemas
      const schema = EventSchemaMap[event];
      if (schema) {
        const validation = schema.safeParse(body);
        if (!validation.success) {
          if (this.config.schemaValidation === "lenient") {
            this._log.warn(
              `Lenient validation bypassed schema errors for ${event}`,
              {
                issues: validation.error.issues,
              },
            );
          } else {
            const missing = validation.error.issues
              .map((issue) => `${issue.path.join(".")} (${issue.message})`)
              .join(", ");
            return this._errorResponse(
              2001,
              `Invalid payload: ${missing}`,
              requestId,
              correlationId,
              400, // Returning HTTP 400 Bad Request, but OCPI Status 2001 for invalid parameters
            );
          }
        } else {
          body = validation.data; // Strip unknown properties and enforce defaults
        }
      }
    }

    let result: OcpiHandlerResult;
    try {
      result = (await handler(body, ctx)) as OcpiHandlerResult;
    } catch (err) {
      this._log.error(
        `Handler error for ${event}`,
        err instanceof Error ? err : { error: String(err) },
      );
      this.config.onError?.(
        err instanceof Error ? err : new Error(String(err)),
        ctx,
      );
      return this._errorResponse(
        3000,
        "Internal Server Error",
        requestId,
        correlationId,
        500,
      );
    }

    const responseBody = {
      status_code: result.status_code,
      status_message:
        result.status_code === 1000
          ? "OK"
          : (result as { status_message: string }).status_message,
      data: (result as { data?: unknown }).data ?? null,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(responseBody), {
      status: result.status_code === 1000 ? 200 : 400,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        "X-Correlation-ID": correlationId,
      },
    });
  }

  /**
   * Express/Connect middleware adapter.
   *
   * @example
   * app.use(router.express());
   */
  express() {
    return async (
      req: IncomingMessage & { body?: unknown; originalUrl?: string },
      res: ServerResponse,
      next: () => void,
    ) => {
      const prefix = this.prefix.replace(/:tenantId/g, "[^/]+");
      const prefixRegex = new RegExp(`^${prefix}`);
      const url = req.originalUrl ?? (req as { url?: string }).url ?? "/";

      if (!prefixRegex.test(url)) return next();

      const body = JSON.stringify(req.body ?? {});
      const fullUrl = `http://localhost${url}`;

      const webRequest = new Request(fullUrl, {
        method: req.method ?? "GET",
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, String(v)]),
        ),
        body: ["PUT", "POST", "PATCH"].includes(req.method ?? "")
          ? body
          : undefined,
      });

      const webResponse = await this.handle(webRequest);
      const responseBody = await webResponse.text();

      res.statusCode = webResponse.status;
      webResponse.headers.forEach((v: string, k: string) => {
        res.setHeader(k, v);
      });
      res.setHeader("Content-Type", "application/json");
      res.end(responseBody);
    };
  }

  /**
   * Fetch handler — for Bun.serve, CF Workers, Hono, Vercel Edge.
   *
   * @example Bun
   * Bun.serve({ fetch: router.fetch() });
   *
   * @example Cloudflare Workers
   * export default { fetch: router.fetch() };
   */
  fetch() {
    return (req: Request): Promise<Response> => this.handle(req);
  }

  /**
   * Raw Node.js http.createServer handler.
   *
   * @example
   * http.createServer(router.node()).listen(3000);
   */
  node() {
    return async (req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve) => {
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", resolve);
      });

      const body = Buffer.concat(chunks).toString();
      const fullUrl = `http://localhost${req.url ?? "/"}`;

      const webRequest = new Request(fullUrl, {
        method: req.method ?? "GET",
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, String(v)]),
        ),
        body:
          ["PUT", "POST", "PATCH"].includes(req.method ?? "") && body
            ? body
            : undefined,
      });

      const webResponse = await this.handle(webRequest);
      const responseBody = await webResponse.text();

      res.statusCode = webResponse.status;
      webResponse.headers.forEach((v: string, k: string) => {
        res.setHeader(k, v);
      });
      res.end(responseBody);
    };
  }

  // ── Internal routing ─────────────────────────────────────────────────────

  private _extractTenantId(pathname: string): {
    tenantId?: string;
    basePath: string;
  } {
    const prefixParts = this.prefix.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);

    let tenantId: string | undefined;
    let matchedParts = 0;

    for (let i = 0; i < prefixParts.length; i++) {
      if (prefixParts[i] === ":tenantId") {
        tenantId = pathParts[i];
        matchedParts++;
      } else if (prefixParts[i] === pathParts[i]) {
        matchedParts++;
      }
    }

    const basePath = `/${pathParts.slice(matchedParts).join("/")}`;

    return { tenantId, basePath };
  }

  private _route(
    method: string,
    basePath: string,
    version: string,
  ): {
    event: RouterEvent | null;
    params: Record<string, string>;
    module: string;
  } {
    const noResult = { event: null, params: {}, module: "" };

    // Pattern: /receiver/2.2.1/locations[/:cc/:pid/:locId[/:evseUid[/:connId]]]
    // Pattern: /sender/2.2.1/locations (for CPO pulling from itself, uncommon)
    const segments = basePath.split("/").filter(Boolean);
    // segments: [receiver|sender, ver, module, ...params]

    if (segments.length < 3) return noResult;
    const [, ver, mod, ...rest] = segments;

    if (ver !== version) return noResult;

    const params: Record<string, string> = {};
    const module = mod;

    if (mod === "locations") {
      if (rest.length === 3) {
        [params.countryCode, params.partyId, params.locationId] = rest;
        const event =
          method === "PUT"
            ? "location:put"
            : method === "PATCH"
              ? "location:patch"
              : method === "DELETE"
                ? "location:delete"
                : null;
        return { event: event as RouterEvent, params, module };
      }
      if (rest.length === 4) {
        [
          params.countryCode,
          params.partyId,
          params.locationId,
          params.evseUid,
        ] = rest;
        const event =
          method === "PUT"
            ? "evse:put"
            : method === "PATCH"
              ? "evse:patch"
              : null;
        return { event: event as RouterEvent, params, module };
      }
      if (rest.length === 5) {
        [
          params.countryCode,
          params.partyId,
          params.locationId,
          params.evseUid,
          params.connectorId,
        ] = rest;
        const event =
          method === "PUT"
            ? "connector:put"
            : method === "PATCH"
              ? "connector:patch"
              : null;
        return { event: event as RouterEvent, params, module };
      }
    }

    if (mod === "sessions") {
      if (rest.length >= 3) {
        [params.countryCode, params.partyId, params.sessionId] = rest;
        const event =
          method === "PUT"
            ? "session:put"
            : method === "PATCH"
              ? "session:patch"
              : null;
        return { event: event as RouterEvent, params, module };
      }
    }

    if (mod === "cdrs") {
      const event = method === "POST" ? "cdr:post" : null;
      return { event: event as RouterEvent, params, module };
    }

    if (mod === "tariffs") {
      if (rest.length >= 3) {
        [params.countryCode, params.partyId, params.tariffId] = rest;
        const event =
          method === "PUT"
            ? "tariff:put"
            : method === "DELETE"
              ? "tariff:delete"
              : null;
        return { event: event as RouterEvent, params, module };
      }
    }

    if (mod === "tokens") {
      if (rest.length >= 3) {
        [params.countryCode, params.partyId, params.uid] = rest;
        params.type =
          new URLSearchParams(basePath.split("?")[1] ?? "").get("type") ??
          "RFID";
        const event =
          method === "PUT"
            ? "token:put"
            : method === "PATCH"
              ? "token:patch"
              : method === "GET"
                ? "token:get"
                : null;
        return { event: event as RouterEvent, params, module };
      }
    }

    if (mod === "commands") {
      const [commandType] = rest;
      const commandMap: Record<string, RouterEvent> = {
        START_SESSION: "command:start_session",
        STOP_SESSION: "command:stop_session",
        RESERVE_NOW: "command:reserve_now",
        CANCEL_RESERVATION: "command:cancel_reservation",
        UNLOCK_CONNECTOR: "command:unlock_connector",
      };
      const event = commandType ? commandMap[commandType] : null;
      return { event: event ?? null, params, module };
    }

    if (mod === "credentials") {
      const event =
        method === "POST"
          ? "credentials:post"
          : method === "PUT"
            ? "credentials:put"
            : method === "DELETE"
              ? "credentials:delete"
              : null;
      return { event: event as RouterEvent, params, module };
    }

    return noResult;
  }

  private _errorResponse(
    ocpiCode: number,
    message: string,
    requestId: string,
    correlationId: string,
    httpStatus = 400,
  ): Response {
    return new Response(
      JSON.stringify({
        status_code: ocpiCode,
        status_message: message,
        data: null,
        timestamp: new Date().toISOString(),
      }),
      {
        status: httpStatus,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
          "X-Correlation-ID": correlationId,
        },
      },
    );
  }
}

export * from "./context.js";
export * from "./events.js";
