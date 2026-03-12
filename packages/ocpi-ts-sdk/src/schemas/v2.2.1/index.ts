/**
 * OCPI 2.2.1 Schema Barrel
 *
 * Exports all Zod schemas and inferred TypeScript types for the OCPI 2.2.1 specification.
 *
 * To add a new OCPI version (e.g., 3.0):
 *   1. Create src/schemas/v3.0/ folder
 *   2. Write the updated schemas there
 *   3. Register them in router/schemas.ts via getSchemaMap()
 */
export * from "./cdrs.js";
export * from "./commands.js";
export * from "./credentials.js";
export * from "./locations.js";
export * from "./sessions.js";
export * from "./tariffs.js";
export * from "./tokens.js";
