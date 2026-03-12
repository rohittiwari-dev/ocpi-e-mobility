import type { OcpiClient } from "../client/index.js";
import type { Token } from "../schemas/tokens.js";

export class OcpiTokensModule {
  constructor(private readonly client: OcpiClient) {}

  // Sender (EMSP) pushing updates
  public async putToken(
    countryCode: string,
    partyId: string,
    tokenUid: string,
    token: Token,
  ) {
    return this.client.put<unknown>(
      `/ocpi/receiver/2.2.1/tokens/${countryCode}/${partyId}/${tokenUid}`,
      token,
    );
  }

  public async patchToken(
    countryCode: string,
    partyId: string,
    tokenUid: string,
    update: Partial<Token>,
  ) {
    return this.client.patch<unknown>(
      `/ocpi/receiver/2.2.1/tokens/${countryCode}/${partyId}/${tokenUid}`,
      update,
    );
  }

  // Receiver (CPO) fetching data
  public getTokensList(query?: {
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
  }) {
    return this.client.pagination.getList<Token>(
      "/ocpi/sender/2.2.1/tokens",
      query,
    );
  }
}
