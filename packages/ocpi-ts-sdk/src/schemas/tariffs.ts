import { z } from "zod";
import { DisplayTextSchema, PriceSchema } from "./common.js";

export const PriceComponentSchema = z.object({
  type: z.enum(["ENERGY", "FLAT", "PARKING_TIME", "TIME"]),
  price: z.number(),
  step_size: z.number(),
});
export type PriceComponent = z.infer<typeof PriceComponentSchema>;

export const TariffElementSchema = z.object({
  price_components: z.array(PriceComponentSchema).min(1),
  restrictions: z
    .object({
      start_time: z
        .string()
        .regex(/^[0-2][0-9]:[0-5][0-9]$/)
        .optional(),
      end_time: z
        .string()
        .regex(/^[0-2][0-9]:[0-5][0-9]$/)
        .optional(),
      start_date: z
        .string()
        .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
        .optional(),
      end_date: z
        .string()
        .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
        .optional(),
      min_kwh: z.number().optional(),
      max_kwh: z.number().optional(),
      min_power: z.number().optional(),
      max_power: z.number().optional(),
      min_duration: z.number().optional(),
      max_duration: z.number().optional(),
      day_of_week: z
        .array(
          z.enum([
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
          ]),
        )
        .optional(),
    })
    .optional(),
});
export type TariffElement = z.infer<typeof TariffElementSchema>;

export const TariffSchema = z.object({
  id: z.string().max(36),
  currency: z.string().length(3),
  elements: z.array(TariffElementSchema).min(1),
  tariff_alt_text: z.array(DisplayTextSchema).optional(),
  tariff_alt_url: z.string().url().optional(),
  min_price: PriceSchema.optional(),
  max_price: PriceSchema.optional(),
  last_updated: z.string().datetime(),
});
export type Tariff = z.infer<typeof TariffSchema>;
