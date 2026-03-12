import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OCPIClient } from "../client/index.js";

const BASE_CONFIG = {
  versionsUrl: "https://partner.example.com/ocpi/versions",
  credentialsToken: "token",
  partyId: "CPO",
  countryCode: "DE",
  endpoints: {
    locations: "https://p.example.com/ocpi/2.2.1/locations",
    sessions: "https://p.example.com/ocpi/2.2.1/sessions",
    cdrs: "https://p.example.com/ocpi/2.2.1/cdrs",
    tariffs: "https://p.example.com/ocpi/2.2.1/tariffs",
    tokens: "https://p.example.com/ocpi/2.2.1/tokens",
    commands: "https://p.example.com/ocpi/2.2.1/commands",
    credentials: "https://p.example.com/ocpi/2.2.1/credentials",
  },
};

function makeOcpiResponse<T>(data: T) {
  return JSON.stringify({
    status_code: 1000,
    data,
    timestamp: new Date().toISOString(),
  });
}

function respondWith(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(makeOcpiResponse(data), {
      status,
      headers: new Headers({
        "Content-Type": "application/json",
        "X-Total-Count": "1",
        "X-Limit": "10",
      }),
    }),
  );
}

let originalFetch: typeof global.fetch;
beforeEach(() => {
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

function newClient() {
  return new OCPIClient(BASE_CONFIG);
}

// ── Locations ─────────────────────────────────────────────────────────────────
describe("OcpiLocationsModule", () => {
  it("pull() fetches a page", async () => {
    global.fetch = respondWith([{ id: "LOC1" }]);
    const client = newClient();
    const page = await client.locations.pull();
    expect(page.data).toHaveLength(1);
  });

  it("stream() yields all locations", async () => {
    global.fetch = respondWith([{ id: "LOC1" }]);
    const client = newClient();
    const items: unknown[] = [];
    for await (const loc of client.locations.stream()) items.push(loc);
    expect(items).toHaveLength(1);
  });

  it("get() fetches single location", async () => {
    global.fetch = respondWith({ id: "LOC1" });
    const client = newClient();
    const loc = await client.locations.get("LOC1");
    expect((loc as { id: string }).id).toBe("LOC1");
  });

  it("push() sends PUT", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.locations.push("LOC1", { id: "LOC1" } as never);
    expect(method).toBe("PUT");
  });

  it("update() sends PATCH", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.locations.update("LOC1", {
      last_updated: new Date().toISOString(),
    } as never);
    expect(method).toBe("PATCH");
  });

  it("updateEvse() sends PATCH to EVSE path", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(makeOcpiResponse(null), {
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
        }),
      );
    });
    const client = newClient();
    await client.locations.updateEvse("LOC1", "EVSE1", {
      last_updated: new Date().toISOString(),
    } as never);
    expect(capturedUrl).toContain("EVSE1");
  });

  it("updateEvseStatus() patches with status", async () => {
    let body: unknown;
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        body = JSON.parse(init.body as string);
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.locations.updateEvseStatus("LOC1", "EVSE1", "CHARGING");
    expect((body as { status: string }).status).toBe("CHARGING");
  });

  it("pushEvse() sends PUT to EVSE path", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.locations.pushEvse("LOC1", "EVSE1", { uid: "EVSE1" } as never);
    expect(method).toBe("PUT");
  });

  it("updateConnector() sends PATCH to connector path", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(makeOcpiResponse(null), {
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
        }),
      );
    });
    const client = newClient();
    await client.locations.updateConnector("LOC1", "EVSE1", "CON1", {
      last_updated: new Date().toISOString(),
    } as never);
    expect(capturedUrl).toContain("CON1");
  });

  it("pushConnector() sends PUT to connector path", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.locations.pushConnector("LOC1", "EVSE1", "CON1", {
      id: "CON1",
    } as never);
    expect(method).toBe("PUT");
  });
});

