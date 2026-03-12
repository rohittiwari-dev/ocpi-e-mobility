# ocpi-ts-sdk

A production-grade, framework-agnostic, multi-tenant SDK for the **Open Charge Point Interface (OCPI)** protocol — built for OCPI 2.2.1 with graceful 2.1.1 compatibility.

Designed to handle scale, resilient networking, and easy integration into any JavaScript/TypeScript runtime.

---

## Features

- **Full OCPI Protocol Support**: Covers Locations, Sessions, CDRs, Tariffs, Tokens, Commands, and Credentials.
- **Client & Receiver**: Includes both a resilient HTTP client (`OCPIClient`) and a framework-agnostic request router (`OCPIRouter`) for webhooks.
- **Multi-Tenant SaaS Ready**: Built-in `OcpiClientRegistry` for managing thousands of tenant connections with LRU caching.
- **Resilience Built-In**: 3-state Circuit Breaker, proactive Partner Rate Limiter (`X-Limit-*`), and automatic retry mechanisms.
- **Modern Paradigms**: `async *stream()` for memory-efficient pagination across large datasets.
- **Framework Agnostic**: Works natively with Express, Fastify, Node.js `http`, Bun, and Cloudflare Workers.
- **Version Agnostic**: Auto-negotiates OCPI version. Schemas organized per-version (`v2.2.1/`). Add new versions by registering one schema map — no router or client changes needed.
- **Lenient 2.1.1 Compatibility**: `schemaValidation: "lenient"` allows older partner payloads to pass through without rejection.
- **Tariff Price Calculator**: `OcpiCalculator.estimateCost()` handles step-based tariff math for driver-facing cost estimates.
- **Background Data Pump**: `OcpiDataPump` auto-syncs partner locations and tariffs in the background via incremental `date_from` polling.
- **OCPI Hub Routing**: Router supports `mode: "HUB"` for transparent request proxying between parties via `OCPI-to-*` headers.
- **Bring Your Own Logger**: Compatible with `voltlog-io`, `pino`, `winston`, or a zero-dependency `console` logger.

---

## Installation

```bash
npm install ocpi-ts-sdk
# or pnpm, yarn, bun
```

Subpath exports for tree-shakeable imports:
- `ocpi-ts-sdk` — Main entry (client, schemas, utils)
- `ocpi-ts-sdk/router`
- `ocpi-ts-sdk/registry`
- `ocpi-ts-sdk/errors`
- `ocpi-ts-sdk/logger`

---

## 1. Quick Start: The OCPI Client

The `OCPIClient` handles outbound requests to OCPI partner endpoints.

```typescript
import { OCPIClient } from "ocpi-ts-sdk";

const client = new OCPIClient({
  versionsUrl: "https://partner.com/ocpi/versions",
  credentialsToken: "secret-token",
  partyId: "CPO",
  countryCode: "DE",
  
  // Optional: preferred version. Negotiated dynamically with partner during init().
  // Well-known values: "2.1.1", "2.2.1", "3.0" — any version string works.
  version: "2.2.1",

  retries: 3,
  circuitBreaker: { failureThreshold: 5, cooldownMs: 60000 },
  logging: { enabled: true }
});

// Runs the OCPI version negotiation handshake, auto-discovers all module endpoints
await client.init();

// Fetch data (streaming, auto-paginated, memory-safe)
for await (const location of client.locations.stream()) {
  console.log("Fetched location:", location.id);
}

// Push data
await client.sessions.create({ id: "SES123", status: "ACTIVE" /* ... */ });

// Send Commands
await client.commands.startSession({
  response_url: "https://my-system.com/ocpi/commands/callback",
  location_id: "LOC-1",
  token: { uid: "RFID123", type: "RFID" }
});
```

---

## 2. The OCPI Router (Receive Webhooks)

The `OCPIRouter` handles incoming OCPI requests from partners — token auth, payload validation, routing, and tenant extraction.

