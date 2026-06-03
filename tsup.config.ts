import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    target: "node18",
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    shims: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node18",
    dts: true,
    sourcemap: true,
    splitting: false,
    shims: true,
  },
]);
