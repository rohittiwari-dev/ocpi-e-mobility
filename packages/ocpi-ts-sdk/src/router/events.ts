import type { Cdr } from "../schemas/cdrs.js";
import type {
  CancelReservation,
  ReserveNow,
  StartSession,
  StopSession,
  UnlockConnector,
} from "../schemas/commands.js";
import type { Credentials } from "../schemas/credentials.js";
import type { Location, LocationPatch } from "../schemas/locations.js";
import type { Session, SessionPatch } from "../schemas/sessions.js";
import type { Tariff } from "../schemas/tariffs.js";
import type { Token, TokenPatch } from "../schemas/tokens.js";
import type { OcpiHandler } from "./context.js";

/** All event handler signatures for OCPIRouter.on() */
export interface RouterEventMap {
  // Locations
  "location:put": OcpiHandler<Location>;
  "location:patch": OcpiHandler<LocationPatch>;
  "location:delete": OcpiHandler<{ locationId: string }>;
  // EVSEs (same location endpoint, deeper path)
  "evse:put": OcpiHandler<unknown>; // Should be Evse but we'll map it dynamically
  "evse:patch": OcpiHandler<unknown>;
  // Connector
  "connector:put": OcpiHandler<unknown>; // Should be Connector
  "connector:patch": OcpiHandler<unknown>;
  // Sessions
  "session:put": OcpiHandler<Session>;
  "session:patch": OcpiHandler<SessionPatch>;
  // CDRs
  "cdr:post": OcpiHandler<Cdr>;
  // Tariffs
  "tariff:put": OcpiHandler<Tariff>;
  "tariff:delete": OcpiHandler<{ tariffId: string }>;
  // Tokens
  "token:put": OcpiHandler<Token>;
  "token:patch": OcpiHandler<TokenPatch>;
  "token:get": OcpiHandler<{ uid: string; type: string }>;
  // Commands
  "command:start_session": OcpiHandler<StartSession>;
  "command:stop_session": OcpiHandler<StopSession>;
  "command:reserve_now": OcpiHandler<ReserveNow>;
  "command:cancel_reservation": OcpiHandler<CancelReservation>;
  "command:unlock_connector": OcpiHandler<UnlockConnector>;
  // Credentials
  "credentials:post": OcpiHandler<Credentials>;
  "credentials:put": OcpiHandler<Credentials>;
  "credentials:delete": OcpiHandler<Record<string, never>>;
}

export type RouterEvent = keyof RouterEventMap;
