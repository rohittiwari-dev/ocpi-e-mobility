import type { OCPIClient } from "../client/index.js";
import type { PaginatedResponse } from "../client/pagination.js";
import type { PaginationQuery } from "../client/types.js";
import type { Cdr } from "../schemas/cdrs.js";

export class OcpiCdrsModule {
  constructor(private readonly client: OCPIClient) {}

  /** Pull a page of CDRs from the partner */
  public pull(query?: PaginationQuery): Promise<PaginatedResponse<Cdr>> {
    const url = this.client.resolveEndpoint("cdrs");
    return this.client.pagination.getList<Cdr>(url, query);
  }

  /** Stream ALL CDRs lazily (no OOM) */
  public stream(query?: PaginationQuery): AsyncGenerator<Cdr> {
    const url = this.client.resolveEndpoint("cdrs");
    return this.client.pagination.stream<Cdr>(url, query);
  }

  /** Fetch a single CDR by ID */
  public async get(cdrId: string): Promise<Cdr> {
    const base = this.client.resolveEndpoint("cdrs");
    const { data } = await this.client.get<Cdr>(`${base}/${cdrId}`);
    return data;
  }

  /**
   * Push a CDR to the partner (POST).
   * Use `idempotencyKey` to prevent double-billing on retries.
   *
   * @example
   * await partner.cdrs.push(cdr, { idempotencyKey: `cdr-${cdr.id}-v1` });
   */
  public async push(
    cdr: Cdr,
    opts?: { idempotencyKey?: string },
  ): Promise<void> {
    const base = this.client.resolveEndpoint("cdrs");
    await this.client.post<unknown>(base, cdr, opts);
  }
}
