import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OcpiCircuitOpenError,
  OcpiError,
  OcpiHttpError,
  OcpiRateLimitError,
} from "../client/errors.js";
import { OCPIClient } from "../client/index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_CONFIG = {
  versionsUrl: "https://partner.example.com/ocpi/versions",
  credentialsToken: "test-token-abc",
  partyId: "CPO",
  countryCode: "DE",
};

function makeOcpiResponse(data: unknown, statusCode = 1000) {
  return {
    status_code: statusCode,
    data,
    timestamp: new Date().toISOString(),
  };
}

function mockFetch(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: new Headers({
        "Content-Type": "application/json",
        ...headers,
      }),
    }),
  );
}

// ── OCPIClient constructor ─────────────────────────────────────────────────────
describe("OCPIClient", () => {
  let originalFetch: typeof global.fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("creates with minimal config", () => {
      const client = new OCPIClient(BASE_CONFIG);
      expect(client.config.partyId).toBe("CPO");
    });

    it("auto-wires all modules", () => {
      const client = new OCPIClient(BASE_CONFIG);
      expect(client.locations).toBeDefined();
      expect(client.sessions).toBeDefined();
      expect(client.cdrs).toBeDefined();
      expect(client.tariffs).toBeDefined();
      expect(client.tokens).toBeDefined();
      expect(client.commands).toBeDefined();
      expect(client.credentials).toBeDefined();
    });

    it("encodes token as Base64 by default", () => {
      const client = new OCPIClient({
        ...BASE_CONFIG,
        credentialsToken: "my-secret-token",
      });
      // The encoded token is stored internally — test via Authorization header
      const headers = (
        client as unknown as { _buildRawHeaders: () => Headers }
      )._buildRawHeaders();
      const auth = headers.get("Authorization") ?? "";
      const encoded = Buffer.from("my-secret-token", "utf-8").toString(
        "base64",
      );
      expect(auth).toBe(`Token ${encoded}`);
    });

    it("uses plain token when tokenEncoding=plain", () => {
      const client = new OCPIClient({
        ...BASE_CONFIG,
        tokenEncoding: "plain",
        credentialsToken: "plain-token",
      });
      const headers = (
        client as unknown as { _buildRawHeaders: () => Headers }
      )._buildRawHeaders();
      const auth = headers.get("Authorization") ?? "";
      expect(auth).toBe("Token plain-token");
    });

    it("includes custom headers from config", () => {
      const client = new OCPIClient({ ...BASE_CONFIG, version: "2.2.1" });
      const headers = (
        client as unknown as { _buildRawHeaders: () => Headers }
      )._buildRawHeaders();
      expect(headers.get("OCPI-from-party-id")).toBe("CPO");
      expect(headers.get("OCPI-from-country-code")).toBe("DE");
      expect(headers.get("OCPI-from-version")).toBe("2.2.1");
    });
  });

  describe("resolveEndpoint", () => {
    it("returns manual override from config.endpoints", () => {
      const client = new OCPIClient({
        ...BASE_CONFIG,
        endpoints: { locations: "https://custom.example.com/locations" },
      });
      expect(client.resolveEndpoint("locations")).toBe(
        "https://custom.example.com/locations",
      );
    });

    it("throws OcpiDiscoveryError when not initialized", () => {
      const client = new OCPIClient(BASE_CONFIG);
      expect(() => client.resolveEndpoint("locations")).toThrow(
        "No endpoint URL for module",
      );
    });
  });

  describe("init()", () => {
    it("discovers endpoints via versions handshake", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          // Versions list
          new Response(
            JSON.stringify(
              makeOcpiResponse([
                {
                  version: "2.2.1",
                  url: "https://partner.example.com/ocpi/2.2.1",
                },
              ]),
            ),
            {
              status: 200,
              headers: new Headers({ "Content-Type": "application/json" }),
            },
          ),
        )
        .mockResolvedValueOnce(
          // Version detail
          new Response(
            JSON.stringify(
              makeOcpiResponse({
                version: "2.2.1",
                endpoints: [
                  {
                    identifier: "locations",
                    role: "SENDER",
                    url: "https://partner.example.com/ocpi/2.2.1/locations",
                  },
                  {
                    identifier: "sessions",
                    role: "SENDER",
                    url: "https://partner.example.com/ocpi/2.2.1/sessions",
                  },
                ],
              }),
            ),
            {
              status: 200,
              headers: new Headers({ "Content-Type": "application/json" }),
            },
          ),
        );

      const client = new OCPIClient(BASE_CONFIG);
      await client.init();

      expect(client.resolveEndpoint("locations")).toBe(
        "https://partner.example.com/ocpi/2.2.1/locations",
      );
    });

    it("emits discoveryComplete event", async () => {
      const versions = makeOcpiResponse([
        { version: "2.2.1", url: "https://p.example.com/ocpi/2.2.1" },
      ]);
      const detail = makeOcpiResponse({
        version: "2.2.1",
        endpoints: [
          {
            identifier: "locations",
            role: "SENDER",
            url: "https://p.example.com/locations",
          },
        ],
      });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify(versions), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(detail), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );

      const client = new OCPIClient(BASE_CONFIG);
      const emitSpy = vi.spyOn(client, "emit");
      await client.init();
      expect(emitSpy).toHaveBeenCalledWith(
        "discoveryComplete",
        expect.any(Object),
      );
    });

    it("throws OcpiDiscoveryError on non-200 versions response", async () => {
      global.fetch = mockFetch("Not Found", 404);
      const client = new OCPIClient(BASE_CONFIG);
      await expect(client.init()).rejects.toThrow("discovery");
    });

    it("throws OcpiDiscoveryError on OCPI error in versions response", async () => {
      global.fetch = mockFetch(makeOcpiResponse(null, 3001), 200);
      const client = new OCPIClient(BASE_CONFIG);
      await expect(client.init()).rejects.toThrow("discovery");
    });
  });

  describe("fetch()", () => {
    it("returns data on status_code=1000", async () => {
      global.fetch = mockFetch(makeOcpiResponse([{ id: "LOC1" }]));
      const client = new OCPIClient({
        ...BASE_CONFIG,
        endpoints: { locations: "https://p.example.com/locations" },
      });
      const result = await client.fetch<unknown[]>(
        "https://p.example.com/locations",
        { method: "GET" },
      );
      expect(result.data).toHaveLength(1);
    });

    it("throws OcpiError on status_code=2001", async () => {
      global.fetch = mockFetch(makeOcpiResponse(null, 2001));
      const client = new OCPIClient(BASE_CONFIG);
      await expect(
        client.fetch("https://p.example.com/test", { method: "GET" }),
      ).rejects.toThrow(OcpiError);
    });

    it("throws OcpiHttpError on 404 HTTP", async () => {
      global.fetch = mockFetch("Not Found", 404);
      const client = new OCPIClient(BASE_CONFIG);
      await expect(
        client.fetch("https://p.example.com/test", { method: "GET" }),
      ).rejects.toThrow(OcpiHttpError);
    });

    it("retries on 5xx and succeeds on second attempt", async () => {
      const failResponse = new Response("Server Error", { status: 500 });
      const successResponse = new Response(
        JSON.stringify(makeOcpiResponse({ id: "LOC1" })),
        {
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
        },
      );
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(failResponse)
        .mockResolvedValueOnce(successResponse);

      const client = new OCPIClient({ ...BASE_CONFIG, retries: 3 });
      const result = await client.fetch<{ id: string }>(
        "https://p.example.com/test",
        { method: "GET" },
      );
      expect(result.data.id).toBe("LOC1");
    });

    it("throws OcpiRateLimitError on 429 after exhausting retries", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response("Too Many", {
          status: 429,
          headers: new Headers({ "Retry-After": "1" }),
        }),
      );
      const client = new OCPIClient({ ...BASE_CONFIG, retries: 1 });
      await expect(
        client.fetch("https://p.example.com/test", { method: "GET" }),
      ).rejects.toThrow(OcpiRateLimitError);
    });

    it("throws OcpiCircuitOpenError when circuit is OPEN", async () => {
      const client = new OCPIClient({
        ...BASE_CONFIG,
        circuitBreaker: { failureThreshold: 1, cooldownMs: 60_000 },
        retries: 0,
      });

      // Trip the circuit
      global.fetch = mockFetch("Error", 500);
      await expect(
        client.fetch("https://p.example.com/test", { method: "GET" }),
      ).rejects.toThrow();

      // Next call should be rejected by circuit breaker immediately
      await expect(
        client.fetch("https://p.example.com/test", { method: "GET" }),
      ).rejects.toThrow(OcpiCircuitOpenError);
    });

    it("sends Idempotency-Key header when provided", async () => {
      let capturedHeaders: Headers | undefined;
      global.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
        capturedHeaders = new Headers(init.headers as HeadersInit);
        return Promise.resolve(
          new Response(JSON.stringify(makeOcpiResponse({ ok: true })), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });

      const client = new OCPIClient(BASE_CONFIG);
      await client.fetch("https://p.example.com/cdrs", {
        method: "POST",
        body: "{}",
        idempotencyKey: "unique-key-123",
      } as never);

      expect(capturedHeaders?.get("Idempotency-Key")).toBe("unique-key-123");
    });

    it("throws on invalid JSON response body", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response("not-json", {
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
        }),
      );
      const client = new OCPIClient({ ...BASE_CONFIG, retries: 0 });
      await expect(
        client.fetch("https://p.example.com/test", { method: "GET" }),
      ).rejects.toThrow();
    });

    it("emits rateLimitWarning when near limit", async () => {
      global.fetch = mockFetch(makeOcpiResponse({ ok: true }), 200, {
        "X-Limit-Remaining": "2",
        "X-Limit": "100",
      });
      const client = new OCPIClient(BASE_CONFIG);
      const emitSpy = vi.spyOn(client, "emit");
      await client.fetch("https://p.example.com/test", { method: "GET" });
      expect(emitSpy).toHaveBeenCalledWith("rateLimitWarning");
    });

    it("emits circuitOpen event when circuit trips", async () => {
      global.fetch = mockFetch("Error", 500);
      const client = new OCPIClient({
        ...BASE_CONFIG,
        circuitBreaker: { failureThreshold: 1, cooldownMs: 60_000 },
        retries: 0,
      });
      const emitSpy = vi.spyOn(client, "emit");
      await expect(
        client.fetch("https://p.example.com/test", { method: "GET" }),
      ).rejects.toThrow();
      expect(emitSpy).toHaveBeenCalledWith("circuitOpen");
    });
  });

  describe("HTTP verb helpers", () => {
    it("get() builds URL with query params", async () => {
      let captured = "";
      global.fetch = vi.fn().mockImplementation((url: string) => {
        captured = url;
        return Promise.resolve(
          new Response(JSON.stringify(makeOcpiResponse([])), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });

      const client = new OCPIClient(BASE_CONFIG);
      await client.get("https://p.example.com/locations", {
        limit: 50,
        offset: 0,
      });
      expect(captured).toContain("limit=50");
      expect(captured).toContain("offset=0");
    });

    it("put() sends JSON body", async () => {
      let capturedBody = "";
      global.fetch = vi
        .fn()
        .mockImplementation((_url: string, init: RequestInit) => {
          capturedBody = init.body as string;
          return Promise.resolve(
            new Response(JSON.stringify(makeOcpiResponse(null)), {
              status: 200,
              headers: new Headers({ "Content-Type": "application/json" }),
            }),
          );
        });

      const client = new OCPIClient(BASE_CONFIG);
      await client.put("https://p.example.com/locations/LOC1", { id: "LOC1" });
      expect(JSON.parse(capturedBody)).toEqual({ id: "LOC1" });
    });

    it("delete() uses DELETE method", async () => {
      let capturedMethod = "";
      global.fetch = vi
        .fn()
        .mockImplementation((_url: string, init: RequestInit) => {
          capturedMethod = init.method as string;
          return Promise.resolve(
            new Response(JSON.stringify(makeOcpiResponse(null)), {
              status: 200,
              headers: new Headers({ "Content-Type": "application/json" }),
            }),
          );
        });

      const client = new OCPIClient(BASE_CONFIG);
      await client.delete("https://p.example.com/tariffs/T1");
      expect(capturedMethod).toBe("DELETE");
    });
  });

  describe("with disabled logging", () => {
    it("creates silently with logging disabled", () => {
      const client = new OCPIClient({
        ...BASE_CONFIG,
        logging: { enabled: false },
      });
      expect(client).toBeDefined();
    });
  });
});
