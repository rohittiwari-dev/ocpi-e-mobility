import { expect, test } from "vitest";
import { OcpiClient } from "./client/index.js";
import { GeoLocationSchema } from "./schemas/index.js";

test("OcpiClient handles basic GET fetching", async (_t) => {
  const client = new OcpiClient({
    baseUrl: "https://test.local",
    token: "test-token",
  });

  // Mocking global fetch for this test
  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    expect(input.toString()).toBe(
      "https://test.local/ocpi/sender/2.2.1/locations?limit=10",
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Token test-token",
    );

    return new Response(
      JSON.stringify({
        status_code: 1000,
        data: [{ id: "LOC1" }],
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: new Headers({
          "Content-Type": "application/json",
          "X-Limit-Remaining": "99",
        }),
      },
    );
  };

  try {
    const { data } = await client.get<unknown[]>(
      "/ocpi/sender/2.2.1/locations",
      {
        limit: "10",
      },
    );
    expect(data.length).toBe(1);
    expect((data[0] as any)?.id).toBe("LOC1");
    expect(client.rateLimit.remaining).toBe(99);
  } finally {
    global.fetch = originalFetch;
  }
});

test("GeoLocationSchema parses correct lat/long", () => {
  const valid = GeoLocationSchema.parse({
    latitude: "51.34567",
    longitude: "4.12345",
  });

  expect(valid.latitude).toBe("51.34567");

  expect(() => {
    GeoLocationSchema.parse({ latitude: "51.3", longitude: "4.1" }); // too short
  }).toThrow();
});
