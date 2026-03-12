import type { OcpiClient } from "../client/index.js";
import type { Cdr } from "../schemas/cdrs.js";

export class OcpiCdrsModule {
  constructor(private readonly client: OcpiClient) {}

  // Sender (CPO) pushing updates
  public async postCdr(cdr: Cdr) {
    // Note: Receiver (EMSP) endpoint for CDRs is a POST for new created CDRs
    // The spec uses `/ocpi/receiver/2.2.1/cdrs`
    return this.client.post<unknown>("/ocpi/receiver/2.2.1/cdrs", cdr);
  }

  // Receiver (EMSP) fetching data
  public getCdrsList(query?: {
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
  }) {
    return this.client.pagination.getList<Cdr>(
      "/ocpi/sender/2.2.1/cdrs",
      query,
    );
  }
}
