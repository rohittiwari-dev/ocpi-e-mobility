import type { OCPIClient } from "../client/index.js";
import type { PaginatedResponse } from "../client/pagination.js";
import type { PaginationQuery } from "../client/types.js";
import type { Session, SessionPatch } from "../schemas/sessions.js";

export class OcpiSessionsModule {
  constructor(private readonly client: OCPIClient) {}

  /** Pull a page of sessions from the partner */
  public pull(query?: PaginationQuery): Promise<PaginatedResponse<Session>> {
    const url = this.client.resolveEndpoint("sessions");
    return this.client.pagination.getList<Session>(url, query);
  }

  /** Stream ALL sessions lazily (no OOM) */
  public stream(query?: PaginationQuery): AsyncGenerator<Session> {
    const url = this.client.resolveEndpoint("sessions");
    return this.client.pagination.stream<Session>(url, query);
  }

  /** Fetch a single session by ID */
  public async get(sessionId: string): Promise<Session> {
    const base = this.client.resolveEndpoint("sessions");
    const { data } = await this.client.get<Session>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${sessionId}`,
    );
    return data;
  }

  /**
   * Create / push a session to the partner (PUT).
   * Call on StartTransaction or on initial session push.
   */
  public async create(
    session: Session,
    opts?: { idempotencyKey?: string },
  ): Promise<void> {
    const base = this.client.resolveEndpoint("sessions");
    await this.client.put<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${session.id}`,
      session,
      opts,
    );
  }

  /**
   * Partially update a session (PATCH).
   * Call on MeterValues or StopTransaction.
   * `last_updated` is required in patch data per OCPI spec.
   */
  public async update(sessionId: string, patch: SessionPatch): Promise<void> {
    const base = this.client.resolveEndpoint("sessions");
    await this.client.patch<unknown>(
      `${base}/${this.client.config.countryCode}/${this.client.config.partyId}/${sessionId}`,
      patch,
    );
  }
}
