import type { OcpiClient } from "../client/index.js";
import type {
  CancelReservation,
  ReserveNow,
  StartSession,
  StopSession,
  UnlockConnector,
} from "../schemas/commands.js";

export class OcpiCommandsModule {
  constructor(private readonly client: OcpiClient) {}

  // Sender (EMSP) sending commands to Receiver (CPO)
  public async cancelReservation(payload: CancelReservation) {
    return this.client.post<{ result: string; timeout: number }>(
      "/ocpi/receiver/2.2.1/commands/CANCEL_RESERVATION",
      payload,
    );
  }

  public async reserveNow(payload: ReserveNow) {
    return this.client.post<{ result: string; timeout: number }>(
      "/ocpi/receiver/2.2.1/commands/RESERVE_NOW",
      payload,
    );
  }

  public async startSession(payload: StartSession) {
    return this.client.post<{ result: string; timeout: number }>(
      "/ocpi/receiver/2.2.1/commands/START_SESSION",
      payload,
    );
  }

  public async stopSession(payload: StopSession) {
    return this.client.post<{ result: string; timeout: number }>(
      "/ocpi/receiver/2.2.1/commands/STOP_SESSION",
      payload,
    );
  }

  public async unlockConnector(payload: UnlockConnector) {
    return this.client.post<{ result: string; timeout: number }>(
      "/ocpi/receiver/2.2.1/commands/UNLOCK_CONNECTOR",
      payload,
    );
  }
}
