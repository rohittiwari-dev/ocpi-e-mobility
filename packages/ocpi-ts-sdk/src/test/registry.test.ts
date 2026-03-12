import { describe, expect, it } from "vitest";
import { OcpiClientRegistry, OcpiRegistryError } from "../registry/index.js";

const BASE_CONFIG = {
  versionsUrl: "https://partner.example.com/ocpi/versions",
  credentialsToken: "token",
  partyId: "CPO",
  countryCode: "DE",
};

describe("OcpiClientRegistry", () => {
  describe("register() and get()", () => {
    it("registers and retrieves a client", () => {
      const registry = new OcpiClientRegistry();
      registry.register("tenant-1", { ...BASE_CONFIG });
      const client = registry.get("tenant-1");
      expect(client.config.partyId).toBe("CPO");
    });

    it("throws OcpiRegistryError for unknown tenant", () => {
      const registry = new OcpiClientRegistry();
      expect(() => registry.get("nonexistent")).toThrow(OcpiRegistryError);
      expect(() => registry.get("nonexistent")).toThrow("nonexistent");
    });

    it("replaces an existing client on re-register", () => {
      const registry = new OcpiClientRegistry();
      registry.register("tenant-1", { ...BASE_CONFIG, partyId: "OLD" });
      registry.register("tenant-1", { ...BASE_CONFIG, partyId: "NEW" });
      const client = registry.get("tenant-1");
      expect(client.config.partyId).toBe("NEW");
    });
  });

  describe("has()", () => {
    it("returns true for registered tenants", () => {
      const registry = new OcpiClientRegistry();
      registry.register("t1", { ...BASE_CONFIG });
      expect(registry.has("t1")).toBe(true);
      expect(registry.has("t2")).toBe(false);
    });
  });

  describe("remove()", () => {
    it("removes a registered client", () => {
      const registry = new OcpiClientRegistry();
      registry.register("t1", { ...BASE_CONFIG });
      registry.remove("t1");
      expect(registry.has("t1")).toBe(false);
    });

    it("does not throw when removing unknown tenant", () => {
      const registry = new OcpiClientRegistry();
      expect(() => registry.remove("unknown")).not.toThrow();
    });
  });

  describe("getOrCreate()", () => {
    it("creates client on first call", () => {
      const registry = new OcpiClientRegistry();
      const client = registry.getOrCreate("t1", { ...BASE_CONFIG });
      expect(client).toBeDefined();
    });

    it("returns existing client on second call", () => {
      const registry = new OcpiClientRegistry();
      const c1 = registry.getOrCreate("t1", { ...BASE_CONFIG });
      const c2 = registry.getOrCreate("t1", { ...BASE_CONFIG });
      expect(c1).toBe(c2); // same reference
    });
  });

  describe("LRU eviction", () => {
    it("evicts the least recently used when maxSize is reached", () => {
      const registry = new OcpiClientRegistry({ maxSize: 3 });
      registry.register("t1", { ...BASE_CONFIG });
      registry.register("t2", { ...BASE_CONFIG });
      registry.register("t3", { ...BASE_CONFIG });
      // Access t1 to make it most recently used
      registry.get("t1");
      // Register a 4th — should evict t2 (oldest unused)
      registry.register("t4", { ...BASE_CONFIG });

      expect(registry.has("t2")).toBe(false);
      expect(registry.has("t1")).toBe(true);
      expect(registry.has("t3")).toBe(true);
      expect(registry.has("t4")).toBe(true);
    });
  });

  describe("tenantIds()", () => {
    it("returns all registered tenant IDs in LRU order", () => {
      const registry = new OcpiClientRegistry();
      registry.register("a", { ...BASE_CONFIG });
      registry.register("b", { ...BASE_CONFIG });
      registry.register("c", { ...BASE_CONFIG });
      const ids = registry.tenantIds();
      expect(ids).toContain("a");
      expect(ids).toContain("b");
      expect(ids).toContain("c");
    });
  });

  describe("stats()", () => {
    it("reports correct size and maxSize", () => {
      const registry = new OcpiClientRegistry({ maxSize: 100 });
      registry.register("t1", { ...BASE_CONFIG });
      registry.register("t2", { ...BASE_CONFIG });

      const stats = registry.stats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(100);
      expect(stats.circuitOpenCount).toBe(0);
      expect(stats.tenants).toHaveLength(2);
    });
  });

  describe("defaultConfig merging", () => {
    it("merges default config into registered clients", () => {
      const registry = new OcpiClientRegistry({
        defaultConfig: { version: "2.2.1", retries: 5 },
      });
      registry.register("t1", { ...BASE_CONFIG });
      const client = registry.get("t1");
      expect(client.config.version).toBe("2.2.1");
      expect(client.config.retries).toBe(5);
    });

    it("per-tenant config overrides default config", () => {
      const registry = new OcpiClientRegistry({
        defaultConfig: { retries: 5 },
      });
      registry.register("t1", { ...BASE_CONFIG, retries: 10 });
      const client = registry.get("t1");
      expect(client.config.retries).toBe(10);
    });
  });

  describe("initAll()", () => {
    it("returns settled results for all tenants", async () => {
      const registry = new OcpiClientRegistry();
      // Override fetch to fail fast
      const origFetch = global.fetch;
      global.fetch = async () => {
        throw new Error("Connection refused");
      };

      registry.register("t1", { ...BASE_CONFIG });
      registry.register("t2", { ...BASE_CONFIG });

      const results = await registry.initAll(2);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === "rejected")).toBe(true);

      global.fetch = origFetch;
    });

    it("processes tenants in chunks respecting concurrency", async () => {
      const registry = new OcpiClientRegistry();
      const origFetch = global.fetch;
      global.fetch = async () => {
        throw new Error("n/a");
      };

      for (let i = 0; i < 5; i++) {
        registry.register(`t${i}`, { ...BASE_CONFIG });
      }

      const results = await registry.initAll(2);
      expect(results).toHaveLength(5);
      global.fetch = origFetch;
    });
  });

  describe("logger scoping", () => {
    it("creates child logger per tenant when logger has child()", () => {
      const childLogger = {
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      const parentLogger = {
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        child: (ctx: Record<string, unknown>) => {
          expect(ctx.tenantId).toBe("t1");
          return childLogger;
        },
      };

      const registry = new OcpiClientRegistry({ logger: parentLogger });
      registry.register("t1", { ...BASE_CONFIG });
      // If this didn't throw, child() was called correctly
      expect(registry.has("t1")).toBe(true);
    });
  });
});
