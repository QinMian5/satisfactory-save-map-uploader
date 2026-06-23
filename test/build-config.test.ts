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
    expect(allDependencies).toHaveProperty("electron-builder");
    expect(allDependencies).toHaveProperty("lucide-react");
    expect(allDependencies).toHaveProperty("class-variance-authority");
    expect(allDependencies).toHaveProperty("tailwind-merge");
    expect(allDependencies).toHaveProperty("clsx");
    expect(allDependencies).toHaveProperty("@radix-ui/react-alert-dialog");
    expect(allDependencies).toHaveProperty("@radix-ui/react-collapsible");
    expect(allDependencies).toHaveProperty("@radix-ui/react-separator");
    expect(allDependencies).toHaveProperty("@radix-ui/react-slot");
    expect(allDependencies).toHaveProperty("@radix-ui/react-tooltip");

    expect(allDependencies).not.toHaveProperty("@electron-forge/plugin-webpack");
    expect(allDependencies).not.toHaveProperty("@electron-forge/maker-squirrel");
    expect(allDependencies).not.toHaveProperty("electron-squirrel-startup");
    expect(allDependencies).not.toHaveProperty("webpack");
    expect(allDependencies).not.toHaveProperty("ts-loader");
    expect(allDependencies).not.toHaveProperty("css-loader");
    expect(allDependencies).not.toHaveProperty("style-loader");
  });

  it("uses the latest Vite 7 toolchain compatible with Electron Forge", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));

    expect(packageJson.devDependencies.vite).toBe("^7.3.5");
    expect(packageJson.devDependencies["@vitejs/plugin-react"]).toBe("^5.2.0");
  });

  it("uses uploader product metadata and builds GitHub release artifacts", async () => {
    const [packageJsonText, builderConfig, forgeConfig, appMetadata, makeScript] =
      await Promise.all([
        readFile("package.json", "utf8"),
        readFile("electron-builder.config.cjs", "utf8"),
        readFile("forge.config.ts", "utf8"),
        readFile("config/app-metadata.ts", "utf8"),
        readFile("scripts/make-windows.mjs", "utf8"),
      ]);
    const packageJson = JSON.parse(packageJsonText);

    expect(packageJson.name).toBe("satisfactory-save-map-uploader");
    expect(packageJson.productName).toBe("Satisfactory Save Map Uploader");
    expect(packageJson.author).toBe("Mian Qin");
    const packageScripts = Object.entries(packageJson.scripts)
      .filter(([name]) => name === "package" || name.startsWith("make"))
      .map(([, script]) => script)
      .join("\n");
    expect(packageJson.scripts.package).toBe("node scripts/package-windows.mjs");
    expect(packageJson.scripts.make).toBe("node scripts/make-windows.mjs nsis zip");
    expect(packageJson.scripts.make).not.toContain("--win appx");
    expect(packageJson.scripts["make:installer"]).toBe("node scripts/make-windows.mjs nsis");
    expect(packageJson.scripts["make:portable"]).toBe("node scripts/make-windows.mjs zip");
    expect(packageJson.scripts["make:appx"]).toBe("node scripts/make-windows.mjs appx");
    expect(packageScripts).not.toContain("Satisfactory Save Map Uploader-win32-x64");
    expect(packageJson.scripts["verify:make"]).toContain("verify-package.mjs make");
    expect(packageJson.scripts["verify:installer"]).toContain("verify-package.mjs installer");
    expect(packageJson.scripts["verify:portable"]).toContain("verify-package.mjs portable");
    expect(makeScript).toContain('"--publish"');
    expect(makeScript).toContain('"never"');
    expect(builderConfig).toContain('appId: "com.mianqin.satisfactory-save-map-uploader"');
    expect(builderConfig).toContain('target: ["nsis", "zip"]');
    expect(builderConfig).toContain("SatisfactorySaveMapUploader-Installer-");
    expect(builderConfig).toContain("SatisfactorySaveMapUploader-Portable-");
    expect(builderConfig).not.toContain("SatisfactorySaveMapUploader-Setup-");
    expect(builderConfig).toContain('identityName: "MianQin.SatisfactorySaveMapUploader"');
    expect(builderConfig).toContain('displayName: "Satisfactory Save Map Uploader"');
    expect(builderConfig).toContain('publisher: "CN=DCC117A3-6615-4987-B0AD-FF45756501E3"');
    expect(builderConfig).toContain('publisherDisplayName: "Mian Qin"');
    expect(appMetadata).toContain('packageIdentityName: "MianQin.SatisfactorySaveMapUploader"');
    expect(appMetadata).toContain('publisher: "CN=DCC117A3-6615-4987-B0AD-FF45756501E3"');
    expect(appMetadata).toContain('publisherDisplayName: "Mian Qin"');
    expect(appMetadata).toContain(
      'packageFamilyName: "MianQin.SatisfactorySaveMapUploader_xrv9fnatjde9j"',
    );
    expect(appMetadata).toContain('partnerCenterProductId: "9PHQ2D03K6ZS"');
    expect(appMetadata).toContain('author: "Mian Qin"');
    expect(appMetadata).toContain('appId: "com.mianqin.satisfactory-save-map-uploader"');
    expect(forgeConfig).not.toContain("MakerSquirrel");
    expect(forgeConfig).not.toContain("@electron-forge/maker-squirrel");
    expect(packageJson.scripts.make).not.toContain("electron-forge make");
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

  it("pins GitHub Actions to the verified Node runtime", async () => {
    const workflows = await Promise.all([
      readFile(".github/workflows/ci.yml", "utf8"),
      readFile(".github/workflows/release.yml", "utf8"),
    ]);

    for (const workflow of workflows) {
      expect(workflow).toContain("node-version: 24.14.0");
      expect(workflow).not.toContain("node-version: 24\n");
    }
  });
});
