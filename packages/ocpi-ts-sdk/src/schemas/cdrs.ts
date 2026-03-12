import { z } from "zod";
import { PriceSchema } from "./common.js";
import { ChargingPeriodSchema } from "./sessions.js";

export const SignedDataSchema = z.object({
  encoding_method: z.string().max(36),
  encoding_method_version: z.number().optional(),
  logical_address: z.string().max(255).optional(),
  url: z.string().url().max(512),
});
export type SignedData = z.infer<typeof SignedDataSchema>;

export const CdrSchema = z.object({
  id: z.string().max(36),
  start_date_time: z.string().datetime(),
  end_date_time: z.string().datetime(),
  session_id: z.string().max(36),
  cdr_token: z.object({
    uid: z.string().max(36),
    type: z.enum(["AD_HOC_USER", "APP_USER", "OTHER", "RFID"]),
    contract_id: z.string().max(36),
  }),
  auth_method: z.enum(["AUTH_REQUEST", "COMMAND", "WHITELIST"]),
  auth_id: z.string().max(36),
  location_id: z.string().max(36),
  evse_uid: z.string().max(36),
  connector_id: z.string().max(36),
  meter_id: z.string().max(255).optional(),
  currency: z.string().length(3),
  tariffs: z.array(z.any()).optional(), // TariffSchema
  charging_periods: z.array(ChargingPeriodSchema),
  signed_data: SignedDataSchema.optional(),
  total_cost: PriceSchema,
  total_energy: z.number(),
  total_time: z.number(),
  total_parking_time: z.number().optional(),
  remark: z.string().max(255).optional(),
  last_updated: z.string().datetime(),
});
export type Cdr = z.infer<typeof CdrSchema>;
