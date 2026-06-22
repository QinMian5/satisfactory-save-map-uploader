// abstract: Tests for main-process runtime consent orchestration.
// out_of_scope: Real Electron app startup, renderer DOM, and filesystem watching internals.

import { describe, expect, it, vi } from "vitest";
import { AppRuntimeController } from "../src/main/runtime-controller.js";
import { AppStateStore } from "../src/services/app-state.js";
import {
  ConsentController,
  ConsentRequiredError,
  CURRENT_DISCLOSURE_VERSION,
} from "../src/services/consent-controller.js";
import type { UserPreferences } from "../src/services/preferences.js";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createUnauthorizedConsent(): ConsentController {
  return new ConsentController({
    preferences: {
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: null,
      autoStartWatcher: false,
      acceptedAt: null,
    },
  });
}

function createAuthorizedConsent(autoStartWatcher: boolean): ConsentController {
  return new ConsentController({
    preferences: {
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: CURRENT_DISCLOSURE_VERSION,
      autoStartWatcher,
      acceptedAt: "2026-06-20T00:00:00.000Z",
    },
  });
}

function createController(options: {
  consent: ConsentController;
  savePreferences?: (preferences: UserPreferences) => Promise<void>;
  markRevoked?: () => Promise<void>;
  clearRevocationMarker?: () => Promise<void>;
  quitApp?: () => void;
  resolveSaveRoot?: () => string;
  watcher?: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    uploadLatestSave: () => Promise<void>;
    openMap: () => Promise<void>;
    close: () => Promise<{ fileProvided: boolean }>;
    prepareForRevocation?: () => Promise<{
      fileProvided: boolean;
      cleanup: () => Promise<void>;
    }>;
  };
}) {
  const state = new AppStateStore({ saveRoot: null });
  const watcher =
    options.watcher ??
    ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      uploadLatestSave: vi.fn().mockResolvedValue(undefined),
      openMap: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue({ fileProvided: false }),
      prepareForRevocation: vi.fn().mockResolvedValue({
        fileProvided: false,
        cleanup: vi.fn().mockResolvedValue(undefined),
      }),
    } satisfies NonNullable<typeof options.watcher>);
  const runtimeWatcher = {
    ...watcher,
    prepareForRevocation:
      watcher.prepareForRevocation ??
      (async () => {
        const result = await watcher.close();
        return { fileProvided: result.fileProvided, cleanup: async () => undefined };
      }),
  };
  const createWatcher = vi.fn(() => runtimeWatcher);
  const uploader = {
    upload: vi.fn().mockResolvedValue(undefined),
    openMap: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue({ fileProvided: false }),
  };
  const createUploader = vi.fn(() => uploader);
  const controller = new AppRuntimeController({
    state,
    consent: options.consent,
    preferences: {
      save: options.savePreferences ?? vi.fn().mockResolvedValue(undefined),
    },
    revocationMarker: {
      markRevoked: options.markRevoked ?? vi.fn().mockResolvedValue(undefined),
      clearAndConfirmAbsent: options.clearRevocationMarker ?? vi.fn().mockResolvedValue(undefined),
    },
    resolveSaveRoot: options.resolveSaveRoot ?? vi.fn(() => "C:\\Saves"),
    createUploader,
    createWatcher,
    quitApp: options.quitApp,
  });

  return { controller, state, watcher: runtimeWatcher, uploader, createWatcher, createUploader };
}

