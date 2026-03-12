import type { OcpiClient } from "./index.js";

export interface PaginatedResponse<T> {
  data: T[];
  headers: Headers;
  /** Returns the next page of results if Link header is present, else null */
  nextPage: () => Promise<PaginatedResponse<T> | null>;
}

export class OcpiPagination {
  constructor(private readonly client: OcpiClient) {}

  /**
   * Fetches the first page of a collection and returns a helper to fetch subsequent pages.
   */
  public async getList<T>(
    path: string,
    query?: {
      limit?: number;
      offset?: number;
      date_from?: string;
      date_to?: string;
    },
  ): Promise<PaginatedResponse<T>> {
    const { data, headers } = await this.client.get<T[]>(
      path,
      query as Record<string, string>,
    );

    return {
      data,
      headers,
      nextPage: () => this.getNextPage<T>(headers),
    };
  }

  /**
   * Automatically fetches all pages and returns the complete array.
   * Warning: Could consume high memory for very large datasets.
   */
  public async getAll<T>(
    path: string,
    query?: {
      limit?: number;
      offset?: number;
      date_from?: string;
      date_to?: string;
    },
  ): Promise<T[]> {
    const results: T[] = [];
    let current = await this.getList<T>(path, query);
    results.push(...current.data);

    while (true) {
      const next = await current.nextPage();
      if (!next) break;
      results.push(...next.data);
      current = next;
    }

    return results;
  }

  private async getNextPage<T>(
    previousHeaders: Headers,
  ): Promise<PaginatedResponse<T> | null> {
    const linkHeader = previousHeaders.get("Link");
    if (!linkHeader) return null;

    // Parse Link header format: <https://example.com/ocpi/...>; rel="next"
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (!nextMatch || !nextMatch[1]) return null;

    const nextUrl = nextMatch[1];

    // Create an absolute path segment for the client.fetch
    const { data, headers } = await this.client.fetch<T[]>(nextUrl, {
      method: "GET",
    });

    return {
      data,
      headers,
      nextPage: () => this.getNextPage<T>(headers),
    };
  }
}
