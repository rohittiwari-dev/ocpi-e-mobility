import { OCPIClient } from "../client/index.js";
import type { OcpiClientConfig } from "../client/types.js";
import type { OcpiLogger } from "../logger/index.js";

export class OcpiRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcpiRegistryError";
  }
}

/**
 * OcpiClientRegistry — manages multiple OCPIClient instances for SaaS/multi-tenant deployments.
 *
 * Features:
 * - LRU eviction at configurable maxSize (memory-safe for thousands of tenants)
 * - Lazy instantiation via getOrCreate()
 * - Parallel initialization with concurrency limit
 * - Live stats for health endpoints
 * - Scoped child logger per tenant (if logger supports child())
 *
 * @example SaaS CSMS startup
 * const registry = new OcpiClientRegistry({ maxSize: 5000, logger });
 * for (const tenant of await db.tenants.findAllWithOcpi()) {
 *   registry.register(tenant.id, { versionsUrl: ..., credentialsToken: ..., ... });
 * }
 * await registry.initAll(20); // parallel init, max 20 at a time
 *
 * @example Per-request
 * const partner = registry.get(req.params.tenantId);
 * await partner.sessions.create(session);
 */
export class OcpiClientRegistry {
  private readonly clients = new Map<string, OCPIClient>();
  private readonly lruOrder: string[] = [];
  private readonly maxSize: number;
  private readonly defaultConfig?: Partial<OcpiClientConfig>;
  private readonly logger?: OcpiLogger;

  constructor(options?: {
    /**
     * Maximum number of clients to keep in memory.
     * When the limit is reached, the least-recently-used client is evicted.
     * Default: 1000
     */
    maxSize?: number;
    /**
     * Default config values merged into every registered client's config.
     * Useful for shared settings like version, logging, circuitBreaker.
     */
    defaultConfig?: Partial<OcpiClientConfig>;
    /** Logger — scoped per tenant via child() */
    logger?: OcpiLogger;
  }) {
    this.maxSize = options?.maxSize ?? 1000;
    this.defaultConfig = options?.defaultConfig;
    this.logger = options?.logger;
  }

  /**
   * Register a new tenant's OCPI partner connection.
   * If tenantId already exists, the client is replaced.
   */
  register(tenantId: string, config: OcpiClientConfig): this {
    const mergedConfig: OcpiClientConfig = {
      ...this.defaultConfig,
      ...config,
      tenantId,
      // Auto-scope logger per tenant if child() is available
      logging: {
        ...(this.defaultConfig?.logging ?? {}),
        ...config.logging,
        logger:
          config.logging?.logger ??
          (this.logger && typeof this.logger.child === "function"
            ? this.logger.child({ tenantId })
            : this.logger),
      },
    };

    if (this.clients.has(tenantId)) {
      this.clients.delete(tenantId);
      const idx = this.lruOrder.indexOf(tenantId);
      if (idx !== -1) this.lruOrder.splice(idx, 1);
    }

    // LRU eviction
    if (this.clients.size >= this.maxSize) {
      const evicted = this.lruOrder.shift();
      if (evicted) this.clients.delete(evicted);
    }

    this.clients.set(tenantId, new OCPIClient(mergedConfig));
    this.lruOrder.push(tenantId);
    return this;
  }

  /**
   * Get a registered client by tenantId.
   * Throws OcpiRegistryError if not found.
   * Touches LRU order on access.
   */
  get(tenantId: string): OCPIClient {
    const client = this.clients.get(tenantId);
    if (!client) {
      throw new OcpiRegistryError(
        `No OCPI client registered for tenant '${tenantId}'. Call registry.register() first.`,
      );
    }
    // Touch LRU — move to end (most recently used)
    const idx = this.lruOrder.indexOf(tenantId);
    if (idx !== -1) {
      this.lruOrder.splice(idx, 1);
      this.lruOrder.push(tenantId);
    }
    return client;
  }

  /**
   * Get an existing client or register and return a new one.
   * Useful for on-boarding new tenants without restart.
   *
   * @example
   * const partner = registry.getOrCreate(newTenant.id, {
   *   versionsUrl: newTenant.versionsUrl,
   *   credentialsToken: newTenant.token,
   *   ...
   * });
   * await partner.init();
   */
  getOrCreate(tenantId: string, config: OcpiClientConfig): OCPIClient {
    if (!this.clients.has(tenantId)) {
      this.register(tenantId, config);
    }
    return this.get(tenantId);
  }

  /** Returns true if a client is registered for this tenantId */
  has(tenantId: string): boolean {
    return this.clients.has(tenantId);
  }

  /**
   * Remove a tenant's client from the registry.
   * Call this when a tenant offboards their OCPI integration.
   */
  remove(tenantId: string): void {
    this.clients.delete(tenantId);
    const idx = this.lruOrder.indexOf(tenantId);
    if (idx !== -1) this.lruOrder.splice(idx, 1);
  }

  /**
   * Initialize all registered clients in parallel with a concurrency limit.
   * Returns settled results — failed inits don't block the rest.
   *
   * @param concurrency Max parallel inits (default: 10).
   *   Use a low value to avoid hammering all your partner hubs at once on restart.
   *
   * @example
   * const results = await registry.initAll(20);
   * const failed = results.filter(r => r.status === 'rejected');
   * console.warn(`${failed.length} partner init failures`);
   */
  async initAll(concurrency = 10): Promise<PromiseSettledResult<void>[]> {
    const entries = Array.from(this.clients.entries());
    const results: PromiseSettledResult<void>[] = [];

    // Process in chunks of `concurrency`
    for (let i = 0; i < entries.length; i += concurrency) {
      const chunk = entries.slice(i, i + concurrency);
      const chunkResults = await Promise.allSettled(
        chunk.map(([, client]) => client.init().then(() => undefined)),
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Live stats for your /health endpoint.
   *
   * @example
   * app.get('/health/ocpi', (req, res) => res.json(registry.stats()));
   */
  stats(): {
    size: number;
    maxSize: number;
    circuitOpenCount: number;
    tenants: string[];
  } {
    let circuitOpenCount = 0;
    for (const client of this.clients.values()) {
      // Access the circuit state via the client's internal circuit
      // @ts-expect-error accessing private field for stats
      if (client._circuit?.state === "OPEN") circuitOpenCount++;
    }

    return {
      size: this.clients.size,
      maxSize: this.maxSize,
      circuitOpenCount,
      tenants: [...this.lruOrder],
    };
  }

  /** Iterate all registered tenantIds */
  tenantIds(): string[] {
    return [...this.lruOrder];
  }
}
