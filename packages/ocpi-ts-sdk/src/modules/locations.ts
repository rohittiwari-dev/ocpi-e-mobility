import type { OcpiClient } from "../client/index.js";
import type { Connector, Evse, Location } from "../schemas/locations.js";

export class OcpiLocationsModule {
  constructor(private readonly client: OcpiClient) {}

  // Sender (CPO) pushing updates
  public async putLocation(
    countryCode: string,
    partyId: string,
    location: Location,
  ) {
    return this.client.put<unknown>(
      `/ocpi/receiver/2.2.1/locations/${countryCode}/${partyId}/${location.id}`,
      location,
    );
  }

  public async putEvse(
    countryCode: string,
    partyId: string,
    locationId: string,
    evse: Evse,
  ) {
    return this.client.put<unknown>(
      `/ocpi/receiver/2.2.1/locations/${countryCode}/${partyId}/${locationId}/${evse.uid}`,
      evse,
    );
  }

  public async putConnector(
    countryCode: string,
    partyId: string,
    locationId: string,
    evseUid: string,
    connector: Connector,
  ) {
    return this.client.put<unknown>(
      `/ocpi/receiver/2.2.1/locations/${countryCode}/${partyId}/${locationId}/${evseUid}/${connector.id}`,
      connector,
    );
  }

  // Receiver (EMSP) fetching data
  public getLocationsList(query?: {
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
  }) {
    return this.client.pagination.getList<Location>(
      "/ocpi/sender/2.2.1/locations",
      query,
    );
  }

  public async getLocation(locationId: string) {
    return this.client.get<Location>(
      `/ocpi/sender/2.2.1/locations/${locationId}`,
    );
  }
}
