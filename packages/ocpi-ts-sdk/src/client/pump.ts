import { EventEmitter } from "node:events";
import type { Location } from "../schemas/locations.js";
import type { Tariff } from "../schemas/tariffs.js";
import type { OCPIClient } from "./index.js";

export interface OcpiDataPumpConfig {
  /** Polling interval in milliseconds. Default: 15 minutes (900000ms) */
  intervalMs?: number;
  /** Initial date_from if this is the first time syncing. Default: 1 day ago */
  initialDateFrom?: Date;
  /** Sync Locations module incrementally. Default: true */
  syncLocations?: boolean;
  /** Sync Tariffs module incrementally. Default: true */
  syncTariffs?: boolean;
}

export interface OcpiDataPumpEvents {
  "location:upsert": [location: Location];
  "tariff:upsert": [tariff: Tariff];
  "sync:start": [module: "locations" | "tariffs"];
  "sync:complete": [
    module: "locations" | "tariffs",
    stats: { count: number; dateFrom: string },
  ];
  error: [err: Error];
}

export declare interface OcpiDataPump {
  on<E extends keyof OcpiDataPumpEvents>(
    event: E,
    listener: (...args: OcpiDataPumpEvents[E]) => void,
  ): this;
  emit<E extends keyof OcpiDataPumpEvents>(
    event: E,
    ...args: OcpiDataPumpEvents[E]
  ): boolean;
}

/**
 * OcpiDataPump: Automatic background state synchronization.
 *
 * Periodically polls the partner's OCPI `/locations` and `/tariffs` endpoints
 * using `date_from` pagination to only pull new or modified records,
 * emitting them natively as Node.js events.
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: Standard pattern for strongly typed EventEmitters
export class OcpiDataPump extends EventEmitter {
  private _timer: NodeJS.Timeout | null = null;
  private _isRunning = false;

  private _lastLocationSync: Date;
  private _lastTariffSync: Date;

  constructor(
    private readonly client: OCPIClient,
    private readonly config: OcpiDataPumpConfig = {},
  ) {
    super();
    const defaultDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    this._lastLocationSync = config.initialDateFrom ?? defaultDate;
    this._lastTariffSync = config.initialDateFrom ?? defaultDate;
  }

  /** Starts the background polling loop */
  public start() {
    if (this._isRunning) return;
    this._isRunning = true;

    // Fire immediately on start
    void this._runSyncLoop();
  }

  /** Stops the background polling loop */
  public stop() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._isRunning = false;
  }

  /** Retrieve the datetime of the last successful locations sync */
  public getLastLocationSync() {
    return this._lastLocationSync;
  }

  /** Retrieve the datetime of the last successful tariffs sync */
  public getLastTariffSync() {
    return this._lastTariffSync;
  }

  private async _runSyncLoop() {
    if (!this._isRunning) return;

    try {
      if (this.config.syncLocations !== false) {
        await this._syncLocations();
      }
      if (this.config.syncTariffs !== false) {
        await this._syncTariffs();
      }
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (this._isRunning) {
        const interval = this.config.intervalMs ?? 15 * 60 * 1000;
        this._timer = setTimeout(() => {
          void this._runSyncLoop();
        }, interval);
      }
    }
  }

  private async _syncLocations() {
    this.emit("sync:start", "locations");
    const dateFrom = this._lastLocationSync.toISOString();
    let count = 0;

    // We record the "start time" of this sync, so the next sync
    // catches anything modified during this potentially long pull.
    const newSyncDate = new Date();

    try {
      for await (const location of this.client.locations.stream({
        date_from: dateFrom,
      })) {
        this.emit("location:upsert", location);
        count++;
      }
      this._lastLocationSync = newSyncDate;
      this.emit("sync:complete", "locations", { count, dateFrom });
    } catch (error) {
      throw new Error(
        `Location sync failed starting from ${dateFrom}: ${String(error)}`,
      );
    }
  }

  private async _syncTariffs() {
    this.emit("sync:start", "tariffs");
    const dateFrom = this._lastTariffSync.toISOString();
    let count = 0;

    const newSyncDate = new Date();

    try {
      for await (const tariff of this.client.tariffs.stream({
        date_from: dateFrom,
      })) {
        this.emit("tariff:upsert", tariff);
        count++;
      }
      this._lastTariffSync = newSyncDate;
      this.emit("sync:complete", "tariffs", { count, dateFrom });
    } catch (error) {
      throw new Error(
        `Tariff sync failed starting from ${dateFrom}: ${String(error)}`,
      );
    }
  }
}
