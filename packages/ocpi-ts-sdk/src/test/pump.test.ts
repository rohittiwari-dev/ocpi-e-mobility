import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OCPIClient } from "../client/index.js";
import { OcpiDataPump } from "../client/pump.js";
import type { Location } from "../schemas/v2.2.1/locations.js";
import type { Tariff } from "../schemas/v2.2.1/tariffs.js";

const DUMMY_LOCATION: Location = {
  id: "LOC1",
  type: "ON_STREET",
  address: "Main St",
  city: "Berlin",
  country: "DEU",
  coordinates: { latitude: "52", longitude: "13" },
  time_zone: "Europe/Berlin",
  last_updated: new Date().toISOString(),
};

const DUMMY_TARIFF: Tariff = {
  id: "TAR1",
  currency: "EUR",
  elements: [],
  last_updated: new Date().toISOString(),
};

describe("OcpiDataPump", () => {
  let client: OCPIClient;
  let pump: OcpiDataPump;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new OCPIClient({
      versionsUrl: "http://partner.com/versions",
      credentialsToken: "secret",
      partyId: "CPO",
      countryCode: "DE",
    });

    // Mock the async generator streams
    client.locations.stream = async function* (_params) {
      yield DUMMY_LOCATION;
    };
    client.tariffs.stream = async function* (_params) {
      yield DUMMY_TARIFF;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    if (pump) pump.stop();
  });

  it("emits upsert events on first run and tracks completion", async () => {
    pump = new OcpiDataPump(client, { intervalMs: 10000 });

    const locations: Location[] = [];
    const tariffs: Tariff[] = [];
    let locCount = 0;

    pump.on("location:upsert", (loc) => locations.push(loc));
    pump.on("tariff:upsert", (tar) => tariffs.push(tar));
    pump.on("sync:complete", (mod, stats) => {
      if (mod === "locations") locCount = stats.count;
    });

    // Start triggers an async execution immediately
    pump.start();

    // Advance and flush microtasks so the async generators resolve
    await vi.advanceTimersByTimeAsync(0);

    expect(locations).toHaveLength(1);
    expect(locations[0].id).toBe("LOC1");

    expect(tariffs).toHaveLength(1);
    expect(tariffs[0].id).toBe("TAR1");

    expect(locCount).toBe(1);
  });

  it("updates lastSync dates after successful pull", async () => {
    pump = new OcpiDataPump(client);
    const initialDate = pump.getLastLocationSync();

    pump.start();
    await vi.advanceTimersByTimeAsync(0);

    const newDate = pump.getLastLocationSync();
    expect(newDate.getTime()).toBeGreaterThanOrEqual(initialDate.getTime());
  });

  it("polls repeatedly at the configured interval", async () => {
    pump = new OcpiDataPump(client, { intervalMs: 60000 }); // 1 min

    let runCount = 0;
    pump.on("sync:complete", (mod) => {
      if (mod === "locations") runCount++;
    });

    pump.start(); // Run 1
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(60000); // Run 2
    await vi.advanceTimersByTimeAsync(60000); // Run 3

    expect(runCount).toBe(3);
  });
});
