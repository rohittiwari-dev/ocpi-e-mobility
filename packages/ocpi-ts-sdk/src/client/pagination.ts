import type { OCPIClient } from "./index.js";
import type { PaginationQuery } from "./types.js";

export interface PaginatedResponse<T> {
  data: T[];
  /** Total count of objects available (from X-Total-Count header) */
  totalCount: number | null;
  /** Server's max limit (from X-Limit header) */
  limit: number | null;
  headers: Headers;
  /** Fetches the next page using the Link header, or returns null if this is the last page */
  nextPage: () => Promise<PaginatedResponse<T> | null>;
}

export class OcpiPagination {
  constructor(private readonly client: OCPIClient) {}

  /**
   * Fetches the first page of a collection with full metadata.
   */
  public async getList<T>(
    url: string,
    query?: PaginationQuery,
  ): Promise<PaginatedResponse<T>> {
    const queryParams = query
      ? (Object.fromEntries(
          Object.entries(query).filter(([, v]) => v !== undefined),
        ) as Record<string, string>)
      : undefined;

    const { data, headers } = await this.client.get<T[]>(url, queryParams);

    return this._buildResponse<T>(data, headers);
  }

  /**
   * Async generator — streams all items across pages lazily.
   * Never loads more than one page into memory at a time.
   *
   * @example
   * for await (const location of partner.locations.stream()) {
   *   await db.locations.upsert(location); // processes one at a time
   * }
   */
  public async *stream<T>(
    url: string,
    query?: PaginationQuery,
  ): AsyncGenerator<T, void, unknown> {
    let currentPage: PaginatedResponse<T> | null = await this.getList<T>(
      url,
      query,
    );

    while (currentPage !== null) {
      for (const item of currentPage.data) {
        yield item;
      }
      currentPage = await currentPage.nextPage();
    }
  }

  /**
   * Fetches ALL pages and returns the complete array.
   * ⚠️ Warning: Can exhaust memory for large datasets. Use stream() instead.
   */
  public async getAll<T>(url: string, query?: PaginationQuery): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this.stream<T>(url, query)) {
      results.push(item);
    }
    return results;
  }

  private _buildResponse<T>(data: T[], headers: Headers): PaginatedResponse<T> {
    const totalCount = headers.get("X-Total-Count");
    const limit = headers.get("X-Limit");

    return {
      data,
      totalCount: totalCount !== null ? Number.parseInt(totalCount, 10) : null,
      limit: limit !== null ? Number.parseInt(limit, 10) : null,
      headers,
      nextPage: () => this._fetchNextPage<T>(headers),
    };
  }

  private async _fetchNextPage<T>(
    previousHeaders: Headers,
  ): Promise<PaginatedResponse<T> | null> {
    const linkHeader = previousHeaders.get("Link");
    if (!linkHeader) return null;

    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (!nextMatch?.[1]) return null;

    const { data, headers } = await this.client.fetch<T[]>(nextMatch[1], {
      method: "GET",
    });

    return this._buildResponse<T>(data, headers);
  }
}
