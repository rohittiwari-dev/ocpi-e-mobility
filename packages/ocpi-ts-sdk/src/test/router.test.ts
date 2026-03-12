import { describe, expect, it } from "vitest";
import type { OcpiPartner } from "../router/context.js";
import { OCPIRouter } from "../router/index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PARTNER: OcpiPartner = {
  partyId: "CPO",
  countryCode: "DE",
};

function makeRouter(strict = false) {
  return new OCPIRouter({
    version: "2.2.1",
    prefix: "/ocpi",
    tokenAuth: async (token) => (token === "valid" ? PARTNER : null),
    logging: { enabled: false },
    schemaValidation: strict ? "strict-2.2.1" : "lenient",
  });
}

function makeRequest(
  path: string,
  method = "GET",
  body?: unknown,
  token = "valid",
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: new Headers({
      "Content-Type": "application/json",
      Authorization: `Token ${Buffer.from(token).toString("base64")}`,
      "X-Request-ID": "req-1",
      "X-Correlation-ID": "cor-1",
    }),
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────
describe("OCPIRouter", () => {
  describe("authentication", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const router = makeRouter();
      const req = new Request(
        "http://localhost/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        {
          method: "PUT",
          headers: new Headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        },
      );
      const res = await router.handle(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when token is invalid", async () => {
      const router = makeRouter();
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        {},
        "invalid-token",
      );
      const res = await router.handle(req);
      expect(res.status).toBe(401);
    });

    it("returns 404 for unknown route even with valid token", async () => {
      const router = makeRouter();
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/unknown-module/X/Y/Z",
        "GET",
      );
      const res = await router.handle(req);
      // No handler registered → 404
      expect(res.status).toBe(404);
    });
  });

  describe("location routing", () => {
    it("routes PUT /locations/:cc/:pid/:locId to location:put handler", async () => {
      const router = makeRouter();
      let received: unknown;

      router.on("location:put", async (data, _ctx) => {
        received = data;
        return { status_code: 1000 };
      });

      const location = {
        id: "LOC1",
        type: "ON_STREET",
        address: "Main St",
        city: "Berlin",
        country: "DEU",
        coordinates: { latitude: "52.52000", longitude: "13.40500" },
        time_zone: "Europe/Berlin",
        last_updated: new Date().toISOString(),
      };

      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        location,
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status_code: number };
      expect(body.status_code).toBe(1000);
      expect(received).toEqual(location);
    });

    it("routes PATCH /locations/:cc/:pid/:locId to location:patch handler", async () => {
      const router = makeRouter();
      router.on("location:patch", async (_data, _ctx) => ({
        status_code: 1000,
      }));

      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PATCH",
        { last_updated: new Date().toISOString() },
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });

    it("routes PUT /locations/:cc/:pid/:locId/:evseUid to evse:put handler", async () => {
      const router = makeRouter();
      let handlerCalled = false;
      router.on("evse:put", async (_data, ctx) => {
        handlerCalled = true;
        expect(ctx.params.evseUid).toBe("EVSE1");
        return { status_code: 1000 };
      });

      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1/EVSE1",
        "PUT",
        {},
      );
      await router.handle(req);
      expect(handlerCalled).toBe(true);
    });

    it("routes PUT connector path to connector:put handler", async () => {
      const router = makeRouter();
      router.on("connector:put", async (_data, ctx) => {
        expect(ctx.params.connectorId).toBe("CON1");
        return { status_code: 1000 };
      });

      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1/EVSE1/CON1",
        "PUT",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });
  });

  describe("session routing", () => {
    it("routes PUT /sessions to session:put", async () => {
      const router = makeRouter();
      router.on("session:put", async () => ({ status_code: 1000 }));
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/sessions/DE/CPO/SES1",
        "PUT",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });

    it("routes PATCH /sessions to session:patch", async () => {
      const router = makeRouter();
      router.on("session:patch", async () => ({ status_code: 1000 }));
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/sessions/DE/CPO/SES1",
        "PATCH",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });
  });

  describe("CDR routing", () => {
    it("routes POST /cdrs to cdr:post", async () => {
      const router = makeRouter();
      router.on("cdr:post", async () => ({ status_code: 1000 }));
      const req = makeRequest("/ocpi/receiver/2.2.1/cdrs", "POST", {});
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });
  });

  describe("tariff routing", () => {
    it("routes PUT /tariffs to tariff:put", async () => {
      const router = makeRouter();
      router.on("tariff:put", async () => ({ status_code: 1000 }));
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/tariffs/DE/CPO/T1",
        "PUT",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });

    it("routes DELETE /tariffs to tariff:delete", async () => {
      const router = makeRouter();
      router.on("tariff:delete", async () => ({ status_code: 1000 }));
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/tariffs/DE/CPO/T1",
        "DELETE",
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });
  });

  describe("token routing", () => {
    it("routes PUT /tokens to token:put", async () => {
      const router = makeRouter();
      router.on("token:put", async () => ({ status_code: 1000 }));
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/tokens/DE/CPO/TOKEN1",
        "PUT",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });
  });

  describe("command routing", () => {
    it("routes POST /commands/START_SESSION to command:start_session", async () => {
      const router = makeRouter();
      router.on("command:start_session", async () => ({ status_code: 1000 }));
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/commands/START_SESSION",
        "POST",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });

    it("routes POST /commands/STOP_SESSION to command:stop_session", async () => {
      const router = makeRouter();
      router.on("command:stop_session", async () => ({ status_code: 1000 }));
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/commands/STOP_SESSION",
        "POST",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });
  });

  describe("credentials routing", () => {
    it("routes POST /credentials to credentials:post", async () => {
      const router = makeRouter();
      router.on("credentials:post", async () => ({ status_code: 1000 }));
      const req = makeRequest("/ocpi/receiver/2.2.1/credentials", "POST", {});
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });

    it("routes DELETE /credentials to credentials:delete", async () => {
      const router = makeRouter();
      router.on("credentials:delete", async () => ({ status_code: 1000 }));
      const req = makeRequest("/ocpi/receiver/2.2.1/credentials", "DELETE");
      const res = await router.handle(req);
      expect(res.status).toBe(200);
    });
  });

  describe("handler errors", () => {
    it("returns 500 when handler throws", async () => {
      const router = makeRouter();
      router.on("location:put", async () => {
        throw new Error("DB down");
      });
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(500);
      const body = (await res.json()) as { status_code: number };
      expect(body.status_code).toBe(3000);
    });

    it("calls onError hook when handler throws", async () => {
      let capturedError: Error | null = null;
      const router = new OCPIRouter({
        version: "2.2.1",
        tokenAuth: async () => PARTNER,
        logging: { enabled: false },
        schemaValidation: "lenient",
        onError: (err) => {
          capturedError = err;
        },
      });
      router.on("location:put", async () => {
        throw new Error("fail");
      });
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        {},
      );
      await router.handle(req);
      expect((capturedError as Error | null)?.message).toBe("fail");
    });

    it("returns 400 when body is invalid JSON", async () => {
      const router = makeRouter();
      router.on("location:put", async () => ({ status_code: 1000 }));
      const req = new Request(
        "http://localhost/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        {
          method: "PUT",
          headers: new Headers({
            "Content-Type": "application/json",
            Authorization: `Token ${Buffer.from("valid").toString("base64")}`,
          }),
          body: "not-json",
        },
      );
      const res = await router.handle(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 when no handler registered for a valid route", async () => {
      const router = makeRouter();
      // No .on('location:put') registered
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(404);
    });
  });

  describe("multi-tenant routing", () => {
    it("extracts tenantId from path", async () => {
      const router = new OCPIRouter({
        version: "2.2.1",
        prefix: "/ocpi/:tenantId",
        tokenAuth: async (_token, tenantId) => ({
          partyId: "CPO",
          countryCode: "DE",
          tenantId,
        }),
        logging: { enabled: false },
        schemaValidation: "lenient",
      });

      let receivedTenantId: string | undefined;
      router.on("location:put", async (_data, ctx) => {
        receivedTenantId = ctx.tenantId;
        return { status_code: 1000 };
      });

      const req = makeRequest(
        "/ocpi/tenant-abc/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(200);
      expect(receivedTenantId).toBe("tenant-abc");
    });
  });

  describe("authorization hook", () => {
    it("returns 403 when authorize returns false", async () => {
      const router = new OCPIRouter({
        version: "2.2.1",
        tokenAuth: async () => PARTNER,
        authorize: async () => false,
        logging: { enabled: false },
        schemaValidation: "lenient",
      });
      router.on("location:put", async () => ({ status_code: 1000 }));
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        {},
      );
      const res = await router.handle(req);
      expect(res.status).toBe(403);
    });
  });

  describe("handler error payload", () => {
    it("returns custom OCPI error status_code from handler", async () => {
      const router = makeRouter();
      router.on("location:put", async () => ({
        status_code: 2001,
        status_message: "Unknown location",
      }));
      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        {},
      );
      const res = await router.handle(req);
      const body = (await res.json()) as {
        status_code: number;
        status_message: string;
      };
      expect(body.status_code).toBe(2001);
      expect(body.status_message).toBe("Unknown location");
    });
  });

  describe("response headers", () => {
    it("echoes X-Request-ID and X-Correlation-ID in response", async () => {
      const router = makeRouter();
      router.on("cdr:post", async () => ({ status_code: 1000 }));
      const req = makeRequest("/ocpi/receiver/2.2.1/cdrs", "POST", {});
      const res = await router.handle(req);
      expect(res.headers.get("X-Request-ID")).toBe("req-1");
      expect(res.headers.get("X-Correlation-ID")).toBe("cor-1");
    });
  });

  describe("fetch() adapter", () => {
    it("returns a function that calls handle()", async () => {
      const router = makeRouter();
      const handler = router.fetch();
      router.on("cdr:post", async () => ({ status_code: 1000 }));
      const req = makeRequest("/ocpi/receiver/2.2.1/cdrs", "POST", {});
      const res = await handler(req);
      expect(res).toBeInstanceOf(Response);
    });
  });

  describe("payload validation", () => {
    it("returns 400 Bad Request with OCPI 2001 when payload is invalid in strict mode", async () => {
      const router = makeRouter(true); // strict-2.2.1
      router.on("location:put", async () => ({ status_code: 1000 }));

      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        { invalid: "data" }, // Missing all required Location fields
      );

      const res = await router.handle(req);
      expect(res.status).toBe(400); // HTTP status

      const body = (await res.json()) as {
        status_code: number;
        status_message: string;
      };
      expect(body.status_code).toBe(2001); // OCPI status
      expect(body.status_message).toContain("id (Required)");
      expect(body.status_message).toContain("type (Required)");
    });

    it("passes validation and strips unknown properties when payload is valid", async () => {
      const router = makeRouter(true); // strict-2.2.1
      let receivedData: any;
      router.on("location:put", async (data) => {
        receivedData = data;
        return { status_code: 1000 };
      });

      const validLocation = {
        id: "LOC1",
        type: "ON_STREET",
        address: "Main St",
        city: "Berlin",
        country: "DEU",
        coordinates: { latitude: "52.52000", longitude: "13.40500" },
        time_zone: "Europe/Berlin",
        last_updated: new Date().toISOString(),
        extra_unknown_field: "should_be_stripped",
      };

      const req = makeRequest(
        "/ocpi/receiver/2.2.1/locations/DE/CPO/LOC1",
        "PUT",
        validLocation,
      );

      const res = await router.handle(req);
      expect(res.status).toBe(200);

      // Verify the unknown field was stripped by Zod
      expect(receivedData).toBeDefined();
      expect(receivedData.id).toBe("LOC1");
      expect(receivedData.extra_unknown_field).toBeUndefined();
    });
  });
});
