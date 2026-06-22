// abstract: Safe packaged smoke-test mode for renderer, preload, and IPC startup.
// out_of_scope: Save directory access, filesystem watching, map windows, and third-party uploads.

import { appendFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { App, BrowserWindow, IpcMain } from "electron";
import { AppStateStore } from "../services/app-state.js";
import { IPC_CHANNELS } from "../shared/ipc.js";
import type { AppLanguage, AppStateSnapshot } from "../shared/state.js";
import { DEFAULT_APP_LANGUAGE } from "../shared/state.js";
import { registerIpcHandlers } from "./ipc/register-handlers.js";
import { createStatusWindow, type StatusWindowRendererEntry } from "./windows/status-window.js";

const SMOKE_TEST_SAVE_ROOT = "<smoke-test-save-root>";
const DEFAULT_SMOKE_TEST_TIMEOUT_MS = 15_000;

type SmokeWatcher = {
  startWatcher: () => Promise<AppStateSnapshot>;
  stopWatcher: () => Promise<AppStateSnapshot>;
  uploadLatestSave: () => Promise<AppStateSnapshot>;
  openMap: () => Promise<AppStateSnapshot>;
  acceptThirdPartyUpload: () => Promise<AppStateSnapshot>;
  declineThirdPartyUpload: () => Promise<AppStateSnapshot>;
  revokeThirdPartyUpload: () => Promise<AppStateSnapshot>;
  setLanguage: (language: AppLanguage) => Promise<AppStateSnapshot>;
  getDisclosure: () => Promise<AppStateSnapshot>;
};

type RunSmokeTestOptions = {
  app: Pick<App, "exit">;
  ipcMain: IpcMain;
  preloadEntry: string;
  rendererEntry: StatusWindowRendererEntry;
  userDataPath?: string;
  timeoutMs?: number;
};

type SmokeCounters = {
  saveRootResolutions: number;
  saveScans: number;
  watcherStarts: number;
  mapWindows: number;
  thirdPartyUrlLoads: number;
  preferenceWrites: number;
};

export async function runSmokeTest(options: RunSmokeTestOptions): Promise<void> {
  let exitCode = 1;
  let statusWindow: BrowserWindow | undefined;
  let unregisterIpcHandlers: (() => void) | undefined;
  let unsubscribeState: (() => void) | undefined;

  try {
    smokeLog("starting");
    const counters: SmokeCounters = {
      saveRootResolutions: 0,
      saveScans: 0,
      watcherStarts: 0,
      mapWindows: 0,
      thirdPartyUrlLoads: 0,
      preferenceWrites: 0,
    };
    assertSmokeUserData(options.userDataPath);
    const state = new AppStateStore({
      saveRoot: SMOKE_TEST_SAVE_ROOT,
      consentRequired: true,
      acceptedDisclosureVersion: null,
      currentDisclosureVersion: 1,
      autoStartWatcher: false,
      language: DEFAULT_APP_LANGUAGE,
    });
    const commands = createSmokeCommands(state, counters);
    statusWindow = createStatusWindow(options.preloadEntry, options.rendererEntry);
    smokeLog("status-window-created");
    unregisterIpcHandlers = registerIpcHandlers({
      ipcMain: options.ipcMain,
      statusWindow,
      commands,
      state,
    });
    unsubscribeState = state.subscribe((snapshot) => {
      if (statusWindow && !statusWindow.isDestroyed()) {
        statusWindow.webContents.send(IPC_CHANNELS.stateChanged, snapshot);
      }
    });

    smokeLog("verifying-renderer");
    await withTimeout(
      verifyRenderer(statusWindow),
      options.timeoutMs ?? DEFAULT_SMOKE_TEST_TIMEOUT_MS,
      "Smoke test timed out.",
    );
    assertSmokeCounters(counters);
    smokeLog("verification-complete");
    exitCode = 0;
  } catch (error) {
    smokeLog(`failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
  } finally {
    unsubscribeState?.();
    unregisterIpcHandlers?.();
    if (statusWindow && !statusWindow.isDestroyed()) {
      statusWindow.destroy();
    }
    if (options.userDataPath) {
      await rm(options.userDataPath, { recursive: true, force: true }).catch(() => undefined);
    }
    smokeLog(`exiting:${exitCode}`);
    options.app.exit(exitCode);
  }
}

function createSmokeCommands(state: AppStateStore, counters: SmokeCounters): SmokeWatcher {
  return {
    startWatcher: async () => {
      counters.watcherStarts += 1;
      state.update({
        watcherStatus: "stopped",
        uploadStatus: "needs-consent",
        consentRequired: true,
      });
      return state.getSnapshot();
    },
    stopWatcher: async () => {
      state.update({ watcherStatus: "stopped" });
      return state.getSnapshot();
    },
    uploadLatestSave: async () => {
      state.update({
        uploadStatus: "needs-consent",
        latestSavePath: null,
        lastUploadResult: null,
        lastError: "Smoke test did not scan saves.",
      });
      return state.getSnapshot();
    },
    openMap: async () => {
      state.addLog("info", "Smoke test did not create a map window.");
      return state.getSnapshot();
    },
    acceptThirdPartyUpload: async () => {
      state.update({
        consentRequired: false,
        permissionStatus: "granted",
        acceptedDisclosureVersion: 1,
        autoStartWatcher: false,
        privacyNotice: "Smoke test simulated accept without starting watcher.",
      });
      return state.getSnapshot();
    },
    declineThirdPartyUpload: async () => {
      state.update({
        consentRequired: true,
        permissionStatus: "not-granted",
        uploadStatus: "needs-consent",
        privacyNotice: "Smoke test kept disclosure required.",
      });
      return state.getSnapshot();
    },
    revokeThirdPartyUpload: async () => {
      state.update({
        consentRequired: true,
        permissionStatus: "revoked",
        acceptedDisclosureVersion: null,
        autoStartWatcher: false,
        privacyNotice: "Smoke test simulated revoke.",
      });
      return state.getSnapshot();
    },
    setLanguage: async (language) => {
      state.update({ language });
      return state.getSnapshot();
    },
    getDisclosure: async () => {
      return state.getSnapshot();
    },
  };
}

async function verifyRenderer(statusWindow: BrowserWindow): Promise<void> {
  await waitForRendererLoad(statusWindow);
  smokeLog("renderer-loaded");
  const result = (await statusWindow.webContents.executeJavaScript(
    `(
      async () => {
        const api = window.satisfactoryApp;
        if (!api) return { ok: false, reason: "missing preload API" };
        for (const name of ["getState", "getDisclosure", "acceptThirdPartyUpload", "declineThirdPartyUpload", "revokeThirdPartyUpload", "setLanguage", "startWatcher", "stopWatcher", "uploadLatestSave", "openMap", "onStateChanged"]) {
          if (typeof api[name] !== "function") {
            return { ok: false, reason: "missing API method: " + name };
          }
        }
        const state = await api.getState();
        const disclosure = await api.getDisclosure();
        if (!state.consentRequired || !disclosure.consentRequired) {
          return { ok: false, reason: "smoke test should start unauthorized", state };
        }
        if (state.watcherStatus !== "stopped") {
          return { ok: false, reason: "watcher started during smoke test", state };
        }
        await api.acceptThirdPartyUpload();
        return { ok: state.saveRoot === ${JSON.stringify(SMOKE_TEST_SAVE_ROOT)}, state };
      }
    )()`,
    true,
  )) as {
    ok: boolean;
    state?: AppStateSnapshot;
    reason?: string;
  };

  if (!result.ok) {
    throw new Error(result.reason ?? "Smoke test renderer verification failed.");
  }
  smokeLog("renderer-ipc-ok");
}

function assertSmokeUserData(userDataPath: string | undefined): void {
  if (!userDataPath) {
    throw new Error("Smoke test did not receive an isolated userData path.");
  }
  const relative = path.relative(tmpdir(), userDataPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Smoke userData path is not under the temp directory: ${userDataPath}`);
  }
}

function assertSmokeCounters(counters: SmokeCounters): void {
  const expected: SmokeCounters = {
    saveRootResolutions: 0,
    saveScans: 0,
    watcherStarts: 0,
    mapWindows: 0,
    thirdPartyUrlLoads: 0,
    preferenceWrites: 0,
  };
  if (JSON.stringify(counters) !== JSON.stringify(expected)) {
    throw new Error(`Smoke test performed forbidden work: ${JSON.stringify(counters)}`);
  }
}

function waitForRendererLoad(statusWindow: BrowserWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    if (statusWindow.webContents.isLoadingMainFrame?.() === false) {
      resolve();
      return;
    }

    const cleanup = (): void => {
      statusWindow.webContents.off("did-finish-load", onLoad);
      statusWindow.webContents.off("did-fail-load", onFail);
      statusWindow.webContents.off("destroyed", onDestroyed);
    };
    const onLoad = (): void => {
      cleanup();
      resolve();
    };
    const onFail = (_event: unknown, errorCode: number, errorDescription: string): void => {
      cleanup();
      reject(new Error(`Smoke renderer load failed: ${errorCode} ${errorDescription}`));
    };
    const onDestroyed = (): void => {
      cleanup();
      reject(new Error("Smoke renderer was destroyed before it loaded."));
    };

    statusWindow.webContents.on("did-finish-load", onLoad);
    statusWindow.webContents.on("did-fail-load", onFail);
    statusWindow.webContents.on("destroyed", onDestroyed);
  });
}

function smokeLog(message: string): void {
  const logPath = process.env.SATISFACTORY_SMOKE_LOG;
  if (!logPath) {
    return;
  }
  appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, "utf8");
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