describe("AppRuntimeController", () => {
  it("does not resolve save paths, create watcher, or create map dependencies while unauthorized", async () => {
    const resolveSaveRoot = vi.fn(() => "C:\\Saves");
    const { controller, createWatcher, createUploader, state } = createController({
      consent: createUnauthorizedConsent(),
      resolveSaveRoot,
    });

    await controller.startAfterLaunch();

    expect(resolveSaveRoot).not.toHaveBeenCalled();
    expect(createWatcher).not.toHaveBeenCalled();
    expect(createUploader).not.toHaveBeenCalled();
    expect(state.getSnapshot()).toMatchObject({
      consentRequired: true,
      watcherStatus: "stopped",
      saveRoot: null,
    });
  });

  it("opens the map but keeps watcher stopped on launch even when an old auto-start preference exists", async () => {
    const resolveSaveRoot = vi.fn(() => "C:\\Saves");
    const { controller, watcher, uploader, state } = createController({
      consent: createAuthorizedConsent(true),
      resolveSaveRoot,
    });

    await controller.startAfterLaunch();

    expect(uploader.openMap).toHaveBeenCalledTimes(1);
    expect(resolveSaveRoot).not.toHaveBeenCalled();
    expect(watcher.start).not.toHaveBeenCalled();
    expect(state.getSnapshot()).toMatchObject({
      watcherStatus: "stopped",
      autoStartWatcher: false,
      saveRoot: null,
    });
  });

  it("opens the map page on launch when third-party upload permission is already granted", async () => {
    const resolveSaveRoot = vi.fn(() => "C:\\Saves");
    const { controller, uploader, createWatcher } = createController({
      consent: createAuthorizedConsent(false),
      resolveSaveRoot,
    });

    await controller.startAfterLaunch();

    expect(uploader.openMap).toHaveBeenCalledTimes(1);
    expect(resolveSaveRoot).not.toHaveBeenCalled();
    expect(createWatcher).not.toHaveBeenCalled();
  });

  it("keeps watcher stopped on launch when authorized but auto-start is disabled", async () => {
    const resolveSaveRoot = vi.fn(() => "C:\\Saves");
    const { controller, watcher } = createController({
      consent: createAuthorizedConsent(false),
      resolveSaveRoot,
    });

    await controller.startAfterLaunch();

    expect(resolveSaveRoot).not.toHaveBeenCalled();
    expect(watcher.start).not.toHaveBeenCalled();
  });

  it("persists accept before enabling consent and opening the map without starting the watcher", async () => {
    const order: string[] = [];
    const savedPreferences: UserPreferences[] = [];
    const resolveSaveRoot = vi.fn(() => "C:\\Saves");
    const { controller, watcher, uploader } = createController({
      consent: createUnauthorizedConsent(),
      resolveSaveRoot,
      savePreferences: async (preferences) => {
        savedPreferences.push(preferences);
        order.push("save");
      },
      watcher: {
        start: vi.fn(async () => {
          order.push("start");
        }),
        stop: vi.fn().mockResolvedValue(undefined),
        uploadLatestSave: vi.fn().mockResolvedValue(undefined),
        openMap: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue({ fileProvided: false }),
      },
    });
    uploader.openMap.mockImplementation(async () => {
      order.push("openMap");
    });

    await controller.acceptThirdPartyUpload();

    expect(savedPreferences).toEqual([
      expect.objectContaining({
        thirdPartyUploadDisclosureVersion: CURRENT_DISCLOSURE_VERSION,
        autoStartWatcher: false,
      }),
    ]);
    expect(order).toEqual(["save", "openMap"]);
    expect(uploader.openMap).toHaveBeenCalledTimes(1);
    expect(resolveSaveRoot).not.toHaveBeenCalled();
    expect(watcher.start).not.toHaveBeenCalled();
  });

  it("manual start scans saves without enabling future launch auto-start", async () => {
    const savedPreferences: UserPreferences[] = [];
    const { controller, watcher, state } = createController({
      consent: createAuthorizedConsent(false),
      savePreferences: async (preferences) => {
        savedPreferences.push(preferences);
      },
    });

    await controller.startWatcher();

    expect(watcher.start).toHaveBeenCalledTimes(1);
    expect(savedPreferences).not.toContainEqual(
      expect.objectContaining({ autoStartWatcher: true }),
    );
    expect(state.getSnapshot()).toMatchObject({
      autoStartWatcher: false,
      saveRoot: "C:\\Saves",
    });
  });

  it("does not resolve saves or start watcher when accept preferences persistence fails", async () => {
    const resolveSaveRoot = vi.fn(() => "C:\\Saves");
    const { controller, watcher, state } = createController({
      consent: createUnauthorizedConsent(),
      resolveSaveRoot,
      savePreferences: vi.fn().mockRejectedValue(new Error("disk full")),
    });

    await controller.acceptThirdPartyUpload();

    expect(resolveSaveRoot).not.toHaveBeenCalled();
    expect(watcher.start).not.toHaveBeenCalled();
    expect(state.getSnapshot()).toMatchObject({
      consentRequired: true,
      lastError: expect.stringContaining("disk full"),
    });
  });

  it("does not resolve saves or start watcher when accept cannot clear the revocation marker", async () => {
    const resolveSaveRoot = vi.fn(() => "C:\\Saves");
    const { controller, watcher, state } = createController({
      consent: createUnauthorizedConsent(),
      resolveSaveRoot,
      clearRevocationMarker: vi.fn().mockRejectedValue(new Error("marker locked")),
    });

    await controller.acceptThirdPartyUpload();

    expect(resolveSaveRoot).not.toHaveBeenCalled();
    expect(watcher.start).not.toHaveBeenCalled();
    expect(state.getSnapshot()).toMatchObject({
      consentRequired: true,
      consentPersistenceStatus: "error",
      privacyNotice: expect.stringContaining("marker"),
    });
  });

  it("reports consent-required for start, upload, and open-map commands without side effects", async () => {
    const { controller, watcher, createUploader, state } = createController({
      consent: createUnauthorizedConsent(),
    });

    await controller.startWatcher();
    await controller.uploadLatestSave();
    await controller.openMap();

    expect(watcher.start).not.toHaveBeenCalled();
    expect(watcher.uploadLatestSave).not.toHaveBeenCalled();
    expect(createUploader).not.toHaveBeenCalled();
    expect(state.getSnapshot()).toMatchObject({
      consentRequired: true,
      uploadStatus: "needs-consent",
    });
  });

  it("quits without resolving saves when first-run permission is declined", async () => {
    const quitApp = vi.fn();
    const resolveSaveRoot = vi.fn(() => "C:\\Saves");
    const { controller, createUploader, createWatcher, state } = createController({
      consent: createUnauthorizedConsent(),
      quitApp,
      resolveSaveRoot,
    });

    await controller.declineThirdPartyUpload();

    expect(quitApp).toHaveBeenCalledTimes(1);
    expect(resolveSaveRoot).not.toHaveBeenCalled();
    expect(createUploader).not.toHaveBeenCalled();
    expect(createWatcher).not.toHaveBeenCalled();
    expect(state.getSnapshot()).toMatchObject({
      consentRequired: true,
      uploadStatus: "needs-consent",
      permissionStatus: "not-granted",
    });
  });

  it("revokes in-memory consent, cancels watcher work, writes marker, then cleans up map state", async () => {
    const order: string[] = [];
    const consent = createAuthorizedConsent(true);
    const { controller, state } = createController({
      consent,
      markRevoked: async () => {
        order.push("marker");
      },
      savePreferences: async () => {
        order.push("save");
      },
      watcher: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        uploadLatestSave: vi.fn().mockResolvedValue(undefined),
        openMap: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue({ fileProvided: true }),
        prepareForRevocation: async () => {
          order.push("cancel");
          expect(() => consent.createUploadToken()).toThrow(ConsentRequiredError);
          return {
            fileProvided: true,
            cleanup: async () => {
              order.push("cleanup");
            },
          };
        },
      },
    });

    await controller.startAfterLaunch();
    await controller.startWatcher();
    order.length = 0;
    await controller.revokeThirdPartyUpload();

    expect(order).toEqual(["cancel", "marker", "cleanup", "save"]);
    expect(state.getSnapshot()).toMatchObject({
      consentRequired: true,
      autoStartWatcher: false,
      consentPersistenceStatus: "saved",
      privacyNotice: expect.stringContaining("already have been provided"),
    });
  });

  it("reports durable revoke success when marker write succeeds but revoked preferences fail", async () => {
    const { controller, state } = createController({
      consent: createAuthorizedConsent(true),
      savePreferences: vi.fn().mockRejectedValue(new Error("preferences locked")),
    });

    await controller.revokeThirdPartyUpload();

    expect(state.getSnapshot()).toMatchObject({
      consentRequired: true,
      consentPersistenceStatus: "saved",
      lastError: expect.stringContaining("preferences locked"),
      privacyNotice: expect.stringContaining("will remain revoked after restart"),
    });
  });

  it("falls back to revoked preferences when marker write fails", async () => {
    const savedPreferences: UserPreferences[] = [];
    const { controller, state } = createController({
      consent: createAuthorizedConsent(true),
      markRevoked: vi.fn().mockRejectedValue(new Error("marker denied")),
      savePreferences: async (preferences) => {
        savedPreferences.push(preferences);
      },
    });

    await controller.revokeThirdPartyUpload();

    expect(savedPreferences.at(-1)).toMatchObject({
      thirdPartyUploadDisclosureVersion: null,
      autoStartWatcher: false,
    });
    expect(state.getSnapshot()).toMatchObject({
      consentRequired: true,
      consentPersistenceStatus: "saved",
      privacyNotice: expect.stringContaining("will remain revoked after restart"),
    });
  });

  it("keeps the current session revoked and reports restart risk when marker and preferences both fail", async () => {
    const { controller, watcher, state } = createController({
      consent: createAuthorizedConsent(true),
      markRevoked: vi.fn().mockRejectedValue(new Error("marker denied")),
      savePreferences: vi.fn().mockRejectedValue(new Error("preferences locked")),
    });

    await controller.startAfterLaunch();
    await controller.startWatcher();
    await controller.revokeThirdPartyUpload();

    expect(watcher.start).toHaveBeenCalledTimes(1);
    expect(state.getSnapshot()).toMatchObject({
      consentRequired: true,
      consentPersistenceStatus: "durable-revoke-failed",
      privacyNotice: expect.stringContaining("cannot guarantee"),
    });
  });

  it("does not let an older accept remove a newer revoke marker or start the watcher", async () => {
    const saveGate = createDeferred<void>();
    const markerCalls: string[] = [];
    const { controller, watcher } = createController({
      consent: createUnauthorizedConsent(),
      savePreferences: async () => {
        await saveGate.promise;
      },
      clearRevocationMarker: async () => {
        markerCalls.push("clear");
      },
      markRevoked: async () => {
        markerCalls.push("mark");
      },
    });

    const accept = controller.acceptThirdPartyUpload();
    await vi.waitFor(() => expect(watcher.start).not.toHaveBeenCalled());
    const revoke = controller.revokeThirdPartyUpload();
    saveGate.resolve();
    await Promise.all([accept, revoke]);

    expect(markerCalls).toEqual(["mark"]);
    expect(watcher.start).not.toHaveBeenCalled();
  });

  it("allows a later complete accept to clear an older revoke marker without starting the watcher", async () => {
    const markerCalls: string[] = [];
    const { controller, watcher, state } = createController({
      consent: createAuthorizedConsent(true),
      markRevoked: async () => {
        markerCalls.push("mark");
      },
      clearRevocationMarker: async () => {
        markerCalls.push("clear");
      },
    });

    await controller.revokeThirdPartyUpload();
    await controller.acceptThirdPartyUpload();

    expect(markerCalls).toEqual(["mark", "clear"]);
    expect(watcher.start).not.toHaveBeenCalled();
    expect(state.getSnapshot()).toMatchObject({
      consentRequired: false,
      autoStartWatcher: false,
      consentPersistenceStatus: "saved",
    });
  });
});
