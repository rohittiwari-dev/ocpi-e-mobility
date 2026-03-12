import type { ZodType } from "zod";
import { CdrSchema } from "../schemas/v2.2.1/cdrs.js";
import {
  CancelReservationSchema,
  ReserveNowSchema,
  StartSessionSchema,
  StopSessionSchema,
  UnlockConnectorSchema,
} from "../schemas/v2.2.1/commands.js";
import { CredentialsSchema } from "../schemas/v2.2.1/credentials.js";
import {
  ConnectorPatchSchema,
  ConnectorSchema,
  EvsePatchSchema,
  EvseSchema,
  LocationPatchSchema,
  LocationSchema,
} from "../schemas/v2.2.1/locations.js";
import {
  SessionPatchSchema,
  SessionSchema,
} from "../schemas/v2.2.1/sessions.js";
import { TariffSchema } from "../schemas/v2.2.1/tariffs.js";
import { TokenPatchSchema, TokenSchema } from "../schemas/v2.2.1/tokens.js";
import type { RouterEvent } from "./events.js";

/** Schema map type — partial because not all events have a body to validate */
export type SchemaMap = Partial<Record<RouterEvent, ZodType<unknown>>>;

/**
 * OCPI 2.2.1 schema map — maps RouterEvents to their Zod schemas.
 * Used by OCPIRouter for runtime payload validation.
 */
const v221SchemaMap: SchemaMap = {
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

/**
 * Registry of version-specific schema maps.
 *
 * To add OCPI 3.0:
 *   1. Create src/schemas/v3.0/ with your new/updated schemas
 *   2. Build a v30SchemaMap like the one above
 *   3. Add "3.0": v30SchemaMap to this object — done.
 */
const VERSION_SCHEMA_REGISTRY: Record<string, SchemaMap> = {
  "2.2.1": v221SchemaMap,
  "2.1.1": v221SchemaMap, // 2.1.1 uses same schemas — lenient mode handles field gaps
};

/**
 * Returns the schema map for a given OCPI version string.
 * Falls back to 2.2.1 if the requested version has no dedicated schema map.
 */
export function getSchemaMap(version: string): SchemaMap {
  return VERSION_SCHEMA_REGISTRY[version] ?? v221SchemaMap;
}

// Keep exporting EventSchemaMap for backward compat with any direct imports
export const EventSchemaMap = v221SchemaMap;
