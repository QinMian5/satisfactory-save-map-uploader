#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_EXE = path.join(
  ROOT,
  "out",
  "Satisfactory Save Map Uploader-win32-x64",
  "SatisfactorySaveMapUploader.exe",
);
const TIMEOUT_MS = 30_000;

async function main() {
  await fs.access(PACKAGE_EXE);
  const logPath = path.join(os.tmpdir(), `satisfactory-smoke-${process.pid}.log`);
  try {
    await runSmokeTest(PACKAGE_EXE, logPath);
    await fs.rm(logPath, { force: true });
    console.log(`Packaged smoke test passed: ${PACKAGE_EXE}`);
  } catch (error) {
    await printSmokeLog(logPath);
    throw error;
  }
}

function runSmokeTest(exePath, logPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, ["--smoke-test", `--smoke-log=${logPath}`], {
      cwd: path.dirname(exePath),
      stdio: "inherit",
      env: { ...process.env, SATISFACTORY_SMOKE_LOG: logPath },
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Packaged smoke test timed out after ${TIMEOUT_MS}ms.`));
    }, TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Packaged smoke test failed with code ${code} signal ${signal ?? "none"}.`));
    });
  });
}

async function printSmokeLog(logPath) {
  try {
    const contents = await fs.readFile(logPath, "utf8");
    console.error(`Smoke log (${logPath}):\n${contents}`);
  } catch {
    console.error(`Smoke log was not created: ${logPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