// ── Sessions ──────────────────────────────────────────────────────────────────
describe("OcpiSessionsModule", () => {
  it("pull() fetches a page", async () => {
    global.fetch = respondWith([{ id: "SES1" }]);
    const client = newClient();
    const page = await client.sessions.pull();
    expect(page.data[0]).toEqual({ id: "SES1" });
  });

  it("stream() yields sessions", async () => {
    global.fetch = respondWith([{ id: "SES1" }]);
    const client = newClient();
    const items: unknown[] = [];
    for await (const s of client.sessions.stream()) items.push(s);
    expect(items).toHaveLength(1);
  });

  it("get() fetches single session", async () => {
    global.fetch = respondWith({ id: "SES1" });
    const client = newClient();
    const session = await client.sessions.get("SES1");
    expect((session as { id: string }).id).toBe("SES1");
  });

  it("create() sends PUT", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.sessions.create({ id: "SES1" } as never);
    expect(method).toBe("PUT");
  });

  it("update() sends PATCH", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.sessions.update("SES1", {
      last_updated: new Date().toISOString(),
      kwh: 20,
    } as never);
    expect(method).toBe("PATCH");
  });
});

// ── CDRs ──────────────────────────────────────────────────────────────────────
describe("OcpiCdrsModule", () => {
  it("pull() fetches page", async () => {
    global.fetch = respondWith([{ id: "CDR1" }]);
    const client = newClient();
    const page = await client.cdrs.pull();
    expect(page.data).toHaveLength(1);
  });

  it("stream() yields CDRs", async () => {
    global.fetch = respondWith([{ id: "CDR1" }]);
    const client = newClient();
    const items: unknown[] = [];
    for await (const c of client.cdrs.stream()) items.push(c);
    expect(items).toHaveLength(1);
  });

  it("get() fetches single CDR", async () => {
    global.fetch = respondWith({ id: "CDR1" });
    const client = newClient();
    const cdr = await client.cdrs.get("CDR1");
    expect((cdr as { id: string }).id).toBe("CDR1");
  });

  it("push() sends POST with idempotency key", async () => {
    let capturedHeaders: Headers | undefined;
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        capturedHeaders = new Headers(init.headers as HeadersInit);
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.cdrs.push({ id: "CDR1" } as never, {
      idempotencyKey: "cdr-1",
    });
    expect(method).toBe("POST");
    expect(capturedHeaders?.get("Idempotency-Key")).toBe("cdr-1");
  });
});

// ── Tariffs ───────────────────────────────────────────────────────────────────
describe("OcpiTariffsModule", () => {
  it("pull() fetches page", async () => {
    global.fetch = respondWith([{ id: "TARIFF1" }]);
    const client = newClient();
    const page = await client.tariffs.pull();
    expect(page.data).toHaveLength(1);
  });

  it("get() fetches single tariff", async () => {
    global.fetch = respondWith({ id: "TARIFF1" });
    const client = newClient();
    const tariff = await client.tariffs.get("TARIFF1");
    expect((tariff as { id: string }).id).toBe("TARIFF1");
  });

  it("push() sends PUT", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.tariffs.push("TARIFF1", { id: "TARIFF1" } as never);
    expect(method).toBe("PUT");
  });

  it("delete() sends DELETE", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.tariffs.delete("TARIFF1");
    expect(method).toBe("DELETE");
  });
});

