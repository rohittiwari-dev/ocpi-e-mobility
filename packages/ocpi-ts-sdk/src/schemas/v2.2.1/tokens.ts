import { z } from "zod";

export const LocationReferencesSchema = z.object({
  location_id: z.string().max(36),
  evse_uids: z.array(z.string().max(36)).optional(),
});
export type LocationReferences = z.infer<typeof LocationReferencesSchema>;

export const TokenSchema = z.object({
  country_code: z.string().length(2),
  party_id: z.string().length(3),
  uid: z.string().max(36),
  type: z.enum(["AD_HOC_USER", "APP_USER", "OTHER", "RFID"]),
  contract_id: z.string().max(36),
  visual_number: z.string().max(64).optional(),
  issuer: z.string().max(64),
  group_id: z.string().max(36).optional(),
  valid: z.boolean(),
  whitelist: z.enum(["ALWAYS", "ALLOWED", "ALLOWED_OFFLINE", "NEVER"]),
  language: z.string().length(2).optional(),
  default_profile_type: z
    .enum(["CHEAP", "FAST", "GREEN", "REGULAR"])
    .optional(),
  energy_contract: z.any().optional(),
  last_updated: z.string().datetime(),
});
export type Token = z.infer<typeof TokenSchema>;

export const TokenPatchSchema = TokenSchema.partial().required({
  last_updated: true,
});
export type TokenPatch = z.infer<typeof TokenPatchSchema>;
