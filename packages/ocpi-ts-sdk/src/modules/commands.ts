import type { OCPIClient } from "../client/index.js";
import type {
  CancelReservation,
  ReserveNow,
  StartSession,
  StopSession,
  UnlockConnector,
} from "../schemas/v2.2.1/commands.js";

export interface CommandResponse {
  result: "ACCEPTED" | "REJECTED" | "TIMEOUT" | "UNKNOWN_SESSION";
  message?: Array<{ language: string; text: string }>;
  timeout?: number;
}

export class OcpiCommandsModule {
  constructor(private readonly client: OCPIClient) {}

  /** Send a StartSession command to the CPO */
  public async startSession(cmd: StartSession): Promise<CommandResponse> {
    const base = this.client.resolveEndpoint("commands");
    const { data } = await this.client.post<CommandResponse>(
      `${base}/START_SESSION`,
      cmd,
    );
    return data;
  }

  /** Send a StopSession command to the CPO */
  public async stopSession(cmd: StopSession): Promise<CommandResponse> {
    const base = this.client.resolveEndpoint("commands");
    const { data } = await this.client.post<CommandResponse>(
      `${base}/STOP_SESSION`,
      cmd,
    );
    return data;
  }

  /** Send a ReserveNow command to the CPO */
  public async reserveNow(cmd: ReserveNow): Promise<CommandResponse> {
    const base = this.client.resolveEndpoint("commands");
    const { data } = await this.client.post<CommandResponse>(
      `${base}/RESERVE_NOW`,
      cmd,
    );
    return data;
  }

  /** Send a CancelReservation command to the CPO */
  public async cancelReservation(
    cmd: CancelReservation,
  ): Promise<CommandResponse> {
    const base = this.client.resolveEndpoint("commands");
    const { data } = await this.client.post<CommandResponse>(
      `${base}/CANCEL_RESERVATION`,
      cmd,
    );
    return data;
  }

  /** Send an UnlockConnector command to the CPO */
  public async unlockConnector(cmd: UnlockConnector): Promise<CommandResponse> {
    const base = this.client.resolveEndpoint("commands");
    const { data } = await this.client.post<CommandResponse>(
      `${base}/UNLOCK_CONNECTOR`,
      cmd,
    );
    return data;
  }
}
