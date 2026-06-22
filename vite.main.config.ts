// abstract: Vite build settings for the Electron main-process bundle.
// out_of_scope: Renderer bundling, Electron Forge makers, and runtime services.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  build: {
    sourcemap: command === "serve",
  },
  plugins: [commonJsPackageScope()],
}));

function commonJsPackageScope(): Plugin {
  let outputDirectory = "";

  return {
    name: "satisfactory-main-commonjs-package-scope",
    configResolved(config) {
      outputDirectory = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(
        path.join(outputDirectory, "package.json"),
        `${JSON.stringify({ type: "commonjs" })}\n`,
        "utf8",
      );
    },
  };
}
