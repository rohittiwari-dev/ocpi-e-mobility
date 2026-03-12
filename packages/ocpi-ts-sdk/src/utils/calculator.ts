import type { Tariff } from "../schemas/v2.2.1/tariffs.js";

export interface CostEstimateOptions {
  /** The estimated energy drawn in kilowatt-hours (kWh) */
  kwh: number;
  /** The estimated time spent charging in hours */
  hours: number;
  /** The estimated time spent parked but not charging in hours (default: 0) */
  parkingHours?: number;
}

export interface CostEstimate {
  /** The estimated total cost excluding VAT */
  exclVat: number;
  /** The estimated total cost including VAT */
  inclVat: number;
  /** The currency of the estimate */
  currency: string;
}

/**
 * OcpiCalculator is a stateless pure-math utility for working with OCPI data.
 * It's main purpose is to estimate charging session costs for UI presentation to drivers.
 */
export const OcpiCalculator = {
  /**
   * Estimates the cost of a charging session based on an OCPI Tariff.
   *
   * Note: OCPI Tariffs can have complex `restrictions` (e.g., limits on start_time,
   * max_kwh, max_duration). This estimator simplifies the logic by evaluating
   * ALL elements and returning the **highest** realistic estimate, which is generally
   * safer to display to a user as a "maximum estimated cost" rather than undercharging.
   */
  estimateCost(tariff: Tariff, options: CostEstimateOptions): CostEstimate {
    const { kwh, hours, parkingHours = 0 } = options;

    let maxExclVat = 0;
    let maxInclVat = 0;

    // Evaluate each TariffElement separately. In reality, multiple elements
    // might apply sequentially over a session depending on time of day.
    // For a basic UI estimate, we calculate each element's theoretical total
    // across the whole session, and pick the highest one.
    for (const element of tariff.elements) {
      let exclVat = 0;
      let inclVat = 0;

      for (const comp of element.price_components) {
        let quantity = 0;

        // OCPI 2.2.1 prices are defined as:
        // ENERGY: per kWh
        // TIME: per hour
        // PARKING_TIME: per hour
        // FLAT: per session
        switch (comp.type) {
          case "ENERGY":
            quantity = kwh;
            // Apply step_size rounding if defined
            if (comp.step_size) {
              const steps = Math.ceil(quantity / comp.step_size);
              quantity = steps * comp.step_size;
            }
            break;
          case "TIME":
            quantity = hours;
            // Time step_size is in seconds, so we convert hours to seconds, step, then back to hours
            if (comp.step_size) {
              const seconds = quantity * 3600;
              const steps = Math.ceil(seconds / comp.step_size);
              quantity = (steps * comp.step_size) / 3600;
            }
            break;
          case "PARKING_TIME":
            quantity = parkingHours;
            if (comp.step_size) {
              const seconds = quantity * 3600;
              const steps = Math.ceil(seconds / comp.step_size);
              quantity = (steps * comp.step_size) / 3600;
            }
            break;
          case "FLAT":
            quantity = 1; // Flat is applied exactly once
            break;
        }

        const compExclVat = quantity * comp.price;
        const compInclVat = comp.vat
          ? compExclVat * (1 + comp.vat / 100)
          : compExclVat; // assume 0% VAT if loosely omitted

        exclVat += compExclVat;
        inclVat += compInclVat;
      }

      if (inclVat > maxInclVat) {
        maxExclVat = exclVat;
        maxInclVat = inclVat;
      }
    }

    return {
      // Round to 4 decimal places which is standard for OCPI prices
      exclVat: Math.round(maxExclVat * 10000) / 10000,
      inclVat: Math.round(maxInclVat * 10000) / 10000,
      currency: tariff.currency,
    };
  },
};