```typescript
import { OCPIRouter } from "ocpi-ts-sdk/router";

const router = new OCPIRouter({
  version: "2.2.1",
  prefix: "/ocpi", // Or "/ocpi/:tenantId" for multi-tenancy

  tokenAuth: async (token, tenantId) => {
    const partner = await database.getPartnerByToken(token);
    return partner ?? null; // Returning null auto-sends 401
  }
});

router.on("location:put", async (location, ctx) => {
  await database.saveLocation(ctx.tenantId, location);
  return { status_code: 1000 };
});

router.on("cdr:post", async (cdr, ctx) => {
  await database.saveCdr(cdr);
  return { status_code: 1000 };
});
```

### Mount to your framework

```typescript
// Express
app.use(router.express());

// Bun / Cloudflare Workers
export default { fetch: router.fetch() };

// Raw Node.js
import { createServer } from "node:http";
createServer(router.node()).listen(3000);
```

---

## 3. OCPI Version Compatibility

### Receiving from a 2.1.1 partner (lenient mode)

```typescript
const router = new OCPIRouter({
  version: "2.2.1",
  schemaValidation: "lenient", // Accepts 2.1.1 payloads — logs warning, never rejects
  tokenAuth,
});
```

### Supporting both 2.1.1 and 2.2.1 partners on the same server

```typescript
const router221 = new OCPIRouter({ version: "2.2.1", schemaValidation: "strict-2.2.1", tokenAuth });
const router211 = new OCPIRouter({ version: "2.1.1", schemaValidation: "lenient", tokenAuth });

// Same handler works for both
const handleLocation = async (location, ctx) => {
  await db.upsert(location);
  return { status_code: 1000 };
};

router221.on("location:put", handleLocation);
router211.on("location:put", handleLocation);

// Express — each router only responds to its own URL version segment
app.use(router221.express()); // /ocpi/receiver/2.2.1/...
app.use(router211.express()); // /ocpi/receiver/2.1.1/...
```

---

## 4. Background Data Pump

`OcpiDataPump` automatically syncs partner data in the background using incremental `date_from` polling — no manual cron jobs.

```typescript
import { OcpiDataPump } from "ocpi-ts-sdk";

const pump = new OcpiDataPump(client, {
  intervalMs: 900_000,       // Poll every 15 minutes (default)
  syncLocations: true,        // Default: true
  syncTariffs: true,          // Default: true
  initialDateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // Start from 24h ago
});

pump.on("location:upsert", (location) => db.locations.upsert(location));
pump.on("tariff:upsert",   (tariff)   => db.tariffs.upsert(tariff));
pump.on("sync:complete",   (module, stats) => {
  console.log(`Synced ${stats.count} ${module} since ${stats.dateFrom}`);
});
pump.on("error", (err) => console.error("Sync failed:", err));

pump.start();

// Later, during graceful shutdown:
pump.stop();
```

---

## 5. Tariff Price Calculator

`OcpiCalculator` is a pure synchronous utility for estimating session costs — useful for driver-facing mobile apps.

Handles all OCPI tariff dimensions: `ENERGY`, `TIME`, `PARKING_TIME`, `FLAT`, and step-size rounding.

```typescript
import { OcpiCalculator } from "ocpi-ts-sdk";

const estimate = OcpiCalculator.estimateCost(tariff, {
  kwh: 25,          // Predicted energy
  hours: 1.5,       // Predicted charging time
  parkingHours: 0.5 // Predicted idle time after charging
});

console.log(estimate);
// { exclVat: 14.25, inclVat: 16.99, currency: "EUR" }
```

Returns the **maximum** estimate across all tariff elements — safe to show as "up to" cost to drivers.

---

## 6. OCPI Hub Routing

Configure the router as a **transparent HTTP proxy** for OCPI Hub deployments — routes requests between parties using `OCPI-to-*` headers.

```typescript
const hub = new OCPIRouter({
  version: "2.2.1",
  prefix: "/ocpi",
  mode: "HUB",
  tokenAuth,

  // Resolve the destination URL and token for a given party
  resolveHubDestination: async (sender, toCountryCode, toPartyId) => {
    const dest = await db.partners.find({ countryCode: toCountryCode, partyId: toPartyId });
    if (!dest) return null; // Returns 404 to sender
    return { baseUrl: dest.ocpiUrl, token: dest.tokenC };
  }
});
```

