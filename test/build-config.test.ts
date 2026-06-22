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
    expect(allDependencies).toHaveProperty("@radix-ui/react-separator");
    expect(allDependencies).toHaveProperty("@radix-ui/react-slot");

    expect(allDependencies).not.toHaveProperty("@electron-forge/plugin-webpack");
    expect(allDependencies).not.toHaveProperty("webpack");
    expect(allDependencies).not.toHaveProperty("ts-loader");
    expect(allDependencies).not.toHaveProperty("css-loader");
    expect(allDependencies).not.toHaveProperty("style-loader");
  });

  it("activates pnpm with Corepack before workflow pnpm commands", async () => {
    const workflows = await Promise.all([
      readFile(".github/workflows/ci.yml", "utf8"),
      readFile(".github/workflows/release.yml", "utf8"),
    ]);

    for (const workflow of workflows) {
      expect(workflow).toContain("corepack enable");
      expect(workflow).toContain("corepack prepare pnpm@10.33.0 --activate");
      expect(workflow).not.toContain("cache: pnpm");
      expect(workflow).toContain("package-manager-cache: false");
    }
  });

  it("keeps CI Windows-only with LF text checkouts", async () => {
    const [ciWorkflow, gitAttributes] = await Promise.all([
      readFile(".github/workflows/ci.yml", "utf8"),
      readFile(".gitattributes", "utf8"),
    ]);

    expect(ciWorkflow).toContain("runs-on: windows-latest");
    expect(ciWorkflow).not.toContain("runs-on: ubuntu-latest");
    expect(ciWorkflow).not.toContain("name: Linux");
    expect(gitAttributes).toContain("* text=auto eol=lf");
  });

  it("does not pin workflow actions to deprecated major versions", async () => {
    const workflows = await Promise.all([
      readFile(".github/workflows/ci.yml", "utf8"),
      readFile(".github/workflows/release.yml", "utf8"),
    ]);

    for (const workflow of workflows) {
      expect(workflow).toContain("# v5");
      expect(workflow).not.toContain("# v4");
    }
  });
});
