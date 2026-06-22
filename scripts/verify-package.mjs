#!/usr/bin/env node

import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import asar from "@electron/asar";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "out");
const EXPECTED_PACKAGE_DIR_NAME = "Satisfactory Save Map Watcher-win32-x64";
const EXE_NAME = "SatisfactorySaveMapWatcher.exe";
const MAKE_DIR = path.join(ROOT, "out", "make", "squirrel.windows", "x64");
const REQUIRED_PACKAGE_FILES = [
  EXE_NAME,
  "resources/app.asar",
  "chrome_100_percent.pak",
  "chrome_200_percent.pak",
  "resources.pak",
  "icudtl.dat",
  "ffmpeg.dll",
  "v8_context_snapshot.bin",
];
const REQUIRED_ASAR_ENTRIES = [
  ".vite/build/app.js",
  ".vite/build/preload.js",
  ".vite/build/package.json",
  ".vite/renderer/main_window/index.html",
  "package.json",
];
const EXPECTED_FUSES = {
  RunAsNode: false,
  EnableCookieEncryption: true,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  EnableEmbeddedAsarIntegrityValidation: true,
  OnlyLoadAppFromAsar: true,
};

export function findForbiddenArtifacts(paths) {
  return paths.filter((candidate) => {
    const normalized = normalizeArtifactPath(candidate);
    return (
      normalized.includes("/node_modules/playwright/") ||
      normalized.includes("/node_modules/@playwright/") ||
      normalized.includes("/ms-playwright/") ||
      normalized.includes("/.local-browsers/") ||
      normalized.includes("/chrome-win/") ||
      normalized.startsWith("resources/app/") ||
      normalized.includes("/test/") ||
      normalized.includes("/tests/") ||
      normalized.includes("/fixtures/") ||
      normalized.includes("/coverage/") ||
      normalized.endsWith(".tsbuildinfo")
    );
  });
}

export function summarizeSourceMaps(paths) {
  const sourceMaps = paths.filter((candidate) => normalizeArtifactPath(candidate).endsWith(".map"));
  return {
    found: sourceMaps.length > 0,
    count: sourceMaps.length,
    examples: sourceMaps.slice(0, 10),
  };
}

export function parseFuseReadOutput(output) {
  const result = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z0-9]+) is (Enabled|Disabled)$/);
    if (match) {
      result[match[1]] = match[2] === "Enabled";
    }
  }
  return result;
}

export function getPackagedMetadataIssues(rootPackageJson, packagedPackageJson) {
  const issues = [];
  if (
    packagedPackageJson.name !== rootPackageJson.name ||
    packagedPackageJson.version !== rootPackageJson.version
  ) {
    issues.push("Packaged package.json name/version does not match root package.json.");
  }
  if (packagedPackageJson.main !== ".vite/build/app.js") {
    issues.push(
      `Packaged package.json main must be .vite/build/app.js, got ${packagedPackageJson.main}.`,
    );
  }
  if (packagedPackageJson.type !== "commonjs") {
    issues.push(
      `Packaged package.json type must be commonjs for the Vite main bundle, got ${packagedPackageJson.type}.`,
    );
  }
  return issues;
}

export async function findUnpackedPackageDirectory(outRoot) {
  const expectedPath = path.join(outRoot, EXPECTED_PACKAGE_DIR_NAME);
  const expectedCandidate = (await isUnpackedPackageDirectory(expectedPath)) ? expectedPath : null;
  if (expectedCandidate) {
    return expectedCandidate;
  }

  const entries = await fs.readdir(outRoot, { withFileTypes: true }).catch(() => []);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = path.join(outRoot, entry.name);
    if (await isUnpackedPackageDirectory(candidate)) {
      candidates.push(candidate);
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }
  if (candidates.length > 1) {
    throw new Error(`Multiple unpacked package directories found:\n${candidates.join("\n")}`);
  }

  const available = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  throw new Error(
    `Missing unpacked package directory under ${outRoot}. Available directories: ${
      available.length > 0 ? available.join(", ") : "none"
    }`,
  );
}

async function isUnpackedPackageDirectory(candidate) {
  return (
    (await pathExists(path.join(candidate, EXE_NAME))) &&
    (await pathExists(path.join(candidate, "resources", "app.asar")))
  );
}

function normalizeArtifactPath(candidate) {
  return candidate.replaceAll("\\", "/").replace(/^\/+/, "").toLowerCase();
}

