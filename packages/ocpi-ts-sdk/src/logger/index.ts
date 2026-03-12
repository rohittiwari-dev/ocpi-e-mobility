/**
 * OcpiLogger — the logger interface for ocpi-ts-sdk.
 *
 * Designed to be satisfied natively by:
 * - voltlog-io  (primary — Logger interface matches exactly, child() supported)
 * - pino        (has .debug/.info/.warn/.error/.child)
 * - winston     (satisfies the interface)
 * - console     (built-in default, zero deps)
 *
 * No logging library is imported or required by the SDK itself.
 */
export interface OcpiLogger {
  trace(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(
    message: string,
    metaOrError?: Record<string, unknown> | Error,
    error?: Error,
  ): void;
  /**
   * Optional — if provided, the SDK calls child({ partner, countryCode })
   * so all logs from a specific partner connection are auto-scoped.
   * voltlog-io and pino both support this.
   */
  child?: (context: Record<string, unknown>) => OcpiLogger;
}

/**
 * Built-in default logger — zero external dependencies.
 * Enabled by default when no logger is provided in config.
 */
export const defaultConsoleLogger: OcpiLogger = {
  trace: (msg, meta) => console.debug(`[ocpi-ts-sdk:trace] ${msg}`, meta ?? ""),
  debug: (msg, meta) => console.debug(`[ocpi-ts-sdk:debug] ${msg}`, meta ?? ""),
  info: (msg, meta) => console.info(`[ocpi-ts-sdk:info] ${msg}`, meta ?? ""),
  warn: (msg, meta) => console.warn(`[ocpi-ts-sdk:warn] ${msg}`, meta ?? ""),
  error: (msg, meta) => console.error(`[ocpi-ts-sdk:error] ${msg}`, meta ?? ""),
};

/** A completely silent logger — for logging: { enabled: false } */
export const silentLogger: OcpiLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Resolve which logger to use based on the logging config.
 * If voltlog-io / pino logger is provided and has child(), scopes it.
 */
export function resolveLogger(
  config: { enabled?: boolean; logger?: OcpiLogger } | undefined,
  context: Record<string, unknown>,
): OcpiLogger {
  if (config?.enabled === false) return silentLogger;

  const base = config?.logger ?? defaultConsoleLogger;
  if (typeof base.child === "function") {
    return base.child(context);
  }
  return base;
}
