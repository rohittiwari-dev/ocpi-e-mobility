import type { OcpiClient } from "../client/index.js";
import type { Tariff } from "../schemas/tariffs.js";

export class OcpiTariffsModule {
  constructor(private readonly client: OcpiClient) {}

  // Sender (CPO) pushing updates
  public async putTariff(countryCode: string, partyId: string, tariff: Tariff) {
    return this.client.put<unknown>(
      `/ocpi/receiver/2.2.1/tariffs/${countryCode}/${partyId}/${tariff.id}`,
      tariff,
    );
  }

  // Receiver (EMSP) fetching data
  public getTariffsList(query?: {
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
  }) {
    return this.client.pagination.getList<Tariff>(
      "/ocpi/sender/2.2.1/tariffs",
      query,
    );
  }
}
