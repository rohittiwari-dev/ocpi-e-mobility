import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/client/index.ts",
    "src/client/errors.ts",
    "src/logger/index.ts",
    "src/router/index.ts",
    "src/registry/index.ts",
    "src/schemas/index.ts",
    "src/schemas/locations.ts",
    "src/schemas/sessions.ts",
    "src/schemas/cdrs.ts",
    "src/schemas/tariffs.ts",
    "src/schemas/tokens.ts",
    "src/schemas/commands.ts",
    "src/schemas/credentials.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: "dist",
  target: "node18",
  shims: true,
  minify: true,
  treeshake: true,
  // Avoid bundling node built-ins — let the consumer's runtime handle them
  external: ["node:events", "node:http", "node:crypto"],
});
