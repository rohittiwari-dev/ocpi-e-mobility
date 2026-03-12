import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/client/index.ts",
    "src/schemas/index.ts",
    "src/schemas/locations.ts",
    "src/schemas/sessions.ts",
    "src/schemas/cdrs.ts",
    "src/schemas/tariffs.ts",
    "src/schemas/tokens.ts",
    "src/schemas/commands.ts",
    "src/schemas/credentials.ts",
    "src/modules/index.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: "dist",
});
