export interface OcpiClientConfig {
  /** The base URL of the OCPI endpoint (e.g., https://api.example.com/ocpi/2.2.1) */
  baseUrl: string;
  /** Credentials Token A, B, or C depending on the handshak phase */
  token: string;
  /** OCPI-from-party-id */
  partyId?: string;
  /** OCPI-from-country-code */
  countryCode?: string;
  /** OCPI-from-version */
  version?: "2.1.1" | "2.2.1" | "3.0";
  /** Max retries for 429/5xx (default: 3) */
  retries?: number;
}

export interface OcpiHeaders {
  "X-Limit-Remaining"?: string;
  "X-Request-ID": string;
  "X-Correlation-ID": string;
  "OCPI-from-party-id"?: string;
  "OCPI-from-country-code"?: string;
}

export interface OcpiResponse<T> {
  data: T;
  status_code: number;
  status_message?: string;
  timestamp: string;
}
