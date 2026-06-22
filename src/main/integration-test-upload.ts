// abstract: Packaged local Electron/CDP integration-test mode and strict test config parsing.
// out_of_scope: Normal renderer IPC commands, production map URL selection, and real save discovery.

import { lstat, mkdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { App } from "electron";
import {
  type DebuggerPort,
  ElectronSaveUploader,
  type MapWindowPort,
} from "../services/save-uploader.js";
import type { PermissionSession } from "./security/permissions.js";
import { MapWindowManager } from "./windows/map-window.js";

export type IntegrationUploadConfig = {
  root: string;
  targetUrl: string;
  allowedOrigin: string;
  savePath: string;
  resultPath: string;
  token: string;
};

export type IntegrationTelemetry = {
  allowedLoopbackRequests: number;
  externalRequestAttempts: number;
  blockedRequests: number;
  sawSatisfactoryCalculator: boolean;
  cdpCommands: string[];
  debuggerAttachSucceeded: boolean;
  debuggerDetachSucceeded: boolean;
  backgroundThrottling: boolean[];
};

type IntegrationAppPort = Pick<App, "exit">;

type RequestDetails = {
  url: string;
};

type RequestCallback = (response: { cancel?: boolean }) => void;

type RequestGuardSession = PermissionSession & {
  webRequest?: {
    onBeforeRequest: (
      filter: { urls: string[] },
      listener: (details: RequestDetails, callback: RequestCallback) => void,
    ) => void;
  };
};

const DEFAULT_INTEGRATION_TIMEOUT_MS = 20_000;

type ParsedArgs = {
  root?: string;
  url?: string;
  save?: string;
  result?: string;
  token?: string;
};

export async function parseIntegrationUploadConfig(
  argv: readonly string[],
): Promise<IntegrationUploadConfig> {
  if (!argv.includes("--integration-test-upload")) {
    throw new Error("Integration upload mode switch is missing.");
  }

  const args = parseArgs(argv);
  const root = await assertRoot(args.root);
  const token = assertToken(args.token);
  const url = assertIntegrationUrl(args.url, token);
  const savePath = await assertSavePath(args.save, root);
  const resultPath = await assertResultPath(args.result, root);

  return {
    root,
    targetUrl: url.toString(),
    allowedOrigin: url.origin,
    savePath,
    resultPath,
    token,
  };
}

async function assertRoot(value: string | undefined): Promise<string> {
  if (!value) {
    throw new Error("Integration root is required.");
  }
  if (!path.isAbsolute(value)) {
    throw new Error("Integration path must be absolute.");
  }
  return realpath(value);
}

function assertToken(value: string | undefined): string {
  if (!value || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    throw new Error("Integration token is invalid.");
  }
  return value;
}

function assertIntegrationUrl(value: string | undefined, token: string): URL {
  if (!value) {
    throw new Error("Integration URL is required.");
  }
  const url = new URL(value);
  if (url.protocol !== "http:") {
    throw new Error("Integration URL must use http.");
  }
  if (url.hostname !== "127.0.0.1") {
    throw new Error("Integration URL host must be 127.0.0.1.");
  }
  if (url.username || url.password) {
    throw new Error("Integration URL must not include credentials.");
  }
  if (!url.port || !isValidPort(url.port)) {
    throw new Error("Integration URL must include a valid port.");
  }
  if (url.searchParams.get("token") !== token) {
    throw new Error("Integration URL token does not match.");
  }
  return url;
}

async function assertSavePath(value: string | undefined, root: string): Promise<string> {
  const savePath = await assertContainedPath(value, root);
  const stats = await stat(savePath);
  if (!stats.isFile()) {
    throw new Error("Integration save path must be a regular file.");
  }
  if (path.extname(savePath).toLowerCase() !== ".sav") {
    throw new Error("Integration save path must end with .sav.");
  }
  return savePath;
}

async function assertResultPath(value: string | undefined, root: string): Promise<string> {
  if (!value) {
    throw new Error("Integration result path is required.");
  }
  if (!path.isAbsolute(value)) {
    throw new Error("Integration path must be absolute.");
  }
  const resultPath = path.resolve(value);
  assertInsideRoot(resultPath, root);
  await mkdir(path.dirname(resultPath), { recursive: true });
  const parent = await realpath(path.dirname(resultPath));
  assertInsideRoot(parent, root);

  try {
    const stats = await lstat(resultPath);
    if (stats.isSymbolicLink()) {
      throw new Error("Integration result path must not be a symbolic link.");
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
  return resultPath;
}

async function assertContainedPath(value: string | undefined, root: string): Promise<string> {
  if (!value) {
    throw new Error("Integration path is required.");
  }
  if (!path.isAbsolute(value)) {
    throw new Error("Integration path must be absolute.");
  }
  const resolved = await realpath(value);
  assertInsideRoot(resolved, root);
  return resolved;
}

function assertInsideRoot(candidate: string, root: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Integration path must stay under the integration root.");
  }
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const result: ParsedArgs = {};
  for (const arg of argv) {
    const [name, ...valueParts] = arg.split("=");
    const value = valueParts.join("=");
    if (name === "--integration-root") {
      result.root = value;
    } else if (name === "--integration-url") {
      result.url = value;
    } else if (name === "--integration-save") {
      result.save = value;
    } else if (name === "--integration-result") {
      result.result = value;
    } else if (name === "--integration-token") {
      result.token = value;
    }
  }
  return result;
}

function isValidPort(value: string): boolean {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535;
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export async function writeIntegrationResult(
  resultPath: string,
  result: Record<string, unknown>,
): Promise<void> {
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

export async function runIntegrationUploadTest(options: {
  app: IntegrationAppPort;
  config: IntegrationUploadConfig;
  userDataPath?: string;
  timeoutMs?: number;
}): Promise<void> {
  let exitCode = 1;
  let mapWindow: MapWindowManager | undefined;
  const telemetry: IntegrationTelemetry = {
    allowedLoopbackRequests: 0,
    externalRequestAttempts: 0,
    blockedRequests: 0,
    sawSatisfactoryCalculator: false,
    cdpCommands: [],
    debuggerAttachSucceeded: false,
    debuggerDetachSucceeded: false,
    backgroundThrottling: [],
  };

  try {
    await withTimeout(
      (async () => {
        mapWindow = new MapWindowManager({
          allowedOrigin: options.config.allowedOrigin,
          partition: `integration-${options.config.token}`,
          configureSession: (mapSession) => {
            installRequestGuard(
              mapSession as RequestGuardSession,
              options.config.allowedOrigin,
              telemetry,
            );
          },
          onBackgroundThrottlingChange: (allowed) => {
            telemetry.backgroundThrottling.push(allowed);
          },
        });
        const uploader = new ElectronSaveUploader({
          mapWindow: instrumentMapWindow(mapWindow, telemetry),
          targetUrl: options.config.targetUrl,
          timeoutMs: 15_000,
          processingStartTimeoutMs: 5_000,
        });

        await uploader.upload(options.config.savePath);
        const pageResult = await mapWindow
          .getOrCreateWindow()
          .webContents.executeJavaScript("window.__satisfactoryIntegrationResult", true);
        if (!isSuccessfulPageResult(pageResult)) {
          throw new Error(`Fixture page did not confirm upload: ${JSON.stringify(pageResult)}`);
        }
        if (telemetry.blockedRequests > 0 || telemetry.externalRequestAttempts > 0) {
          throw new Error("Integration test observed an external network request.");
        }
        if (telemetry.sawSatisfactoryCalculator) {
          throw new Error("Integration test attempted to access Satisfactory Calculator.");
        }
        if (!telemetry.cdpCommands.includes("DOM.setFileInputFiles")) {
          throw new Error("DOM.setFileInputFiles was not executed.");
        }
        if (!telemetry.debuggerAttachSucceeded || !telemetry.debuggerDetachSucceeded) {
          throw new Error("Debugger attach/detach did not complete.");
        }
        if (JSON.stringify(telemetry.backgroundThrottling) !== JSON.stringify([false, true])) {
          throw new Error("Background throttling was not restored after upload.");
        }
        if (mapWindow.getDebugger().isAttached()) {
          throw new Error("Debugger remained attached after upload.");
        }

        await writeIntegrationResult(options.config.resultPath, {
          ok: true,
          pageResult,
          telemetry,
        });
      })(),
      options.timeoutMs ?? DEFAULT_INTEGRATION_TIMEOUT_MS,
      "Integration upload test timed out.",
    );
    exitCode = 0;
  } catch (error) {
    console.error(error);
    await writeIntegrationResult(options.config.resultPath, {
      ok: false,
      error: errorMessage(error),
      telemetry,
    }).catch(() => undefined);
  } finally {
    await mapWindow?.destroy();
    if (options.userDataPath) {
      await rm(options.userDataPath, { recursive: true, force: true }).catch(() => undefined);
    }
    options.app.exit(exitCode);
  }
}

function installRequestGuard(
  mapSession: RequestGuardSession,
  allowedOrigin: string,
  telemetry: IntegrationTelemetry,
): void {
  mapSession.webRequest?.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      const allowed = isAllowedRequest(details.url, allowedOrigin);
      if (allowed) {
        telemetry.allowedLoopbackRequests += 1;
        callback({ cancel: false });
        return;
      }

      telemetry.externalRequestAttempts += 1;
      telemetry.blockedRequests += 1;
      if (details.url.includes("satisfactory-calculator.com")) {
        telemetry.sawSatisfactoryCalculator = true;
      }
      callback({ cancel: true });
    },
  );
}

function isAllowedRequest(targetUrl: string, allowedOrigin: string): boolean {
  try {
    const url = new URL(targetUrl);
    return url.origin === allowedOrigin;
  } catch {
    return false;
  }
}

function instrumentMapWindow(
  mapWindow: MapWindowManager,
  telemetry: IntegrationTelemetry,
): MapWindowPort {
  return {
    loadMap: (url, timeoutMs, signal) => mapWindow.loadMap(url, timeoutMs, signal),
    waitForDomReady: (timeoutMs, signal) => mapWindow.waitForDomReady(timeoutMs, signal),
    getElementState: (selector) => mapWindow.getElementState(selector),
    getInputFileCount: (selector) => mapWindow.getInputFileCount(selector),
    getScrollPosition: () => mapWindow.getScrollPosition(),
    restoreScrollPosition: (position) => mapWindow.restoreScrollPosition(position),
    waitForElementState: (selector, expectedState, timeoutMs, signal) =>
      mapWindow.waitForElementState(selector, expectedState, timeoutMs, signal),
    withUploadProcessing: (operation) => mapWindow.withUploadProcessing(operation),
    show: () => mapWindow.show(),
    focus: () => mapWindow.focus(),
    destroy: () => mapWindow.destroy(),
    getDebugger: () => instrumentDebugger(mapWindow.getDebugger(), telemetry),
  };
}

function instrumentDebugger(debug: DebuggerPort, telemetry: IntegrationTelemetry): DebuggerPort {
  return {
    isAttached: () => debug.isAttached(),
    attach: (protocolVersion) => {
      debug.attach(protocolVersion);
      telemetry.debuggerAttachSucceeded = true;
    },
    detach: () => {
      debug.detach();
      telemetry.debuggerDetachSucceeded = true;
    },
    sendCommand: async (method, commandParams) => {
      telemetry.cdpCommands.push(method);
      return debug.sendCommand(method, commandParams);
    },
    on: (event, listener) => debug.on(event, listener),
    off: (event, listener) => debug.off(event, listener),
  };
}

function isSuccessfulPageResult(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === true &&
    "contentMatches" in value &&
    value.contentMatches === true &&
    "hiddenDuring" in value &&
    value.hiddenDuring === true &&
    "visibleAfter" in value &&
    value.visibleAfter === true
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
