import { describe, expect, it } from "vitest";
import {
  AuthorizationInfoSchema,
  DisplayTextSchema,
  GeoLocationSchema,
  OcpiResponseSchema,
  PriceSchema,
} from "../schemas/common.js";
import {
  CancelReservationSchema,
  StartSessionSchema,
  StopSessionSchema,
  UnlockConnectorSchema,
} from "../schemas/v2.2.1/commands.js";
import { CredentialsSchema } from "../schemas/v2.2.1/credentials.js";
import {
  ConnectorPatchSchema,
  EvsePatchSchema,
  LocationPatchSchema,
  LocationSchema,
} from "../schemas/v2.2.1/locations.js";
import {
  SessionPatchSchema,
  SessionSchema,
} from "../schemas/v2.2.1/sessions.js";
import { TokenPatchSchema, TokenSchema } from "../schemas/v2.2.1/tokens.js";
import { VersionSchema } from "../schemas/versions.js";

// ── Common ────────────────────────────────────────────────────────────────────
describe("GeoLocationSchema", () => {
  it("parses valid coordinates", () => {
    const result = GeoLocationSchema.parse({
      latitude: "51.34567",
      longitude: "4.12345",
    });
    expect(result.latitude).toBe("51.34567");
    expect(result.longitude).toBe("4.12345");
  });

  it("rejects short precision", () => {
    expect(() =>
      GeoLocationSchema.parse({ latitude: "51.3", longitude: "4.1" }),
    ).toThrow();
  });

  it("rejects non-numeric strings", () => {
    expect(() =>
      GeoLocationSchema.parse({ latitude: "abc", longitude: "def" }),
    ).toThrow();
  });
});

describe("DisplayTextSchema", () => {
  it("parses valid display text", () => {
    const result = DisplayTextSchema.parse({ language: "en", text: "Hello" });
    expect(result.language).toBe("en");
  });

  it("rejects language codes longer than 2", () => {
    expect(() =>
      DisplayTextSchema.parse({ language: "eng", text: "Hello" }),
    ).toThrow();
  });
});

describe("PriceSchema", () => {
  it("parses excl_vat and optional incl_vat", () => {
    const r1 = PriceSchema.parse({ excl_vat: 10.5 });
    expect(r1.excl_vat).toBe(10.5);
    expect(r1.incl_vat).toBeUndefined();

    const r2 = PriceSchema.parse({ excl_vat: 10.5, incl_vat: 12.5 });
    expect(r2.incl_vat).toBe(12.5);
  });
});

describe("OcpiResponseSchema", () => {
  it("parses a success envelope", () => {
    const envelope = OcpiResponseSchema.parse({
      status_code: 1000,
      data: [{ id: "LOC1" }],
      timestamp: new Date().toISOString(),
    });
    expect(envelope.status_code).toBe(1000);
  });

  it("parses an error envelope with no data", () => {
    const envelope = OcpiResponseSchema.parse({
      status_code: 2001,
      status_message: "Invalid token",
      timestamp: new Date().toISOString(),
    });
    expect(envelope.status_message).toBe("Invalid token");
  });

  it("rejects missing timestamp", () => {
    expect(() => OcpiResponseSchema.parse({ status_code: 1000 })).toThrow();
  });
});

// ── Locations ─────────────────────────────────────────────────────────────────

const validLocation = {
  id: "LOC1",
  type: "ON_STREET",
  address: "Main St 1",
  city: "Amsterdam",
  country: "NLD",
  coordinates: { latitude: "52.37000", longitude: "4.89000" },
  time_zone: "Europe/Amsterdam",
  last_updated: new Date().toISOString(),
};

describe("LocationSchema", () => {
  it("parses a valid location", () => {
    expect(() => LocationSchema.parse(validLocation)).not.toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => LocationSchema.parse({ id: "LOC1" })).toThrow();
  });
});

describe("ConnectorPatchSchema", () => {
  it("requires last_updated", () => {
    expect(() => ConnectorPatchSchema.parse({})).toThrow();
  });

  it("accepts partial patch with last_updated", () => {
    const patch = ConnectorPatchSchema.parse({
      last_updated: new Date().toISOString(),
      voltage: 400,
    });
    expect(patch.voltage).toBe(400);
  });
});

describe("EvsePatchSchema", () => {
  it("accepts partial with only last_updated", () => {
    const patch = EvsePatchSchema.parse({
      last_updated: new Date().toISOString(),
    });
    expect(patch.last_updated).toBeTruthy();
  });
});

describe("LocationPatchSchema", () => {
  it("accepts minimal patch with last_updated", () => {
    const patch = LocationPatchSchema.parse({
      last_updated: new Date().toISOString(),
    });
    expect(patch).toBeTruthy();
  });
});

