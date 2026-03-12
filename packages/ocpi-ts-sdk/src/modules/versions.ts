import type { OcpiClient } from "../client/index.js";
import type { Version, VersionDetail } from "../schemas/versions.js";

export class OcpiVersionsModule {
  constructor(private readonly client: OcpiClient) {}

  public async getVersions() {
    return this.client.get<Version[]>("/ocpi/versions");
  }

  public async getVersionDetails(url: string) {
    // URL here is absolute based on the versions endpoint response
    const { data: details } = await this.client.fetch<VersionDetail>(url, {
      method: "GET",
    });
    return details;
  }
}
