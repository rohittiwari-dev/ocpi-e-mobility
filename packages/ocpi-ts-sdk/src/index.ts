/**
 * ocpi-ts-sdk — Main entry point
 *
 * Core exports (tree-shakeable):
 *   import { OCPIClient } from 'ocpi-ts-sdk'
 *   import { OCPIRouter } from 'ocpi-ts-sdk/router'
 *   import { OcpiClientRegistry } from 'ocpi-ts-sdk/registry'
 *   import { OcpiError } from 'ocpi-ts-sdk/errors'
 *   import { LocationSchema } from 'ocpi-ts-sdk/schemas'
 *   import type { OcpiLogger } from 'ocpi-ts-sdk/logger'
 */

export type {
  CircuitBreakerConfig,
  CircuitState,
} from "./client/circuit-breaker.js";
// ── Circuit Breaker + Rate Limiter ────────────────────────────────────────────
export { CircuitBreaker } from "./client/circuit-breaker.js";
// ── Errors ───────────────────────────────────────────────────────────────────
export {
  OcpiCircuitOpenError,
  OcpiDiscoveryError,
  OcpiError,
  OcpiHttpError,
  OcpiRateLimitError,
  OcpiValidationError,
} from "./client/errors.js";
// ── Client ──────────────────────────────────────────────────────────────────
// ── Modules (for advanced users who want module classes directly) ─────────────
export {
  OCPIClient,
  OcpiCdrsModule,
  OcpiCommandsModule,
  OcpiCredentialsModule,
  OcpiLocationsModule,
  OcpiSessionsModule,
  OcpiTariffsModule,
  OcpiTokensModule,
} from "./client/index.js";
// ── Pagination & Pump ───────────────────────────────────────────────────────────────
export type { PaginatedResponse } from "./client/pagination.js";
export { OcpiPagination } from "./client/pagination.js";
export {
  OcpiDataPump,
  type OcpiDataPumpConfig,
  type OcpiDataPumpEvents,
} from "./client/pump.js";
export { PartnerRateLimiter } from "./client/rate-limiter.js";
export type {
  OcpiClientConfig,
  OcpiModuleId,
  PaginationQuery,
} from "./client/types.js";
// ── Logger ───────────────────────────────────────────────────────────────────
export type { OcpiLogger } from "./logger/index.js";
export {
  defaultConsoleLogger,
  resolveLogger,
  silentLogger,
} from "./logger/index.js";
// ── Registry ─────────────────────────────────────────────────────────────────
export { OcpiClientRegistry, OcpiRegistryError } from "./registry/index.js";
export type {
  OcpiHandler,
  OcpiHandlerResult,
  OcpiPartner,
  OcpiRouterConfig,
  OcpiRouterContext,
} from "./router/context.js";
// ── Router ───────────────────────────────────────────────────────────────────
export { OCPIRouter } from "./router/index.js";
// ── Schemas (all, tree-shakeable) ────────────────────────────────────────────
export * from "./schemas/common.js";
export * from "./schemas/v2.2.1/cdrs.js";
export * from "./schemas/v2.2.1/commands.js";
export * from "./schemas/v2.2.1/credentials.js";
export * from "./schemas/v2.2.1/locations.js";
export * from "./schemas/v2.2.1/sessions.js";
export * from "./schemas/v2.2.1/tariffs.js";
export * from "./schemas/v2.2.1/tokens.js";
export * from "./schemas/versions.js";

// ── Utils ────────────────────────────────────────────────────────────────────
export {
  type CostEstimate,
  type CostEstimateOptions,
  OcpiCalculator,
} from "./utils/calculator.js";
