import type { OCPIClient } from "../client/index.js";
import type { Credentials } from "../schemas/credentials.js";

export class OcpiCredentialsModule {
  constructor(private readonly client: OCPIClient) {}

  /**
   * GET your own credentials from the partner.
   */
  public async get(): Promise<Credentials> {
    const base = this.client.resolveEndpoint("credentials");
    const { data } = await this.client.get<Credentials>(base);
    return data;
  }

  /**
   * POST credentials — initial registration (Token A → Token B exchange).
   * Call this on first connection to the partner.
   * Returns your Token C (the token the partner will use to call you back).
   */
  public async register(credentials: Credentials): Promise<Credentials> {
    const base = this.client.resolveEndpoint("credentials");
    const { data } = await this.client.post<Credentials>(base, credentials);
    return data;
  }

  /**
   * PUT credentials — update an existing connection (Token B → Token C update).
   * Call this to rotate tokens or update your versions URL.
   */
  public async update(credentials: Credentials): Promise<Credentials> {
    const base = this.client.resolveEndpoint("credentials");
    const { data } = await this.client.put<Credentials>(base, credentials);
    return data;
  }

  /**
   * DELETE credentials — end the OCPI connection with this partner.
   */
  public async delete(): Promise<void> {
    const base = this.client.resolveEndpoint("credentials");
    await this.client.delete<unknown>(base);
  }
}
