import { z } from "zod";

export const CredentialsRoleSchema = z.object({
  role: z.enum(["CPO", "EMSP", "HUB", "NAP", "NSP", "OTHER", "SCSP"]),
  business_details: z.any(), // BusinessDetailsSchema is in common.js, but avoiding circular dep here. Can be just basic struct
  party_id: z.string().length(3),
  country_code: z.string().length(2),
});
export type CredentialsRole = z.infer<typeof CredentialsRoleSchema>;

export const CredentialsSchema = z.object({
  token: z.string().max(64),
  url: z.string().url(),
  roles: z.array(CredentialsRoleSchema),
});
export type Credentials = z.infer<typeof CredentialsSchema>;