async function main() {
  const mode = process.argv[2] ?? "package";
  if (!["package", "make", "all"].includes(mode)) {
    throw new Error(`Unknown verification mode: ${mode}`);
  }

  if (mode === "package" || mode === "all") {
    await verifyPackage();
  }
  if (mode === "make" || mode === "all") {
    await verifyMake();
  }
}

async function verifyPackage() {
  const packageJson = await readPackageJson();
  const packageDir = await findUnpackedPackageDirectory(OUT_DIR);
  const exePath = path.join(packageDir, EXE_NAME);
  const appAsarPath = path.join(packageDir, "resources", "app.asar");
  const resourcesAppPath = path.join(packageDir, "resources", "app");

  for (const requiredFile of REQUIRED_PACKAGE_FILES) {
    await assertPathExists(path.join(packageDir, requiredFile), requiredFile);
  }
  if (await pathExists(resourcesAppPath)) {
    throw new Error(`Forbidden unpacked app directory exists: ${resourcesAppPath}`);
  }

  const physicalFiles = await listFiles(packageDir);
  const physicalRelative = physicalFiles.map((file) => path.relative(packageDir, file));
  const asarEntries = asar
    .listPackage(appAsarPath)
    .map((entry) => `resources/app.asar/${entry.replace(/^\/+/, "")}`);
  const normalizedAsarEntries = new Set(asar.listPackage(appAsarPath).map(normalizeArtifactPath));
  for (const requiredEntry of REQUIRED_ASAR_ENTRIES) {
    if (!normalizedAsarEntries.has(normalizeArtifactPath(requiredEntry))) {
      throw new Error(`Missing required app.asar entry: ${requiredEntry}`);
    }
  }
  const allArtifactPaths = [...physicalRelative, ...asarEntries];
  const forbidden = findForbiddenArtifacts(allArtifactPaths);
  if (forbidden.length > 0) {
    throw new Error(`Forbidden package artifacts found:\n${forbidden.join("\n")}`);
  }

  const asarPackageJson = JSON.parse(
    asar.extractFile(appAsarPath, "package.json").toString("utf8"),
  );
  const metadataIssues = getPackagedMetadataIssues(packageJson, asarPackageJson);
  if (metadataIssues.length > 0) {
    throw new Error(`Packaged package.json metadata is invalid:\n${metadataIssues.join("\n")}`);
  }

  const sourceMaps = summarizeSourceMaps(allArtifactPaths);
  if (sourceMaps.found) {
    throw new Error(`Production source maps found:\n${sourceMaps.examples.join("\n")}`);
  }

  const packageSize = await getDirectorySize(packageDir);
  const appAsarStats = await fs.stat(appAsarPath);
  const largestFiles = await getLargestFiles(packageDir, 20);
  const electronVersion = await readTextIfExists(path.join(packageDir, "version"));
  const fuseOutput = await readFuses(exePath);
  const fuses = parseFuseReadOutput(fuseOutput);
  assertExpectedFuses(fuses);
  const authenticode = await getAuthenticodeStatus(exePath);
  const suspectedBrowsers = findSuspectedBrowserArtifacts(physicalRelative);

  console.log("Package verification passed.");
  console.log(`Unpacked package: ${packageDir}`);
  console.log(`Unpacked package size: ${formatBytes(packageSize)}`);
  console.log(`app.asar size: ${formatBytes(appAsarStats.size)}`);
  console.log(`Electron version: ${electronVersion.trim() || "unknown"}`);
  console.log(`Authenticode status: ${authenticode.status} (${authenticode.message})`);
  console.log("Fuse states:");
  for (const [name, enabled] of Object.entries(fuses)) {
    if (name in EXPECTED_FUSES) {
      console.log(`  ${name}: ${enabled ? "Enabled" : "Disabled"}`);
    }
  }
  console.log(`Production source maps: ${sourceMaps.found ? sourceMaps.count : "none"}`);
  console.log(
    `Second browser artifacts: ${suspectedBrowsers.length > 0 ? suspectedBrowsers.join(", ") : "none"}`,
  );
  console.log("Largest files:");
  for (const file of largestFiles) {
    console.log(`  ${formatBytes(file.size)}  ${path.relative(packageDir, file.path)}`);
  }
}

