import { z } from "zod";
import { TokenSchema } from "./tokens.js";

export const CancelReservationSchema = z.object({
  response_url: z.string().url(),
  reservation_id: z.string().max(36),
});
export type CancelReservation = z.infer<typeof CancelReservationSchema>;

export const ReserveNowSchema = z.object({
  response_url: z.string().url(),
  token: TokenSchema,
  expiry_date: z.string().datetime(),
  reservation_id: z.string().max(36),
  location_id: z.string().max(36),
  evse_uid: z.string().max(36).optional(),
  authorization_reference: z.string().max(36).optional(),
});
export type ReserveNow = z.infer<typeof ReserveNowSchema>;

export const StartSessionSchema = z.object({
  response_url: z.string().url(),
  token: TokenSchema,
  location_id: z.string().max(36),
  evse_uid: z.string().max(36).optional(),
  authorization_reference: z.string().max(36).optional(),
});
export type StartSession = z.infer<typeof StartSessionSchema>;

export const StopSessionSchema = z.object({
  response_url: z.string().url(),
  session_id: z.string().max(36),
});
export type StopSession = z.infer<typeof StopSessionSchema>;

export const UnlockConnectorSchema = z.object({
  response_url: z.string().url(),
  location_id: z.string().max(36),
  evse_uid: z.string().max(36),
  connector_id: z.string().max(36),
});
export type UnlockConnector = z.infer<typeof UnlockConnectorSchema>;
