import type { OCPIClient } from "../client/index.js";
import type { PaginatedResponse } from "../client/pagination.js";
import type { PaginationQuery } from "../client/types.js";
import type {
  Connector,
  ConnectorPatch,
  Evse,
  EvsePatch,
  Location,
  LocationPatch,
} from "../schemas/v2.2.1/locations.js";

type EvseStatus =
  | "AVAILABLE"
  | "BLOCKED"
  | "CHARGING"
  | "INOPERATIVE"
  | "OUTOFORDER"
  | "PLANNED"
  | "REMOVED"
  | "RESERVED"
  | "UNKNOWN";

export class OcpiLocationsModule {
  constructor(private readonly client: OCPIClient) {}

  /** Pull a page of locations from the partner (EMSP receiver side) */
  public pull(query?: PaginationQuery): Promise<PaginatedResponse<Location>> {
    const url = this.client.resolveEndpoint("locations");
    return this.client.pagination.getList<Location>(url, query);
  }

  /**
   * Stream ALL locations from the partner one at a time (no OOM).
   * Uses Link-header pagination under the hood.
   *
   * @example
   * for await (const loc of partner.locations.stream()) {
   *   await db.upsert(loc);
   * }
   */
  public stream(query?: PaginationQuery): AsyncGenerator<Location> {
    const url = this.client.resolveEndpoint("locations");
    return this.client.pagination.stream<Location>(url, query);
  }

  /** Fetch a single location by ID */
  public async get(locationId: string): Promise<Location> {
    const base = this.client.resolveEndpoint("locations");
    const { data } = await this.client.get<Location>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${locationId}`,
    );
    return data;
  }

  /**
   * Push a full location to the partner (CPO sender side).
   * Uses PUT — must include all required fields.
   */
  public async push(
    locationId: string,
    data: Location,
    opts?: { idempotencyKey?: string },
  ): Promise<void> {
    const base = this.client.resolveEndpoint("locations");
    await this.client.put<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${locationId}`,
      data,
      opts,
    );
  }

  /**
   * Partially update a location (PATCH).
   * `last_updated` is required in the patch data per OCPI spec.
   */
  public async update(locationId: string, data: LocationPatch): Promise<void> {
    const base = this.client.resolveEndpoint("locations");
    await this.client.patch<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${locationId}`,
      data,
    );
  }

  /**
   * Update a specific EVSE within a location (PATCH — partial update).
   * `last_updated` is required in the patch data per OCPI spec.
   */
  public async updateEvse(
    locationId: string,
    evseUid: string,
    data: EvsePatch,
  ): Promise<void> {
    const base = this.client.resolveEndpoint("locations");
    await this.client.patch<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${locationId}/${evseUid}`,
      data,
    );
  }

  /**
   * Convenience method — update only the EVSE status field.
   * Automatically sets last_updated to now.
   */
  public async updateEvseStatus(
    locationId: string,
    evseUid: string,
    status: EvseStatus,
  ): Promise<void> {
    return this.updateEvse(locationId, evseUid, {
      status,
      last_updated: new Date().toISOString(),
    });
  }

  /**
   * Push a full EVSE object to the partner (PUT).
   */
  public async pushEvse(
    locationId: string,
    evseUid: string,
    data: Evse,
  ): Promise<void> {
    const base = this.client.resolveEndpoint("locations");
    await this.client.put<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${locationId}/${evseUid}`,
      data,
    );
  }

  /**
   * Update a specific Connector (PATCH — partial update).
   */
  public async updateConnector(
    locationId: string,
    evseUid: string,
    connectorId: string,
    data: ConnectorPatch,
  ): Promise<void> {
    const base = this.client.resolveEndpoint("locations");
    await this.client.patch<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${locationId}/${evseUid}/${connectorId}`,
      data,
    );
  }

  /**
   * Push a full Connector object (PUT).
   */
  public async pushConnector(
    locationId: string,
    evseUid: string,
    connectorId: string,
    data: Connector,
  ): Promise<void> {
    const base = this.client.resolveEndpoint("locations");
    await this.client.put<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${locationId}/${evseUid}/${connectorId}`,
      data,
    );
  }
}
