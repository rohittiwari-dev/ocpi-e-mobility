import { z } from "zod";
import {
  BusinessDetailsSchema,
  DisplayTextSchema,
  GeoLocationSchema,
} from "./common.js";

export const ConnectorSchema = z.object({
  id: z.string().max(36),
  standard: z.enum([
    "CHADEMO",
    "DOMESTIC_A",
    "DOMESTIC_B",
    "DOMESTIC_C",
    "DOMESTIC_D",
    "DOMESTIC_E",
    "DOMESTIC_F",
    "DOMESTIC_G",
    "DOMESTIC_H",
    "DOMESTIC_I",
    "DOMESTIC_J",
    "DOMESTIC_K",
    "DOMESTIC_L",
    "IEC_60309_2_single_16",
    "IEC_60309_2_three_16",
    "IEC_60309_2_three_32",
    "IEC_60309_2_three_64",
    "IEC_62196_T1",
    "IEC_62196_T1_COMBO",
    "IEC_62196_T2",
    "IEC_62196_T2_COMBO",
    "IEC_62196_T3A",
    "IEC_62196_T3C",
    "PANTOGRAPH_BOTTOM_UP",
    "PANTOGRAPH_TOP_DOWN",
    "TESLA_R",
    "TESLA_S",
    "UNKNOWN",
  ]),
  format: z.enum(["CABLE", "SOCKET"]),
  power_type: z.enum(["AC_1_PHASE", "AC_2_PHASE", "AC_3_PHASE", "DC"]),
  voltage: z.number(),
  amperage: z.number(),
  max_power: z.number(),
  tariff_ids: z.array(z.string().max(36)).optional(),
  terms_and_conditions: z.string().url().optional(),
  last_updated: z.string().datetime(),
});
export type Connector = z.infer<typeof ConnectorSchema>;

export const EvseSchema = z.object({
  uid: z.string().max(36),
  evse_id: z.string().max(48).optional(),
  status: z.enum([
    "AVAILABLE",
    "BLOCKED",
    "CHARGING",
    "INOPERATIVE",
    "OUTOFORDER",
    "PLANNED",
    "REMOVED",
    "RESERVED",
    "UNKNOWN",
  ]),
  status_schedule: z
    .array(
      z.object({
        period_begin: z.string().datetime(),
        period_end: z.string().datetime().optional(),
        status: z.enum([
          "AVAILABLE",
          "BLOCKED",
          "CHARGING",
          "INOPERATIVE",
          "OUTOFORDER",
          "PLANNED",
          "REMOVED",
          "RESERVED",
          "UNKNOWN",
        ]),
      }),
    )
    .optional(),
  capabilities: z
    .array(
      z.enum([
        "CREDIT_CARD_PAYABLE",
        "DEBIT_CARD_PAYABLE",
        "PEDESTRIAN_NAVI",
        "REMOTE_START_STOP_CAPABLE",
        "RESERVABLE",
        "RFID_READER",
        "TOKEN_GROUP_CAPABLE",
        "UNLOCK_CAPABLE",
      ]),
    )
    .optional(),
  connectors: z.array(ConnectorSchema).min(1),
  floor_level: z.string().max(4).optional(),
  coordinates: GeoLocationSchema.optional(),
  physical_reference: z.string().max(16).optional(),
  directions: z.array(DisplayTextSchema).optional(),
  parking_restrictions: z
    .array(
      z.enum(["EV_ONLY", "PLUGGED", "DISABLED", "CUSTOMERS", "MOTORCYCLES"]),
    )
    .optional(),
  images: z.array(z.any()).optional(), // ImageSchema to be added if needed
  last_updated: z.string().datetime(),
});
export type Evse = z.infer<typeof EvseSchema>;

export const LocationSchema = z.object({
  id: z.string().max(36),
  type: z.enum([
    "ON_STREET",
    "PARKING_GARAGE",
    "UNDERGROUND_GARAGE",
    "PARKING_LOT",
    "OTHER",
    "UNKNOWN",
  ]),
  name: z.string().max(255).optional(),
  address: z.string().max(45),
  city: z.string().max(45),
  postal_code: z.string().max(10).optional(),
  country: z.string().length(3),
  coordinates: GeoLocationSchema,
  related_locations: z.array(z.any()).optional(), // AdditionalGeoLocationSchema to be added
  evses: z.array(EvseSchema).optional(),
  directions: z.array(DisplayTextSchema).optional(),
  operator: BusinessDetailsSchema.optional(),
  suboperator: BusinessDetailsSchema.optional(),
  owner: BusinessDetailsSchema.optional(),
  facilities: z
    .array(
      z.enum([
        "HOTEL",
        "RESTAURANT",
        "CAFE",
        "MALL",
        "SUPERMARKET",
        "SPORT",
        "RECREATION_AREA",
        "NATURE",
        "MUSEUM",
        "BIKE_SHARING",
        "LOCAL_TRAIN_STATION",
        "TRAIN_STATION",
        "AIRPORT",
        "CARPOOL_PARKING",
        "FUEL_STATION",
        "WIFI",
      ]),
    )
    .optional(),
  time_zone: z.string().max(255),
  opening_times: z.any().optional(), // HoursSchema to be added
  charging_when_closed: z.boolean().optional(),
  images: z.array(z.any()).optional(), // ImageSchema
  energy_mix: z.any().optional(), // EnergyMixSchema
  last_updated: z.string().datetime(),
});
export type Location = z.infer<typeof LocationSchema>;
