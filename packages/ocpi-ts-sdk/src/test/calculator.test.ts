import { describe, expect, it } from "vitest";
import type { Tariff } from "../schemas/tariffs.js";
import { OcpiCalculator } from "../utils/calculator.js";

describe("OcpiCalculator", () => {
  it("calculates simple ENERGY and FLAT mixed tariffs", () => {
    const tariff: Tariff = {
      id: "T1",
      currency: "EUR",
      last_updated: new Date().toISOString(),
      elements: [
        {
          price_components: [
            { type: "FLAT", price: 2.0, vat: 10, step_size: 1 },
            { type: "ENERGY", price: 0.5, vat: 10, step_size: 1 },
          ],
        },
      ],
    };

    const estimate = OcpiCalculator.estimateCost(tariff, {
      kwh: 10,
      hours: 1,
    });

    // FLAT: qty 1, price 2.0 = 2.0
    // ENERGY: qty 10, price 0.5 = 5.0
    // exclVat = 7.0
    // inclVat = 7.0 * 1.10 = 7.7
    expect(estimate.exclVat).toBe(7);
    expect(estimate.inclVat).toBe(7.7);
  });

  it("applies step_size rounding to ENERGY, TIME, and PARKING", () => {
    const tariff: Tariff = {
      id: "T2",
      currency: "EUR",
      last_updated: new Date().toISOString(),
      elements: [
        {
          price_components: [
            { type: "ENERGY", price: 1.0, step_size: 2 }, // €1 per kWh in chunks of 2kWh
            { type: "TIME", price: 10.0, step_size: 1800 }, // €10/hr in chunks of 30 mins
          ],
        },
      ],
    };

    const estimate = OcpiCalculator.estimateCost(tariff, {
      kwh: 5.1, // rounds up to 6 due to step_size=2
      hours: 1.2, // 1.2 hrs = 4320s. rounds up to 3 x 1800s = 5400s = 1.5 hrs
    });

    // ENERGY: 6 kWh * €1 = €6
    // TIME: 1.5 hrs * €10 = €15
    // exclVat = 21
    expect(estimate.exclVat).toBe(21);
  });

  it("selects the most expensive element when multiple exist", () => {
    const tariff: Tariff = {
      id: "T3",
      currency: "EUR",
      last_updated: new Date().toISOString(),
      elements: [
        {
          price_components: [{ type: "ENERGY", price: 0.2, step_size: 1 }],
        },
        {
          price_components: [{ type: "ENERGY", price: 0.6, step_size: 1 }], // Highest
        },
      ],
    };

    const estimate = OcpiCalculator.estimateCost(tariff, { kwh: 10, hours: 1 });
    // 10 kwh * 0.6 = 6.0
    expect(estimate.exclVat).toBe(6);
  });
});
