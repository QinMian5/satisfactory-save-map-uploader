// abstract: Static tests for the Electron Forge Vite build configuration.
// out_of_scope: Real packaging, renderer runtime behavior, and Electron process startup.

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("build configuration", () => {
  it("uses Electron Forge Vite instead of Webpack", async () => {
    const config = await readFile("forge.config.ts", "utf8");

    expect(config).toContain("@electron-forge/plugin-vite");
    expect(config).toContain("VitePlugin");
    expect(config).not.toContain("@electron-forge/plugin-webpack");
    expect(config).not.toContain("WebpackPlugin");
  });

  it("declares React, Tailwind, and Vite dependencies without Webpack loaders", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    expect(allDependencies).toHaveProperty("react");
    expect(allDependencies).toHaveProperty("react-dom");
    expect(allDependencies).toHaveProperty("@electron-forge/plugin-vite");
    expect(allDependencies).toHaveProperty("vite");
    expect(allDependencies).toHaveProperty("@vitejs/plugin-react");
    expect(allDependencies).toHaveProperty("tailwindcss");
    expect(allDependencies).toHaveProperty("@tailwindcss/vite");
    expect(allDependencies).toHaveProperty("lucide-react");
    expect(allDependencies).toHaveProperty("class-variance-authority");
    expect(allDependencies).toHaveProperty("tailwind-merge");
    expect(allDependencies).toHaveProperty("clsx");
    expect(allDependencies).toHaveProperty("@radix-ui/react-alert-dialog");
    expect(allDependencies).toHaveProperty("@radix-ui/react-collapsible");
    expect(allDependencies).toHaveProperty("@radix-ui/react-scroll-area");
    expect(allDependencies).toHaveProperty("@radix-ui/react-separator");
    expect(allDependencies).toHaveProperty("@radix-ui/react-slot");

    expect(allDependencies).not.toHaveProperty("@electron-forge/plugin-webpack");
    expect(allDependencies).not.toHaveProperty("webpack");
    expect(allDependencies).not.toHaveProperty("ts-loader");
    expect(allDependencies).not.toHaveProperty("css-loader");
    expect(allDependencies).not.toHaveProperty("style-loader");
  });
});