async function verifyMake() {
  const packageJson = await readPackageJson();
  const expectedSetup = path.join(MAKE_DIR, "SatisfactorySaveMapWatcher-Setup.exe");
  const expectedNupkg = path.join(
    MAKE_DIR,
    `SatisfactorySaveMapWatcher-${packageJson.version}-full.nupkg`,
  );
  const expectedReleases = path.join(MAKE_DIR, "RELEASES");
  const expectedFiles = [expectedSetup, expectedNupkg, expectedReleases];

  await assertPathExists(MAKE_DIR, "Squirrel maker directory");
  for (const file of expectedFiles) {
    await assertPathExists(file, path.basename(file));
  }

  console.log("Installer verification passed.");
  for (const file of expectedFiles) {
    const stats = await fs.stat(file);
    const checksumPath = `${file}.sha256`;
    const checksum = await sha256File(file);
    await fs.writeFile(checksumPath, `${checksum}  ${path.basename(file)}\n`, "ascii");
    console.log(`${file}`);
    console.log(`  Size: ${formatBytes(stats.size)}`);
    console.log(`  SHA-256: ${checksum}`);
    console.log(`  Checksum file: ${checksumPath}`);
  }
}

function assertExpectedFuses(actual) {
  for (const [name, expected] of Object.entries(EXPECTED_FUSES)) {
    if (actual[name] !== expected) {
      throw new Error(
        `Unexpected fuse state for ${name}: expected ${expected ? "Enabled" : "Disabled"}`,
      );
    }
  }
}

function findSuspectedBrowserArtifacts(paths) {
  return paths.filter((candidate) => {
    const normalized = normalizeArtifactPath(candidate);
    return (
      normalized.includes("/ms-playwright/") ||
      normalized.includes("/.local-browsers/") ||
      normalized.includes("/chrome-win/") ||
      normalized.endsWith("/chrome.exe")
    );
  });
}

async function readFuses(exePath) {
  const fuseCli = path.join(ROOT, "node_modules", "@electron", "fuses", "dist", "bin.js");
  const { stdout } = await execFileAsync(process.execPath, [fuseCli, "read", "--app", exePath], {
    cwd: ROOT,
  });
  return stdout;
}

async function getAuthenticodeStatus(exePath) {
  if (process.platform !== "win32") {
    return { status: "NotChecked", message: "Authenticode is checked only on Windows." };
  }

  try {
    const command = [
      "$signature = Get-AuthenticodeSignature -LiteralPath $env:TARGET_EXE",
      "[string]$signature.Status",
      "[string]$signature.StatusMessage",
    ].join("; ");
    const encodedCommand = Buffer.from(command, "utf16le").toString("base64");
    const { stdout } = await execPowerShell(encodedCommand, exePath);
    const [status = "", ...messageLines] = stdout.trim().split(/\r?\n/);
    const message = messageLines.join(" ").trim();
    return {
      status: status || "Unknown",
      message: message || "No Authenticode status message.",
    };
  } catch (error) {
    return {
      status: "Unknown",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function execPowerShell(encodedCommand, exePath) {
  const argsByHost = [
    { command: "pwsh", args: ["-NoProfile", "-EncodedCommand", encodedCommand] },
    {
      command: "powershell",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodedCommand],
    },
  ];

  let lastError;
  for (const candidate of argsByHost) {
    try {
      return await execFileAsync(candidate.command, candidate.args, {
        env: { ...process.env, TARGET_EXE: exePath },
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function readPackageJson() {
  return JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
}

async function assertPathExists(targetPath, label) {
  if (!(await pathExists(targetPath))) {
    throw new Error(`Missing ${label}: ${targetPath}`);
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function getDirectorySize(root) {
  const files = await listFiles(root);
  let total = 0;
  for (const file of files) {
    total += (await fs.stat(file)).size;
  }
  return total;
}

async function getLargestFiles(root, count) {
  const files = await listFiles(root);
  const withSizes = [];
  for (const file of files) {
    withSizes.push({ path: file, size: (await fs.stat(file)).size });
  }
  return withSizes.sort((a, b) => b.size - a.size).slice(0, count);
}

async function readTextIfExists(targetPath) {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return "";
  }
}

async function sha256File(targetPath) {
  const hash = crypto.createHash("sha256");
  const file = await fs.open(targetPath, "r");
  try {
    for await (const chunk of file.createReadStream()) {
      hash.update(chunk);
    }
  } finally {
    await file.close();
  }
  return hash.digest("hex").toUpperCase();
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
