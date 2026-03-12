import { describe, expect, it, vi } from "vitest";
import type { OcpiPartner } from "../router/context.js";
import { OCPIRouter } from "../router/index.js";

const PARTNER_SENDER: OcpiPartner = {
  partyId: "SENDER",
  countryCode: "DE",
};

function makeHubRouter() {
  return new OCPIRouter({
    version: "2.2.1",
    prefix: "/ocpi",
    mode: "HUB",
    tokenAuth: async (token) =>
      token === "sender-token" ? PARTNER_SENDER : null,
    logging: { enabled: false },
    resolveHubDestination: async (sender, toCountryCode, toPartyId) => {
      if (toCountryCode === "FR" && toPartyId === "GIR") {
        return {
          baseUrl: "https://gireve.com/ocpi-receiver",
          token: "hub-to-gireve-token",
        };
      }
      return null;
    },
  });
}

function makeRequest(
  path: string,
  method = "GET",
  body?: unknown,
  token = "sender-token",
  headers?: Record<string, string>,
) {
  const reqHeaders = new Headers({
    "Content-Type": "application/json",
    Authorization: `Token ${Buffer.from(token).toString("base64")}`,
    "X-Request-ID": "req-1",
    "X-Correlation-ID": "cor-1",
    ...headers,
  });

  return new Request(`http://localhost${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("OCPIRouter - HUB Mode", () => {
  it("rejects routing if OCPI-to-country-code or party-id headers are missing", async () => {
    const router = makeHubRouter();
    const req = makeRequest(
      "/ocpi/receiver/2.2.1/locations/FR/GIR/LOC1",
      "PUT",
      {},
    );

    // Not sending the required OCPI-to headers
    const res = await router.handle(req);
    expect(res.status).toBe(400); // 2001
    const body = (await res.json()) as any;
    expect(body.status_code).toBe(2001);
    expect(body.status_message).toContain("Missing");
  });

  it("returns 404 if resolveHubDestination returns null", async () => {
    const router = makeHubRouter();
    const req = makeRequest(
      "/ocpi/receiver/2.2.1/locations/FR/UNKNOWN/LOC1",
      "PUT",
      {},
      "sender-token",
      {
        "OCPI-to-country-code": "FR",
        "OCPI-to-party-id": "UNKNOWN",
      },
    );

    const res = await router.handle(req);
    expect(res.status).toBe(404);
  });

  it("transparently proxies the request to the resolved destination URL", async () => {
    const router = makeHubRouter();

    // Mock global fetch to intercept the proxy call
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status_code: 1000, data: "proxied-data" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Proxy": "true" },
        },
      ),
    );

    const req = makeRequest(
      "/ocpi/receiver/2.2.1/locations/FR/GIR/LOC1",
      "PUT",
      { hello: "world" },
      "sender-token",
      {
        "OCPI-from-country-code": "DE",
        "OCPI-from-party-id": "SENDER",
        "OCPI-to-country-code": "FR",
        "OCPI-to-party-id": "GIR",
      },
    );

    const res = await router.handle(req);

    // Verify our router returned the unmodified fetch response
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Proxy")).toBe("true");

    const body = (await res.json()) as any;
    expect(body.status_code).toBe(1000);
    expect(body.data).toBe("proxied-data");

    // Verify spy was called with correct proxy URL and replaced Authorziation token
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const proxyReq = fetchSpy.mock.calls[0][0] as Request;
    expect(proxyReq.url).toBe(
      "https://gireve.com/ocpi-receiver/receiver/2.2.1/locations/FR/GIR/LOC1",
    );
    expect(proxyReq.method).toBe("PUT");

    // The token should be the "hub-to-gireve-token" encoded, NOT the original sender-token!
    const authHeader = proxyReq.headers.get("Authorization");
    const expectedAuth = `Token ${Buffer.from("hub-to-gireve-token").toString("base64")}`;
    expect(authHeader).toBe(expectedAuth);

    // The body should be cloned exactly
    const proxyBody = await proxyReq.json();
    expect(proxyBody).toEqual({ hello: "world" });

    fetchSpy.mockRestore();
  });
});