In HUB mode, the router:
1. Reads `OCPI-to-country-code` and `OCPI-to-party-id` headers
2. Calls `resolveHubDestination` to look up the recipient
3. Replaces the `Authorization` header with the destination token
4. Proxies the complete request (including body) transparently
5. Returns the destination's response unchanged to the original sender

---

## 7. SaaS Multi-Tenancy

```typescript
import { OcpiClientRegistry } from "ocpi-ts-sdk/registry";

const registry = new OcpiClientRegistry({
  maxSize: 5000,
  defaultConfig: { retries: 3, circuitBreaker: { failureThreshold: 5 } }
});

const client = registry.getOrCreate("tenant_acme", {
  versionsUrl: "https://partner.com/ocpi/versions",
  credentialsToken: "acme-secret",
  partyId: "ACM",
  countryCode: "NL"
});

await client.init();
console.log(registry.stats()); 
// { size: 1, maxSize: 5000, circuitOpenCount: 0, tenants: ['tenant_acme'] }
```

Use `prefix: "/ocpi/:tenantId"` in your router to automatically extract tenant context from the URL and pass it to every handler.

---

## 8. Resilience & Error Handling

```typescript
import { OcpiCircuitOpenError, OcpiRateLimitError, OcpiHttpError } from "ocpi-ts-sdk/errors";

try {
  await client.cdrs.push(myCdr, { idempotencyKey: myCdr.id });
} catch (error) {
  if (error instanceof OcpiCircuitOpenError) {
    // Partner hub is down — save to dead letter queue
  } else if (error instanceof OcpiRateLimitError) {
    // Back off and retry later
  } else if (error instanceof OcpiHttpError) {
    console.log(`HTTP ${error.httpStatus}: ${error.message}`);
  }
}
```

- **Circuit Breaker**: Trips OPEN after N failures, fast-fails for `cooldownMs`, then probes recovery via HALF_OPEN.
- **Rate Limiter**: Parses `X-Limit-Remaining` proactively. Respects `Retry-After` on 429.
- **Idempotency**: Pass `{ idempotencyKey }` to CDR/Session push methods to prevent duplicate push on retry.

---

## 9. Zod Schemas & Types

All OCPI types are Zod schemas — use them to validate your own models:

```typescript
import { LocationSchema, type Location } from "ocpi-ts-sdk";
// Or import directly from versioned path:
import { LocationSchema } from "ocpi-ts-sdk/schemas/v2.2.1/locations";

const myLocation: Location = { /* ... */ };
LocationSchema.parse(myLocation); // Throws detailed ZodError on failure
```

Schema folder structure:
```
schemas/
  common.ts          ← Shared version-agnostic types (GeoLocation, Price...)
  versions.ts        ← Version negotiation types
  index.ts           ← Re-exports everything from v2.2.1/
  v2.2.1/            ← OCPI 2.2.1 specific schemas
    locations.ts, sessions.ts, cdrs.ts, tariffs.ts,
    tokens.ts, commands.ts, credentials.ts
```

**Adding OCPI 3.0 later:** Create `schemas/v3.0/` and register `"3.0": v30SchemaMap` in the router — nothing else changes.

---

## 10. Logger Integration (Pino, Winston, etc.)

```typescript
import pino from "pino";
import type { OcpiLogger } from "ocpi-ts-sdk/logger";

const log = pino();
const myLogger: OcpiLogger = {
  info:  (msg, meta) => log.info(meta, msg),
  warn:  (msg, meta) => log.warn(meta, msg),
  error: (msg, meta) => log.error(meta, msg),
  debug: (msg, meta) => log.debug(meta, msg),
  trace: (msg, meta) => log.trace(meta, msg),
  child: (bindings) => createChildLogger(bindings), // required for registry
};

const client = new OCPIClient({ /* ... */, logging: { enabled: true, logger: myLogger } });
```