// ── Tokens ────────────────────────────────────────────────────────────────────
describe("OcpiTokensModule", () => {
  it("pull() fetches page", async () => {
    global.fetch = respondWith([{ uid: "TOKEN1" }]);
    const client = newClient();
    const page = await client.tokens.pull();
    expect(page.data).toHaveLength(1);
  });

  it("get() fetches single token", async () => {
    global.fetch = respondWith({ uid: "TOKEN1" });
    const client = newClient();
    const token = await client.tokens.get("TOKEN1", "RFID");
    expect((token as { uid: string }).uid).toBe("TOKEN1");
  });

  it("push() sends PUT", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.tokens.push("TOKEN1", { uid: "TOKEN1" } as never);
    expect(method).toBe("PUT");
  });

  it("patch() sends PATCH", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.tokens.patch("TOKEN1", {
      valid: false,
      last_updated: new Date().toISOString(),
    } as never);
    expect(method).toBe("PATCH");
  });

  it("authorize() sends POST and returns AuthorizationInfo", async () => {
    global.fetch = respondWith({
      allowed: "ALLOWED",
      token: { uid: "TOKEN1", type: "RFID", contract_id: "C1" },
    });
    const client = newClient();
    const result = await client.tokens.authorize("TOKEN1");
    expect((result as { allowed: string }).allowed).toBe("ALLOWED");
  });
});

// ── Commands ──────────────────────────────────────────────────────────────────
describe("OcpiCommandsModule", () => {
  function commandResponse() {
    return respondWith({ result: "ACCEPTED" });
  }

  it("startSession() posts to START_SESSION", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(makeOcpiResponse({ result: "ACCEPTED" }), {
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
        }),
      );
    });
    const client = newClient();
    const result = await client.commands.startSession({
      response_url: "https://emsp.example.com/cb",
      token: {} as never,
      location_id: "LOC1",
    });
    expect(capturedUrl).toContain("START_SESSION");
    expect(result.result).toBe("ACCEPTED");
  });

  it("stopSession() posts to STOP_SESSION", async () => {
    global.fetch = commandResponse();
    const client = newClient();
    const result = await client.commands.stopSession({
      response_url: "https://emsp.example.com/cb",
      session_id: "SES1",
    });
    expect(result.result).toBe("ACCEPTED");
  });

  it("reserveNow() posts to RESERVE_NOW", async () => {
    global.fetch = commandResponse();
    const client = newClient();
    const result = await client.commands.reserveNow({
      response_url: "https://emsp.example.com/cb",
      token: {} as never,
      expiry_date: new Date().toISOString(),
      reservation_id: "RES1",
      location_id: "LOC1",
    });
    expect(result.result).toBe("ACCEPTED");
  });

  it("cancelReservation() posts to CANCEL_RESERVATION", async () => {
    global.fetch = commandResponse();
    const client = newClient();
    const result = await client.commands.cancelReservation({
      response_url: "https://emsp.example.com/cb",
      reservation_id: "RES1",
    });
    expect(result.result).toBe("ACCEPTED");
  });

  it("unlockConnector() posts to UNLOCK_CONNECTOR", async () => {
    global.fetch = commandResponse();
    const client = newClient();
    const result = await client.commands.unlockConnector({
      response_url: "https://emsp.example.com/cb",
      location_id: "LOC1",
      evse_uid: "EVSE1",
      connector_id: "1",
    });
    expect(result.result).toBe("ACCEPTED");
  });
});

// ── Credentials ───────────────────────────────────────────────────────────────
describe("OcpiCredentialsModule", () => {
  const fakeCreds = {
    token: "TOKEN_B",
    url: "https://cpo.example.com/ocpi/versions",
    roles: [],
  };

  it("get() fetches credentials", async () => {
    global.fetch = respondWith(fakeCreds);
    const client = newClient();
    const creds = await client.credentials.get();
    expect((creds as { token: string }).token).toBe("TOKEN_B");
  });

  it("register() posts credentials", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(fakeCreds), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.credentials.register(fakeCreds as never);
    expect(method).toBe("POST");
  });

  it("update() puts credentials", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(fakeCreds), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.credentials.update(fakeCreds as never);
    expect(method).toBe("PUT");
  });

  it("delete() sends DELETE", async () => {
    let method = "";
    global.fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        method = init.method as string;
        return Promise.resolve(
          new Response(makeOcpiResponse(null), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
          }),
        );
      });
    const client = newClient();
    await client.credentials.delete();
    expect(method).toBe("DELETE");
  });
});
