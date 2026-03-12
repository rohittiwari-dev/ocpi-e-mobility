import { z } from "zod";
import { PriceSchema } from "../common.js";

export const ChargingPeriodSchema = z.object({
  start_date_time: z.string().datetime(),
  dimensions: z.array(
    z.object({
      type: z.enum([
        "CURRENT",
        "ENERGY",
        "ENERGY_EXPORT",
        "ENERGY_IMPORT",
        "MAX_CURRENT",
        "MIN_CURRENT",
        "MAX_POWER",
        "MIN_POWER",
        "PARKING_TIME",
        "POWER",
        "TIME",
      ]),
      volume: z.number(),
    }),
  ),
  tariff_id: z.string().max(36).optional(),
});
export type ChargingPeriod = z.infer<typeof ChargingPeriodSchema>;

export const SessionSchema = z.object({
  id: z.string().max(36),
  start_date_time: z.string().datetime(),
  end_date_time: z.string().datetime().optional(),
  kwh: z.number(),
  cdr_id: z.string().max(36).optional(),
  auth_method: z.enum(["AUTH_REQUEST", "COMMAND", "WHITELIST"]),
  auth_id: z.string().max(36),
  location_id: z.string().max(36),
  evse_uid: z.string().max(36),
  connector_id: z.string().max(36),
  meter_id: z.string().max(255).optional(),
  currency: z.string().length(3),
  charging_periods: z.array(ChargingPeriodSchema).optional(),
  total_cost: PriceSchema.optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "INVALID", "PENDING"]),
  last_updated: z.string().datetime(),
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionPatchSchema = SessionSchema.partial().required({
  last_updated: true,
});
export type SessionPatch = z.infer<typeof SessionPatchSchema>;
