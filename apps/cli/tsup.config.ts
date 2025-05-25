import { defineConfig } from "tsup";

export default defineConfig([
  // Main library entry
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: true,
    dts: true,
    sourcemap: true,
    splitting: false,
    bundle: true,
    minify: false,
    shims: true,
  },
  // CLI binary entry with shebang
  {
    entry: { "bin/launchpad": "src/bin/launchpad.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: false, // Don't clean since we're building multiple entries
    dts: true,
    sourcemap: true,
    splitting: false,
    bundle: true,
    minify: false,
    shims: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
