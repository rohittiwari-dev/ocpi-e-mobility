import { z } from "zod";

export const DisplayTextSchema = z.object({
  language: z.string().length(2).describe("Language Code ISO 639-1."),
  text: z.string().max(512),
});
export type DisplayText = z.infer<typeof DisplayTextSchema>;

export const PriceSchema = z.object({
  excl_vat: z.number().describe("Price/Cost excluding VAT."),
  incl_vat: z.number().optional().describe("Price/Cost including VAT."),
});
export type Price = z.infer<typeof PriceSchema>;

export const GeoLocationSchema = z.object({
  latitude: z.string().regex(/^-?[0-9]{1,2}\.[0-9]{5,7}$/),
  longitude: z.string().regex(/^-?[0-9]{1,3}\.[0-9]{5,7}$/),
});
export type GeoLocation = z.infer<typeof GeoLocationSchema>;

export const BusinessDetailsSchema = z.object({
  name: z.string().max(100),
  website: z.string().url().optional(),
  logo: z
    .object({
      url: z.string().url(),
      thumbnail: z.string().url().optional(),
      category: z.enum([
        "CHARGER",
        "ENTRANCE",
        "LOCATION",
        "NETWORK",
        "OPERATOR",
        "OTHER",
        "OWNER",
      ]),
      type: z.string().max(50),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
});
export type BusinessDetails = z.infer<typeof BusinessDetailsSchema>;
