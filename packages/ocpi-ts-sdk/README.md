# ocpi-ts-sdk

A production-grade, framework-agnostic, multi-tenant SDK for the **Open Charge Point Interface (OCPI)** protocol (2.2.1 and 2.1.1).

Designed to handle scale, resilient networking, and easy integration into any JavaScript/TypeScript runtime.

---

## Features

- **Full OCPI Protocol Support**: Covers Locations, Sessions, CDRs, Tariffs, Tokens, Commands, and Credentials.
- **Client & Receiver**: Includes both a resilient HTTP client (`OCPIClient`) and a framework-agnostic request router (`OCPIRouter`) for webhooks.
- **Multi-Tenant SaaS Ready**: Built-in `OcpiClientRegistry` for managing thousands of tenant connections with LRU caching and parallel initialization.
- **Resilience Standard**: Includes a 3-state Circuit Breaker, proactive Partner Rate Limiter (based on `X-Limit-*`), and automatic retry mechanisms.
- **Modern Paradigms**: Features `async *stream()` for memory-efficient pagination across large datasets.
- **Framework Agnostic**: The router works natively with Express, Fastify, Node.js `http`, Bun, and Cloudflare Workers via Web Standard API (`Request`/`Response`).
- **Bring Your Own Logger**: Compatible with `voltlog-io`, `pino`, `winston`, or falling back to a zero-dependency `console` logger. Auto-scopes logs per connection.

---

## Installation

```bash
npm install ocpi-ts-sdk
# or pnpm, yarn, bun
```

The package provides multiple subpath exports for clean, tree-shakeable imports:
- `ocpi-ts-sdk` (Main / Client)
- `ocpi-ts-sdk/router`
- `ocpi-ts-sdk/registry`
- `ocpi-ts-sdk/errors`
- `ocpi-ts-sdk/logger`
- `ocpi-ts-sdk/schemas/*`

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
  
  // Optional Resilience Configuration
  retries: 3,
  circuitBreaker: { failureThreshold: 5, cooldownMs: 60000 },
  logging: { enabled: true } // Connect your own logger here
});

// 1. Initialize to automatically discover all partner endpoints via the Versions handshake
await client.init();

// 2. Fetch data (Auto-paginated streaming)
for await (const location of client.locations.stream()) {
  console.log("Fetched location:", location.id);
}

// 3. Push data (Methods match the OCPI verbs)
await client.sessions.create({
  id: "SES123",
  status: "ACTIVE",
  // ...
});

// 4. Send Commands
const result = await client.commands.startSession({
  response_url: "https://my-system.com/ocpi/commands/callback",
  location_id: "LOC-1",
  token: { uid: "RFID123", type: "RFID" }
});
```

---

## 2. The Initial Handshake (Credentials)

Before communicating with a new partner, you typically need to exchange credentials. The SDK makes this simple:

```typescript
import { OCPIClient } from "ocpi-ts-sdk";

const client = new OCPIClient({
  versionsUrl: "https://partner.com/ocpi/versions",
  credentialsToken: "initial-token-from-partner",
  partyId: "CPO",
  countryCode: "DE",
});

await client.init();

// Register your server's endpoints with the partner
const credentials = await client.credentials.register({
  token: "your-new-token-for-the-partner",
  url: "https://my-system.com/ocpi/versions",
  roles: [{
    role: "CPO",
    party_id: "CPO",
    country_code: "DE",
    business_details: { name: "My CPO Network" }
  }]
});

console.log("Partner's new token to reach you:", credentials.token);
```

---

## 3. The OCPI Router (Webhooks & Server)

The `OCPIRouter` is a framework-agnostic handler for incoming OCPI requests. It handles token authentication, payload validation, routing, and tenant extraction.

```typescript
import { OCPIRouter } from "ocpi-ts-sdk/router";

const router = new OCPIRouter({
  version: "2.2.1",
  prefix: "/ocpi", // Or "/ocpi/:tenantId" for multi-tenancy
  
  // Authenticate incoming requests
  tokenAuth: async (token, tenantId) => {
    const partner = await database.getPartnerByToken(token);
    if (!partner) return null; // Automatically returns 401 Unauthorized
    
    return {
      partyId: partner.partyId,
      countryCode: partner.countryCode,
      tenantId: tenantId
    };
  }
});

// Register strongly-typed handlers
router.on("location:put", async (location, ctx) => {
  console.log(`Received PUT from ${ctx.partner.partyId} for ${location.id}`);
  await database.saveLocation(ctx.tenantId, location);
  
  return { status_code: 1000, status_message: "Success" };
});

