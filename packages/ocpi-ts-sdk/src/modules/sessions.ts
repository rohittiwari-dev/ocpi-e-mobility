import type { OcpiClient } from "../client/index.js";
import type { Session } from "../schemas/sessions.js";

export class OcpiSessionsModule {
  constructor(private readonly client: OcpiClient) {}

  // Sender (CPO) pushing updates
  public async putSession(
    countryCode: string,
    partyId: string,
    session: Session,
  ) {
    return this.client.put<unknown>(
      `/ocpi/receiver/2.2.1/sessions/${countryCode}/${partyId}/${session.id}`,
      session,
    );
  }

  public async patchSession(
    countryCode: string,
    partyId: string,
    sessionId: string,
    update: Partial<Session>,
  ) {
    return this.client.patch<unknown>(
      `/ocpi/receiver/2.2.1/sessions/${countryCode}/${partyId}/${sessionId}`,
      update,
    );
  }

  // Receiver (EMSP) fetching data
  public getSessionsList(query?: {
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
  }) {
    return this.client.pagination.getList<Session>(
      "/ocpi/sender/2.2.1/sessions",
      query,
    );
  }
}