// ── Sessions ──────────────────────────────────────────────────────────────────
const validSession = {
  id: "SES1",
  start_date_time: new Date().toISOString(),
  kwh: 20.5,
  auth_method: "WHITELIST",
  auth_id: "RFID123",
  location_id: "LOC1",
  evse_uid: "EVSE1",
  connector_id: "1",
  currency: "EUR",
  status: "ACTIVE",
  last_updated: new Date().toISOString(),
};

describe("SessionSchema", () => {
  it("parses a valid session", () => {
    expect(() => SessionSchema.parse(validSession)).not.toThrow();
  });
});

describe("SessionPatchSchema", () => {
  it("requires last_updated", () => {
    expect(() => SessionPatchSchema.parse({})).toThrow();
  });

  it("accepts partial with kwh update", () => {
    const patch = SessionPatchSchema.parse({
      kwh: 25.0,
      last_updated: new Date().toISOString(),
    });
    expect(patch.kwh).toBe(25.0);
  });
});

// ── Tokens ────────────────────────────────────────────────────────────────────
const validToken = {
  country_code: "DE",
  party_id: "MSP",
  uid: "TOKEN123",
  type: "RFID",
  contract_id: "DE123456",
  issuer: "MSP GmbH",
  valid: true,
  whitelist: "ALWAYS",
  last_updated: new Date().toISOString(),
};

describe("TokenSchema", () => {
  it("parses a valid token", () => {
    expect(() => TokenSchema.parse(validToken)).not.toThrow();
  });
});

describe("TokenPatchSchema", () => {
  it("requires last_updated", () => {
    expect(() => TokenPatchSchema.parse({})).toThrow();
  });

  it("accepts partial valid update", () => {
    const patch = TokenPatchSchema.parse({
      valid: false,
      last_updated: new Date().toISOString(),
    });
    expect(patch.valid).toBe(false);
  });
});

// ── Credentials ───────────────────────────────────────────────────────────────
describe("CredentialsSchema", () => {
  it("parses valid credentials", () => {
    const cred = CredentialsSchema.parse({
      token: "TOKEN_A",
      url: "https://cpo.example.com/ocpi/versions",
      roles: [
        {
          role: "CPO",
          business_details: {},
          party_id: "CPO",
          country_code: "DE",
        },
      ],
    });
    expect(cred.token).toBe("TOKEN_A");
  });
});

// ── Versions ──────────────────────────────────────────────────────────────────
describe("VersionSchema", () => {
  it("parses a version entry", () => {
    const v = VersionSchema.parse({
      version: "2.2.1",
      url: "https://cpo.example.com/ocpi/2.2.1",
    });
    expect(v.version).toBe("2.2.1");
  });
});

// ── Commands ──────────────────────────────────────────────────────────────────
describe("Command schemas", () => {
  it("parses StartSessionSchema", () => {
    const result = StartSessionSchema.parse({
      response_url: "https://emsp.example.com/commands/123",
      token: validToken,
      location_id: "LOC1",
    });
    expect(result.location_id).toBe("LOC1");
  });

  it("parses StopSessionSchema", () => {
    const result = StopSessionSchema.parse({
      response_url: "https://emsp.example.com/commands/456",
      session_id: "SES1",
    });
    expect(result.session_id).toBe("SES1");
  });

  it("parses UnlockConnectorSchema", () => {
    const result = UnlockConnectorSchema.parse({
      response_url: "https://emsp.example.com/commands/789",
      location_id: "LOC1",
      evse_uid: "EVSE1",
      connector_id: "1",
    });
    expect(result.connector_id).toBe("1");
  });

  it("parses CancelReservationSchema", () => {
    const result = CancelReservationSchema.parse({
      response_url: "https://emsp.example.com/commands/cancel",
      reservation_id: "RES1",
    });
    expect(result.reservation_id).toBe("RES1");
  });
});

// ── AuthorizationInfo ─────────────────────────────────────────────────────────
describe("AuthorizationInfoSchema", () => {
  it("parses allowed authorization", () => {
    const result = AuthorizationInfoSchema.parse({
      allowed: "ALLOWED",
      token: { uid: "T1", type: "RFID", contract_id: "C1" },
    });
    expect(result.allowed).toBe("ALLOWED");
  });

  it("parses blocked authorization", () => {
    const result = AuthorizationInfoSchema.parse({
      allowed: "BLOCKED",
      token: { uid: "T1", type: "RFID", contract_id: "C1" },
    });
    expect(result.allowed).toBe("BLOCKED");
  });
});
