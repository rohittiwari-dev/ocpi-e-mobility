import type { OCPIClient } from "../client/index.js";
import type { PaginatedResponse } from "../client/pagination.js";
import type { PaginationQuery } from "../client/types.js";
import type { Tariff } from "../schemas/index.js";

export class OcpiTariffsModule {
  constructor(private readonly client: OCPIClient) {}

  /** Pull a page of tariffs from the partner */
  public pull(query?: PaginationQuery): Promise<PaginatedResponse<Tariff>> {
    const url = this.client.resolveEndpoint("tariffs");
    return this.client.pagination.getList<Tariff>(url, query);
  }

  /** Stream ALL tariffs lazily (no OOM) */
  public stream(query?: PaginationQuery): AsyncGenerator<Tariff> {
    const url = this.client.resolveEndpoint("tariffs");
    return this.client.pagination.stream<Tariff>(url, query);
  }

  /** Fetch a single tariff by ID */
  public async get(tariffId: string): Promise<Tariff> {
    const base = this.client.resolveEndpoint("tariffs");
    const { data } = await this.client.get<Tariff>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${tariffId}`,
    );
    return data;
  }

  /**
   * Push a tariff to the partner (PUT — Client Owned Object).
   */
  public async push(tariffId: string, data: Tariff): Promise<void> {
    const base = this.client.resolveEndpoint("tariffs");
    await this.client.put<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${tariffId}`,
      data,
    );
  }

  /**
   * Delete a tariff from the partner.
   */
  public async delete(tariffId: string): Promise<void> {
    const base = this.client.resolveEndpoint("tariffs");
    await this.client.delete<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${tariffId}`,
    );
  }
}
