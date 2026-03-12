import type { OcpiClient } from "../client/index.js";
import type { Credentials } from "../schemas/credentials.js";

export class OcpiCredentialsModule {
  constructor(private readonly client: OcpiClient) {}

  // Registration/Handshake logic
  public async getCredentials() {
    return this.client.get<Credentials>("/ocpi/2.2.1/credentials");
  }

  public async postCredentials(payload: Credentials) {
    return this.client.post<Credentials>("/ocpi/2.2.1/credentials", payload);
  }

  public async putCredentials(payload: Credentials) {
    return this.client.put<Credentials>("/ocpi/2.2.1/credentials", payload);
  }

  public async deleteCredentials() {
    return this.client.delete<unknown>("/ocpi/2.2.1/credentials");
  }
}
