import type { ZodType } from "zod";
import { CdrSchema } from "../schemas/cdrs.js";
import {
  CancelReservationSchema,
  ReserveNowSchema,
  StartSessionSchema,
  StopSessionSchema,
  UnlockConnectorSchema,
} from "../schemas/commands.js";
import { CredentialsSchema } from "../schemas/credentials.js";
import {
  ConnectorPatchSchema,
  ConnectorSchema,
  EvsePatchSchema,
  EvseSchema,
  LocationPatchSchema,
  LocationSchema,
} from "../schemas/locations.js";
import { SessionPatchSchema, SessionSchema } from "../schemas/sessions.js";
import { TariffSchema } from "../schemas/tariffs.js";
import { TokenPatchSchema, TokenSchema } from "../schemas/tokens.js";
import type { RouterEvent } from "./events.js";

/** Runtime mapping of RouterEvent to its Zod schema for payload validation */
export const EventSchemaMap: Partial<Record<RouterEvent, ZodType<unknown>>> = {
  // Locations
  "location:put": LocationSchema,
  "location:patch": LocationPatchSchema,
  "evse:put": EvseSchema,
  "evse:patch": EvsePatchSchema,
  "connector:put": ConnectorSchema,
  "connector:patch": ConnectorPatchSchema,

  // Sessions
  "session:put": SessionSchema,
  "session:patch": SessionPatchSchema,

  // CDRs
  "cdr:post": CdrSchema,

  // Tariffs
  "tariff:put": TariffSchema,

  // Tokens
  "token:put": TokenSchema,
  "token:patch": TokenPatchSchema,

  // Commands
  "command:start_session": StartSessionSchema,
  "command:stop_session": StopSessionSchema,
  "command:reserve_now": ReserveNowSchema,
  "command:cancel_reservation": CancelReservationSchema,
  "command:unlock_connector": UnlockConnectorSchema,

  // Credentials
  "credentials:post": CredentialsSchema,
  "credentials:put": CredentialsSchema,
};
