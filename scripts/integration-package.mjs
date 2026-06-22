#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_EXE = path.join(
  ROOT,
  "out",
  "Satisfactory Save Map Uploader-win32-x64",
  "SatisfactorySaveMapUploader.exe",
);
const SENTINEL = "SAFE_LOCAL_SYNTHETIC_SAV_TEST";
const TIMEOUT_MS = 30_000;

async function main() {
  await assertPackageExe();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "satisfactory-integration-"));
  const token = crypto.randomBytes(16).toString("hex");
  const savePath = path.join(root, "synthetic.sav");
  const resultPath = path.join(root, "result.json");
  const saveBytes = Buffer.from(SENTINEL, "utf8");
  await fs.writeFile(savePath, saveBytes);
  const expectedSha256 = sha256(saveBytes);
  const serverState = { requests: 0 };
  const server = await startFixtureServer({
    token,
    expectedFileName: path.basename(savePath),
    expectedSize: saveBytes.length,
    expectedSha256,
    serverState,
  });
  const url = `http://127.0.0.1:${server.port}/fixture?token=${token}`;

  let residual = { checked: false, count: -1, method: "not checked" };
  let cleaned = false;
  try {
    console.log(`Fixture server: http://127.0.0.1:${server.port}/fixture?token=<redacted>`);
    console.log(`Synthetic save: ${savePath}`);
    console.log(`Synthetic save size: ${saveBytes.length} bytes`);
    console.log(`Synthetic save SHA-256: ${expectedSha256}`);

    const childResult = await runPackagedExe({
      url,
      root,
      savePath,
      resultPath,
      token,
    });
    residual = await checkResidualProcesses(childResult.pid, token);
    const result = JSON.parse(await fs.readFile(resultPath, "utf8"));
    if (!result.ok) {
      console.error(`Integration result: ${JSON.stringify(result, null, 2)}`);
      throw new Error(`Packaged integration failed: ${result.error ?? "unknown error"}`);
    }

    const page = result.pageResult;
    const telemetry = result.telemetry;
    console.log(`Fixture HTTP requests: ${serverState.requests}`);
    console.log(`Received file name: ${page.fileName}`);
    console.log(`Received file size: ${page.size} bytes`);
    console.log(`Received file SHA-256: ${page.sha256}`);
    console.log(`Content verified: ${page.contentMatches}`);
    console.log(
      `DOM upload panel transition: visible=${page.visibleBefore}, hidden=${page.hiddenDuring}, visibleAfter=${page.visibleAfter}`,
    );
    console.log(
      `DOM.setFileInputFiles executed: ${telemetry.cdpCommands.includes("DOM.setFileInputFiles")}`,
    );
    console.log(`CDP commands: ${telemetry.cdpCommands.join(", ")}`);
    console.log(`Debugger attach succeeded: ${telemetry.debuggerAttachSucceeded}`);
    console.log(`Debugger detach succeeded: ${telemetry.debuggerDetachSucceeded}`);
    console.log(`Background throttling calls: ${telemetry.backgroundThrottling.join(", ")}`);
    console.log(`Allowed loopback requests: ${telemetry.allowedLoopbackRequests}`);
    console.log(`External request attempts: ${telemetry.externalRequestAttempts}`);
    console.log(`Blocked requests: ${telemetry.blockedRequests}`);
    console.log(`Saw satisfactory-calculator.com: ${telemetry.sawSatisfactoryCalculator}`);
    console.log(
      `Residual process check: ${residual.checked ? residual.count : "not checked"} (${residual.method})`,
    );
    if (residual.checked && residual.count !== 0) {
      throw new Error(`Residual Electron processes were found: ${residual.count}`);
    }
    console.log(`Packaged integration test passed: ${PACKAGE_EXE}`);
  } finally {
    await server.close();
    await fs.rm(root, { recursive: true, force: true });
    cleaned = !(await pathExists(root));
    console.log(`Temporary directory cleaned: ${cleaned}`);
  }
}

async function assertPackageExe() {
  try {
    const stats = await fs.stat(PACKAGE_EXE);
    if (!stats.isFile()) {
      throw new Error("not a file");
    }
  } catch (error) {
    throw new Error(
      `Packaged app executable not found. Run pnpm run package first. ${errorMessage(error)}`,
    );
  }
}

