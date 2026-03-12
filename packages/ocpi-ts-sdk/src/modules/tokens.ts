import type { OCPIClient } from "../client/index.js";
import type { PaginatedResponse } from "../client/pagination.js";
import type { PaginationQuery } from "../client/types.js";
import type { AuthorizationInfo } from "../schemas/common.js";
import type {
  LocationReferences,
  Token,
  TokenPatch,
} from "../schemas/tokens.js";

type TokenType = "AD_HOC_USER" | "APP_USER" | "OTHER" | "RFID";

export class OcpiTokensModule {
  constructor(private readonly client: OCPIClient) {}

  /** Pull a page of tokens from the partner (CPO side — pull EMSP whitelist) */
  public pull(query?: PaginationQuery): Promise<PaginatedResponse<Token>> {
    const url = this.client.resolveEndpoint("tokens");
    return this.client.pagination.getList<Token>(url, query);
  }

  /** Stream ALL tokens lazily (no OOM) */
  public stream(query?: PaginationQuery): AsyncGenerator<Token> {
    const url = this.client.resolveEndpoint("tokens");
    return this.client.pagination.stream<Token>(url, query);
  }

  /** Fetch a single token by UID and type */
  public async get(uid: string, type: TokenType): Promise<Token> {
    const base = this.client.resolveEndpoint("tokens");
    const { data } = await this.client.get<Token>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${uid}`,
      { type },
    );
    return data;
  }

  /**
   * Push a token to the partner (PUT — EMSP pushing to CPO whitelist).
   */
  public async push(uid: string, data: Token): Promise<void> {
    const base = this.client.resolveEndpoint("tokens");
    await this.client.put<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${uid}`,
      data,
    );
  }

  /**
   * Partially update a token (PATCH).
   * `last_updated` is required per OCPI spec.
   */
  public async patch(uid: string, data: TokenPatch): Promise<void> {
    const base = this.client.resolveEndpoint("tokens");
    await this.client.patch<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${uid}`,
      data,
    );
  }

  /**
   * Request real-time token authorization from the CPO (EMSP requesting).
   * Used for RFID or app-user tokens before starting a session.
   */
  public async authorize(
    uid: string,
    locationRef?: LocationReferences,
  ): Promise<AuthorizationInfo> {
    const base = this.client.resolveEndpoint("tokens");
    const { data } = await this.client.post<AuthorizationInfo>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${uid}/authorize`,
      locationRef ?? {},
    );
    return data;
  }
}