router.on("cdr:post", async (cdr, ctx) => {
  await database.saveCdr(cdr);
  return { status_code: 1000, status_message: "Accepted" };
});
```

### Mount the Router to your Framework

**Express:**
```typescript
import express from 'express';
const app = express();
app.use(express.json()); // Required
app.use(router.express()); // Mount the router adapter
app.listen(3000);
```

**Bun / Cloudflare Workers (Web Standard Fetch):**
```typescript
export default {
  async fetch(request: Request) {
    if (new URL(request.url).pathname.startsWith("/ocpi")) {
      return router.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  }
}
```

---

## 4. SaaS & Enterprise Scale (Multi-Tenancy)

If you are building an e-mobility SaaS platform (like a CSMS or EMSS), you likely need to maintain connections to hundreds or thousands of external OCPI partners on behalf of your tenants.

**Do not manually instantiate clients.** Use the `OcpiClientRegistry`.

```typescript
import { OcpiClientRegistry } from "ocpi-ts-sdk/registry";
import { voltLogger } from "voltlog-io"; 

const registry = new OcpiClientRegistry({
  maxSize: 5000, // LRU Cache size — keeps memory flat
  logger: voltLogger, // Automatically creates scoped child loggers per tenant
  defaultConfig: {
    retries: 3,
    circuitBreaker: { failureThreshold: 5 }
  }
});

// Get or dynamically initialize a client for a specific tenant
// Under the hood, this caches the connection and immediately handles discovery.
const client = registry.getOrCreate("tenant_acme", {
  versionsUrl: "https://partner.com/ocpi/versions",
  credentialsToken: "acme-secret",
  partyId: "ACM",
  countryCode: "NL"
});

await client.init();
const evses = await client.locations.pull();

// Monitor connection health across your platform
setInterval(() => {
  console.log(registry.stats()); 
  // { size: 1, maxSize: 5000, circuitOpenCount: 0, tenants: ['tenant_acme'] }
}, 60000);
```

By prefixing your router paths with `:tenantId` (e.g., `/ocpi/:tenantId/receiver/2.2.1`), `OCPIRouter` will automatically extract the tenant and pass it to your handlers alongside the payload, completing the two-way multi-tenant loop.

---

## 5. Advanced Resilience

The SDK is designed to survive unstable roaming hubs and partner systems.

1. **Circuit Breaker**: If a partner's endpoint fails 5 times continuously, the state trips to `OPEN`. The SDK immediately fails-fast with `OcpiCircuitOpenError` for the next 60 seconds (preventing request pileups on your server), before transitioning to `HALF_OPEN` to test recovery.
2. **Proactive Rate Limiting**: The client parses OCPI `X-Limit` and `X-Limit-Remaining` headers. It emits warnings when approaching limits and natively halts requests via `Retry-After` headers if `429 Too Many Requests` is hit.
3. **Idempotency**: Critical modules like `cdrs` accept an `idempotencyKey` option.

```typescript
await client.cdrs.push(myCdr, { idempotencyKey: myCdr.id });
```

---

## 6. Error Handling

Catch and distinguish exact OCPI failures using the provided error classes.

```ts
import { OcpiError, OcpiHttpError, OcpiCircuitOpenError, OcpiRateLimitError } from "ocpi-ts-sdk/errors";

try {
  await client.cdrs.push(myCdr, { idempotencyKey: myCdr.id });
} catch (error) {
  if (error instanceof OcpiCircuitOpenError) {
    console.log("Partner Hub is down. Saving CDR to Dead Letter Queue.");
  } else if (error instanceof OcpiRateLimitError) {
    console.log("Hit rate limit. They want us to back off.");
  } else if (error instanceof OcpiHttpError) {
    console.log(`HTTP ${error.httpStatus} from partner: ${error.message}`);
  } else if (error instanceof OcpiError) {
    console.log(`OCPI Application Error: ${error.statusCode} - ${error.statusMessage}`);
  } else {
    console.log("Unknown network/system error", error);
  }
}
```

---

## 7. Additional Patterns

### Manual Pagination
If you don't want to use the async generator `stream()` (e.g. for a UI that pages 10 items at a time), you can manually pull pages:

```typescript
const page1 = await client.locations.pull({ limit: 10, offset: 0 });
console.log(`Viewing 10 out of ${page1.totalCount} locations`);

// Fetch next page automatically using the 'Link' header provided by partner
const page2 = await page1.nextPage();
```

### Raw Node.js / Fastify Router Integration
If you aren't using Express or Web Standard `fetch`, you can use the generic Node.js adapter which accepts standard `IncomingMessage` and `ServerResponse`:

```typescript
import { createServer } from "node:http";

const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/ocpi")) {
    await router.node()(req, res);
    return;
  }
  res.statusCode = 404;
  res.end();
});
```

### Bring Your Own Logger (Pino, Winston, etc.)
The SDK uses a standard logging interface. You can map your favorite logger (like Pino) natively, so SDK logs are merged seamlessly into your application's JSON logs:

```typescript
import pino from "pino";
import type { OcpiLogger } from "ocpi-ts-sdk/logger";

const myPino = pino();
const myLogger: OcpiLogger = {
  info: (msg, meta) => myPino.info(meta, msg),
  warn: (msg, meta) => myPino.warn(meta, msg),
  error: (msg, meta) => myPino.error(meta, msg),
  debug: (msg, meta) => myPino.debug(meta, msg),
  trace: (msg, meta) => myPino.trace(meta, msg),
  // Essential for OcpiClientRegistry multi-tenancy logs
  child: (bindings) => createMyChildLogger(bindings), 
};

const client = new OCPIClient({
  // ...config
  logging: { enabled: true, logger: myLogger }
});
```

### Raw OCPI Zod Schemas
Every OCPI 2.2.1 payload type and Zod schema is exported, allowing you to validate your own internal database models against strict OCPI requirements:

```typescript
import { LocationSchema, type Location } from "ocpi-ts-sdk/schemas/locations";
import { TariffSchema } from "ocpi-ts-sdk/schemas/tariffs";
import { StartSessionSchema } from "ocpi-ts-sdk/schemas/commands";

const myLocation: Location = { ... };

// Throws detailed ZodError if you missed required fields or formatting
LocationSchema.parse(myLocation); 
```