function startFixtureServer(options) {
  const server = http.createServer((request, response) => {
    options.serverState.requests += 1;
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (
      requestUrl.pathname !== "/fixture" ||
      requestUrl.searchParams.get("token") !== options.token
    ) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(createFixtureHtml(options));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Fixture server did not bind to a TCP port."));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
      });
    });
  });
}

function createFixtureHtml(options) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Local Upload Fixture</title>
</head>
<body>
  <div id="dropSaveGame">
    <input id="saveGameFileInput" type="file" accept=".sav" />
  </div>
  <pre id="result"></pre>
  <script>
    const expected = ${JSON.stringify({
      fileName: options.expectedFileName,
      size: options.expectedSize,
      sha256: options.expectedSha256,
      sentinel: SENTINEL,
    })};
    const drop = document.querySelector("#dropSaveGame");
    const input = document.querySelector("#saveGameFileInput");
    const resultElement = document.querySelector("#result");
    let handled = false;

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    }

    async function sha256Hex(buffer) {
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    }

    async function handleFile() {
      if (handled) return;
      handled = true;
      const visibleBefore = isVisible(drop);
      try {
        const file = input.files && input.files[0];
        if (!file) throw new Error("missing file");
        drop.style.display = "none";
        const hiddenDuring = !isVisible(drop);
        const buffer = await file.arrayBuffer();
        input.value = "";
        const text = new TextDecoder().decode(buffer);
        const sha256 = await sha256Hex(buffer);
        const contentMatches =
          file.name === expected.fileName &&
          file.size === expected.size &&
          sha256 === expected.sha256 &&
          text === expected.sentinel &&
          file.name.toLowerCase().endsWith(".sav");
        window.__satisfactoryIntegrationResult = {
          ok: contentMatches,
          fileName: file.name,
          size: file.size,
          sha256,
          contentMatches,
          visibleBefore,
          hiddenDuring,
          visibleAfter: false
        };
      } catch (error) {
        window.__satisfactoryIntegrationResult = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          visibleBefore,
          hiddenDuring: false,
          visibleAfter: false
        };
      }
      setTimeout(() => {
        drop.style.display = "";
        window.__satisfactoryIntegrationResult.visibleAfter = isVisible(drop);
        window.__satisfactoryIntegrationResult.ok =
          window.__satisfactoryIntegrationResult.ok &&
          window.__satisfactoryIntegrationResult.hiddenDuring &&
          window.__satisfactoryIntegrationResult.visibleAfter;
        resultElement.textContent = JSON.stringify(window.__satisfactoryIntegrationResult);
      }, 500);
    }

    input.addEventListener("input", handleFile);
    input.addEventListener("change", handleFile);
    window.__satisfactoryIntegrationResult = { ok: false, waiting: true };
  </script>
</body>
</html>`;
}

function runPackagedExe(options) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      PACKAGE_EXE,
      [
        "--integration-test-upload",
        `--integration-root=${options.root}`,
        `--integration-url=${options.url}`,
        `--integration-save=${options.savePath}`,
        `--integration-result=${options.resultPath}`,
        `--integration-token=${options.token}`,
      ],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Packaged integration test timed out after ${TIMEOUT_MS}ms.`));
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ pid: child.pid, stdout: Buffer.concat(stdout).toString("utf8") });
        return;
      }
      reject(
        new Error(
          [
            `Packaged integration test failed with code ${code} signal ${signal ?? "none"}.`,
            Buffer.concat(stdout).toString("utf8"),
            Buffer.concat(stderr).toString("utf8"),
          ].join("\n"),
        ),
      );
    });
  });
}

async function checkResidualProcesses(parentPid, token) {
  if (process.platform !== "win32") {
    return { checked: false, count: -1, method: "non-Windows platform" };
  }
  const command = [
    "$parentPid = [int]$env:INTEGRATION_PARENT_PID",
    "$token = $env:INTEGRATION_TOKEN",
    "$matches = @(Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $parentPid -or ($_.CommandLine -and $_.CommandLine.Contains($token)) })",
    "$matches.Count",
  ].join("; ");
  const encoded = Buffer.from(command, "utf16le").toString("base64");
  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      {
        env: {
          ...process.env,
          INTEGRATION_PARENT_PID: String(parentPid),
          INTEGRATION_TOKEN: token,
        },
      },
    );
    return {
      checked: true,
      count: Number(stdout.trim() || "0"),
      method: "Get-CimInstance ParentProcessId or redacted token",
    };
  } catch (error) {
    return { checked: false, count: -1, method: errorMessage(error) };
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

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
