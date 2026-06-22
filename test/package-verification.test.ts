// abstract: Tests for package verification helpers without requiring a built Electron package.
// out_of_scope: Real packaged app inspection, Authenticode checks, and checksum file creation.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findForbiddenArtifacts,
  findUnpackedPackageDirectory,
  getPackagedMetadataIssues,
  parseFuseReadOutput,
  summarizeSourceMaps,
} from "../scripts/verify-package.mjs";

describe("package verification helpers", () => {
  it("detects forbidden Playwright, unpacked source, and test artifacts", () => {
    expect(
      findForbiddenArtifacts([
        "resources/app.asar/.vite/build/app.js",
        "resources/app.asar/node_modules/playwright/index.js",
        "resources/app.asar/node_modules/@playwright/test/index.js",
        "resources/app.asar/ms-playwright/chromium/chrome-win/chrome.exe",
        "resources/app.asar/.local-browsers/chromium/chrome.exe",
        "resources/app.asar/test/fixtures/example.sav",
        "resources/app/index.js",
      ]),
    ).toEqual([
      "resources/app.asar/node_modules/playwright/index.js",
      "resources/app.asar/node_modules/@playwright/test/index.js",
      "resources/app.asar/ms-playwright/chromium/chrome-win/chrome.exe",
      "resources/app.asar/.local-browsers/chromium/chrome.exe",
      "resources/app.asar/test/fixtures/example.sav",
      "resources/app/index.js",
    ]);
  });

  it("does not treat Electron's own Chromium runtime files as a second browser", () => {
    expect(
      findForbiddenArtifacts([
        "chrome_100_percent.pak",
        "chrome_200_percent.pak",
        "resources.pak",
        "locales/en-US.pak",
      ]),
    ).toEqual([]);
  });

  it("parses expected fuse states from electron-fuses output", () => {
    expect(
      parseFuseReadOutput(`Analyzing app: SatisfactorySaveMapWatcher.exe
Fuse Version: v1
  RunAsNode is Disabled
  EnableCookieEncryption is Enabled
  EnableNodeOptionsEnvironmentVariable is Disabled
  EnableNodeCliInspectArguments is Disabled
  EnableEmbeddedAsarIntegrityValidation is Enabled
  OnlyLoadAppFromAsar is Enabled
`),
    ).toEqual({
      RunAsNode: false,
      EnableCookieEncryption: true,
      EnableNodeOptionsEnvironmentVariable: false,
      EnableNodeCliInspectArguments: false,
      EnableEmbeddedAsarIntegrityValidation: true,
      OnlyLoadAppFromAsar: true,
    });
  });

  it("summarizes production source map findings", () => {
    expect(
      summarizeSourceMaps([
        "resources/app.asar/.vite/build/app.js",
        "resources/app.asar/.vite/build/app.js.map",
      ]),
    ).toEqual({
      found: true,
      count: 1,
      examples: ["resources/app.asar/.vite/build/app.js.map"],
    });
  });

  it("requires packaged metadata that can load the Vite main bundle", () => {
    expect(
      getPackagedMetadataIssues(
        { name: "satisfactory-save-map-watcher", version: "0.1.0" },
        {
          name: "satisfactory-save-map-watcher",
          version: "0.1.0",
          main: ".vite/build/app.js",
          type: "commonjs",
        },
      ),
    ).toEqual([]);
    expect(
      getPackagedMetadataIssues(
        { name: "satisfactory-save-map-watcher", version: "0.1.0" },
        {
          name: "satisfactory-save-map-watcher",
          version: "0.1.0",
          main: ".vite/build/app.js",
          type: "module",
        },
      ),
    ).toEqual([
      "Packaged package.json type must be commonjs for the Vite main bundle, got module.",
    ]);
  });

  it("discovers the unpacked package directory from required package files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "verify-package-"));
    try {
      const outRoot = path.join(tempRoot, "out");
      const packageRoot = path.join(outRoot, "Unexpected Forge Name-win32-x64");
      await mkdir(path.join(packageRoot, "resources"), { recursive: true });
      await writeFile(path.join(packageRoot, "SatisfactorySaveMapWatcher.exe"), "");
      await writeFile(path.join(packageRoot, "resources", "app.asar"), "");

      await expect(findUnpackedPackageDirectory(outRoot)).resolves.toBe(packageRoot);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
