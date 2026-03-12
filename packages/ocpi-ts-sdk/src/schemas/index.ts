/**
 * Public schema barrel — re-exports from the current default OCPI version (2.2.1).
 * Existing imports like `import { LocationSchema } from 'ocpi-ts-sdk'` continue
 * to work unchanged. Direct versioned imports are also available:
 *   import { LocationSchema } from 'ocpi-ts-sdk/schemas/v2.2.1'
 */

export * from "./common.js";
export * from "./v2.2.1/index.js";
export * from "./versions.js";
