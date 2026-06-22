// abstract: Electron main-process application lifecycle and service wiring.
// out_of_scope: Renderer DOM rendering, save discovery internals, and Store packaging.

import { appendFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { app, ipcMain } from "electron";
import { APP_METADATA } from "../../config/app-metadata.js";
import { getDefaultSaveRoot } from "../saves.js";
import { AppStateStore } from "../services/app-state.js";
import { ConsentController } from "../services/consent-controller.js";
import { PreferencesService } from "../services/preferences.js";
import { RevocationMarkerService } from "../services/revocation-marker.js";
import { ElectronSaveUploader } from "../services/save-uploader.js";
import { SaveWatcherService } from "../services/save-watcher.js";
import { IPC_CHANNELS } from "../shared/ipc.js";
import { getMapUrlForLanguage } from "../shared/language.js";
import {
  parseIntegrationUploadConfig,
  runIntegrationUploadTest,
} from "./integration-test-upload.js";
import { registerIpcHandlers } from "./ipc/register-handlers.js";
import {
  acquireSingleInstanceLock,
  focusExistingStatusWindow,
  hasIntegrationTestArg,
  hasIntegrationTestSwitch,
  hasSmokeTestArg,
  hasSmokeTestSwitch,
} from "./lifecycle.js";
import { AppRuntimeController } from "./runtime-controller.js";
import { getMapResourcePolicyConfig } from "./security/map-resource-audit.js";
import { runSmokeTest } from "./smoke-test.js";
import { MapWindowManager } from "./windows/map-window.js";
import { createStatusWindow, type StatusWindowRendererEntry } from "./windows/status-window.js";

const smokeLogSwitch = app.commandLine.getSwitchValue("smoke-log");
if (smokeLogSwitch && !process.env.SATISFACTORY_SMOKE_LOG) {
  process.env.SATISFACTORY_SMOKE_LOG = smokeLogSwitch;
}
const smokeUserDataPath = configureSmokeUserDataPath();
const integrationUserDataPath = configureIntegrationUserDataPath();
smokeBootLog(`module-loaded argv=${JSON.stringify(process.argv)}`);

app.enableSandbox();
bootstrapElectronApp();

type AppRuntime = {
  statusWindow: Electron.BrowserWindow;
  controller: AppRuntimeController;
  unsubscribeState: () => void;
  unregisterIpcHandlers: () => void;
  isQuitting: boolean;
  beginQuit: () => void;
};

let runtime: AppRuntime | undefined;

function bootstrapElectronApp(): void {
  app.setAppUserModelId(APP_METADATA.appId);

  if (!acquireSingleInstanceLock(app)) {
    return;
  }

  app.on("second-instance", () => {
    focusExistingStatusWindow(runtime?.statusWindow);
  });

  app
    .whenReady()
    .then(async () => {
      const smokeRequested = hasSmokeTestArg(process.argv) || hasSmokeTestSwitch(app.commandLine);
      const integrationRequested =
        hasIntegrationTestArg(process.argv) || hasIntegrationTestSwitch(app.commandLine);
      smokeBootLog(`ready smokeRequested=${smokeRequested}`);
      if (integrationRequested) {
        const config = await parseIntegrationUploadConfig(process.argv);
        await runIntegrationUploadTest({
          app,
          config,
          userDataPath: integrationUserDataPath,
        });
        return;
      }
      if (smokeRequested) {
        await runSmokeTest({
          app,
          ipcMain,
          preloadEntry: getStatusWindowPreloadEntry(),
          rendererEntry: getStatusWindowRendererEntry(),
          userDataPath: smokeUserDataPath,
        });
        return;
      }
      runtime = await createRuntime();
    })
    .catch((error: unknown) => {
      console.error(error);
      app.exit(1);
    });

  app.on("before-quit", () => {
    runtime?.beginQuit();
  });

  app.on("will-quit", () => {
    runtime?.beginQuit();
    runtime = undefined;
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}

function smokeBootLog(message: string): void {
  const logPath = process.env.SATISFACTORY_SMOKE_LOG;
  if (!logPath) {
    return;
  }
  appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, "utf8");
}

async function createRuntime(): Promise<AppRuntime> {
  const preferences = new PreferencesService(app.getPath("userData"));
  const revocationMarker = new RevocationMarkerService(app.getPath("userData"));
  const revocationResult = await revocationMarker.load();
  const preferencesResult = await preferences.load();
  const consent = new ConsentController({
    preferences: preferencesResult.preferences,
    revocation: revocationResult,
  });
  const consentSnapshot = consent.getSnapshot();
  const state = new AppStateStore({
    saveRoot: null,
    consentRequired: consentSnapshot.consentRequired,
    permissionStatus: revocationResult.revoked
      ? "revoked"
      : consentSnapshot.consentRequired
        ? "not-granted"
        : "granted",
    acceptedDisclosureVersion: consentSnapshot.acceptedDisclosureVersion,
    currentDisclosureVersion: consentSnapshot.currentDisclosureVersion,
    autoStartWatcher: consentSnapshot.autoStartWatcher,
    language: consentSnapshot.language,
  });
  if (preferencesResult.warning) {
    state.addLog("warn", preferencesResult.warning);
  }
  if (revocationResult.warning) {
    state.addLog("warn", revocationResult.warning);
  }
  const mapResourcePolicy = getMapResourcePolicyConfig({
    env: process.env,
    isPackaged: app.isPackaged,
    userDataPath: app.getPath("userData"),
  });
  const showMapOnCreate = !app.isPackaged && process.env.SATISFACTORY_MAP_SHOW_ON_CREATE === "1";
  const statusWindow = createStatusWindow(
    getStatusWindowPreloadEntry(),
    getStatusWindowRendererEntry(),
  );
  const controller = new AppRuntimeController({
    state,
    consent,
    preferences,
    revocationMarker,
    resolveSaveRoot,
    quitApp: () => {
      app.quit();
    },
    createUploader: (authorization) =>
      new ElectronSaveUploader({
        mapWindow: new MapWindowManager({
          hostWindow: {
            contentView: statusWindow.contentView,
            getContentBounds: () => statusWindow.getContentBounds(),
            on: (event, listener) => {
              if (event === "resize") {
                statusWindow.on("resize", listener);
              } else {
                statusWindow.on("closed", listener);
              }
            },
            off: (event, listener) => {
              if (event === "resize") {
                statusWindow.off("resize", listener);
              } else {
                statusWindow.off("closed", listener);
              }
            },
          },
          resourceRequestPolicy: mapResourcePolicy,
          showOnCreate: showMapOnCreate,
        }),
        targetUrl: () => getMapUrlForLanguage(consent.getSnapshot().language),
        authorization,
      }),
    createWatcher: ({ saveRoot, state: watcherState, uploader, authorization }) =>
      new SaveWatcherService({
        saveRoot,
        state: watcherState,
        uploader,
        authorization,
      }),
  });
  const unregisterIpcHandlers = registerIpcHandlers({
    ipcMain,
    statusWindow,
    commands: controller,
    state,
  });
  const unsubscribeState = state.subscribe((snapshot) => {
    if (!statusWindow.isDestroyed()) {
      statusWindow.webContents.send(IPC_CHANNELS.stateChanged, snapshot);
    }
  });

  const createdRuntime: AppRuntime = {
    statusWindow,
    controller,
    unsubscribeState,
    unregisterIpcHandlers,
    isQuitting: false,
    beginQuit() {
      if (this.isQuitting) {
        return;
      }
      this.isQuitting = true;
      this.unsubscribeState();
      this.unregisterIpcHandlers();
      void this.controller.close().catch((error: unknown) => {
        console.error(error);
      });
    },
  };

  statusWindow.on("closed", () => {
    if (!createdRuntime.isQuitting) {
      app.quit();
    }
  });

  await controller.startAfterLaunch();
  return createdRuntime;
}

function resolveSaveRoot(): string {
  try {
    return getDefaultSaveRoot();
  } catch {
    return "<LOCALAPPDATA not set>\\FactoryGame\\Saved\\SaveGames";
  }
}

function getStatusWindowPreloadEntry(): string {
  return path.join(__dirname, "preload.js");
}

function getStatusWindowRendererEntry(): StatusWindowRendererEntry {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return {
      kind: "url",
      value: MAIN_WINDOW_VITE_DEV_SERVER_URL,
    };
  }

  return {
    kind: "file",
    value: path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
  };
}

function configureSmokeUserDataPath(): string | undefined {
  if (!(hasSmokeTestArg(process.argv) || hasSmokeTestSwitch(app.commandLine))) {
    return undefined;
  }

  const userDataPath = mkdtempSync(path.join(tmpdir(), "satisfactory-smoke-user-data-"));
  app.setPath("userData", userDataPath);
  process.env.SATISFACTORY_SMOKE_USER_DATA = userDataPath;
  return userDataPath;
}

function configureIntegrationUserDataPath(): string | undefined {
  if (!(hasIntegrationTestArg(process.argv) || hasIntegrationTestSwitch(app.commandLine))) {
    return undefined;
  }

  const root = getArgValue(process.argv, "--integration-root");
  const userDataPath =
    root && path.isAbsolute(root)
      ? path.join(root, "userData")
      : mkdtempSync(path.join(tmpdir(), "satisfactory-integration-user-data-"));
  mkdirSync(userDataPath, { recursive: true });
  app.setPath("userData", userDataPath);
  return userDataPath;
}

function getArgValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
