import { z } from "zod";

export const VersionSchema = z.object({
  version: z.string().max(20),
  url: z.string().url(),
});
export type Version = z.infer<typeof VersionSchema>;

export const EndpointSchema = z.object({
  identifier: z.enum([
    "cdrs",
    "chargingprofiles",
    "commands",
    "credentials",
    "hubclientinfo",
    "locations",
    "sessions",
    "tariffs",
    "tokens",
  ]),
  role: z.enum(["SENDER", "RECEIVER"]),
  url: z.string().url(),
});
export type Endpoint = z.infer<typeof EndpointSchema>;

export const VersionDetailSchema = z.object({
  version: z.string().max(20),
  endpoints: z.array(EndpointSchema),
});
export type VersionDetail = z.infer<typeof VersionDetailSchema>;
