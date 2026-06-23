#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getExpectedPackageDirectory } from "./package-paths.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED_TARGETS = new Set(["nsis", "zip", "appx"]);

async function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0 || targets.some((target) => !ALLOWED_TARGETS.has(target))) {
    throw new Error("Usage: node scripts/make-windows.mjs <nsis|zip|appx> [...targets]");
  }

  const packageJson = await readPackageJson();
  const prepackagedPath = path
    .relative(ROOT, getExpectedPackageDirectory(packageJson, ROOT))
    .replaceAll(path.sep, "/");
  await run("pnpm", ["run", "package"]);
  await run("pnpm", [
    "exec",
    "electron-builder",
    "--win",
    ...targets,
    "--x64",
    "--prepackaged",
    prepackagedPath,
    "--config",
    "electron-builder.config.cjs",
    "--publish",
    "never",
  ]);
  if (targets.includes("zip")) {
    await createPortableZip(packageJson);
  }
}

async function createPortableZip(packageJson) {
  const packageDir = getExpectedPackageDirectory(packageJson, ROOT);
  const portableRootName = path.basename(packageDir);
  const portableZip = path.join(ROOT, "out", "make", `${portableRootName}.zip`);
  await fs.rm(portableZip, { force: true });
  await runPowerShell(
    [
      "$ErrorActionPreference = 'Stop'",
      "Compress-Archive -LiteralPath $env:PORTABLE_SOURCE -DestinationPath $env:PORTABLE_ZIP -Force",
    ].join("; "),
    {
      PORTABLE_SOURCE: packageDir,
      PORTABLE_ZIP: portableZip,
    },
  );
  console.log(`Portable zip root directory: ${portableRootName}`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} failed with code ${code} signal ${signal ?? "none"}.`));
    });
  });
}

function runPowerShell(command, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      {
        cwd: ROOT,
        env: { ...process.env, ...extraEnv },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`powershell failed with code ${code} signal ${signal ?? "none"}.`));
    });
  });
}

function spawnCommand(command, args, options) {
  if (process.platform !== "win32") {
    return spawn(command, args, options);
  }
  return spawn("cmd.exe", ["/d", "/s", "/c", commandLine(command, args)], options);
}

function commandLine(command, args) {
  return [command, ...args].map(quoteCommandArg).join(" ");
}

function quoteCommandArg(value) {
  if (/^[a-zA-Z0-9._/:=+-]+$/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '\\"')}"`;
}

async function readPackageJson() {
  return JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
