import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OCPIClient } from "../client/index.js";

const BASE_CONFIG = {
  versionsUrl: "https://partner.example.com/ocpi/versions",
  credentialsToken: "token",
  partyId: "CPO",
  countryCode: "DE",
  endpoints: { locations: "https://partner.example.com/ocpi/2.2.1/locations" },
};

function makeResponse(data: unknown[], nextUrl?: string, total = data.length) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Total-Count": String(total),
    "X-Limit": "10",
  };
  if (nextUrl) {
    headers.Link = `<${nextUrl}>; rel="next"`;
  }
  return new Response(
    JSON.stringify({
      status_code: 1000,
      data,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: new Headers(headers) },
  );
}

describe("OcpiPagination", () => {
  let originalFetch: typeof global.fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("getList()", () => {
    it("returns first page with totalCount and limit", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          makeResponse([{ id: "LOC1" }, { id: "LOC2" }], undefined, 5),
        );

      const client = new OCPIClient(BASE_CONFIG);
      const page = await client.pagination.getList(
        "https://partner.example.com/ocpi/2.2.1/locations",
      );
      expect(page.data).toHaveLength(2);
      expect(page.totalCount).toBe(5);
      expect(page.limit).toBe(10);
    });

    it("returns null for nextPage when no Link header", async () => {
      global.fetch = vi.fn().mockResolvedValue(makeResponse([{ id: "LOC1" }]));
      const client = new OCPIClient(BASE_CONFIG);
      const page = await client.pagination.getList(
        "https://p.example.com/locations",
      );
      const next = await page.nextPage();
      expect(next).toBeNull();
    });

    it("follows Link header to next page", async () => {
      const page2Url =
        "https://partner.example.com/ocpi/2.2.1/locations?offset=2";
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([{ id: "LOC1" }], page2Url, 2))
        .mockResolvedValueOnce(makeResponse([{ id: "LOC2" }]));

      const client = new OCPIClient(BASE_CONFIG);
      const page1 = await client.pagination.getList(
        "https://partner.example.com/ocpi/2.2.1/locations",
      );
      expect(page1.data[0]).toEqual({ id: "LOC1" });

      const page2 = await page1.nextPage();
      expect(page2?.data[0]).toEqual({ id: "LOC2" });
    });

    it("passes query params to URL", async () => {
      let capturedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve(makeResponse([]));
      });

      const client = new OCPIClient(BASE_CONFIG);
      await client.pagination.getList("https://p.example.com/locations", {
        limit: 20,
        offset: 40,
        date_from: "2024-01-01T00:00:00Z",
      });

      expect(capturedUrl).toContain("limit=20");
      expect(capturedUrl).toContain("offset=40");
      expect(capturedUrl).toContain("date_from=");
    });
  });

  describe("stream()", () => {
    it("yields all items across multiple pages", async () => {
      const page2Url = "https://p.example.com/locations?offset=2";
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          makeResponse([{ id: "A" }, { id: "B" }], page2Url, 4),
        )
        .mockResolvedValueOnce(makeResponse([{ id: "C" }, { id: "D" }]));

      const client = new OCPIClient(BASE_CONFIG);
      const collected: unknown[] = [];

      for await (const item of client.pagination.stream(
        "https://p.example.com/locations",
      )) {
        collected.push(item);
      }

      expect(collected).toHaveLength(4);
      expect((collected[0] as { id: string }).id).toBe("A");
      expect((collected[3] as { id: string }).id).toBe("D");
    });

    it("yields empty when first page is empty", async () => {
      global.fetch = vi.fn().mockResolvedValue(makeResponse([]));
      const client = new OCPIClient(BASE_CONFIG);
      const collected: unknown[] = [];
      for await (const item of client.pagination.stream(
        "https://p.example.com/locations",
      )) {
        collected.push(item);
      }
      expect(collected).toHaveLength(0);
    });
  });

  describe("getAll()", () => {
    it("collects all pages into array", async () => {
      const page2Url = "https://p.example.com/locations?offset=2";
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          makeResponse([{ id: "A" }, { id: "B" }], page2Url, 4),
        )
        .mockResolvedValueOnce(makeResponse([{ id: "C" }, { id: "D" }]));

      const client = new OCPIClient(BASE_CONFIG);
      const all = await client.pagination.getAll(
        "https://p.example.com/locations",
      );
      expect(all).toHaveLength(4);
    });
  });
});
