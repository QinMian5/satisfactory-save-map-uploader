// abstract: Tests for Electron CDP save upload orchestration.
// out_of_scope: Real Electron windows, real third-party pages, and filesystem save parsing.

import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CdpFileInputSetter,
  type DebuggerPort,
  ElectronSaveUploader,
  getElementVisibilityScript,
  type MapWindowPort,
  UploadError,
} from "../src/services/save-uploader.js";
import { getMapUrlForLanguage } from "../src/shared/language.js";

function createDebugger(overrides: Partial<DebuggerPort> = {}): DebuggerPort & {
  commands: string[];
  detachListeners: Array<(_event: unknown, reason: string) => void>;
} {
  const detachListeners: Array<(_event: unknown, reason: string) => void> = [];
  const commands: string[] = [];
  return {
    commands,
    detachListeners,
    isAttached: () => false,
    attach: vi.fn(),
    detach: vi.fn(),
    on: (_event, listener) => detachListeners.push(listener),
    off: (_event, listener) => {
      const index = detachListeners.indexOf(listener);
      if (index >= 0) {
        detachListeners.splice(index, 1);
      }
    },
    sendCommand: vi.fn(async (method: string) => {
      commands.push(method);
      if (method === "DOM.getDocument") {
        return { root: { nodeId: 1 } };
      }
      if (method === "DOM.querySelector") {
        return { nodeId: 7 };
      }
      if (method === "DOM.resolveNode") {
        return { object: { objectId: "input-object" } };
      }
      return {};
    }),
    ...overrides,
  };
}

function createMapWindow(overrides: Partial<MapWindowPort> = {}): MapWindowPort {
  return {
    loadMap: vi.fn().mockResolvedValue(undefined),
    waitForDomReady: vi.fn().mockResolvedValue(undefined),
    getElementState: vi.fn().mockResolvedValue("visible"),
    getInputFileCount: vi.fn().mockResolvedValue(0),
    waitForElementState: vi.fn().mockResolvedValue(undefined),
    getScrollPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    restoreScrollPosition: vi.fn().mockResolvedValue(undefined),
    withUploadProcessing: async (operation) => operation(),
    show: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(),
    getDebugger: () => createDebugger(),
    ...overrides,
  };
}

function absoluteSavePath(name = "factory.sav"): string {
  return path.resolve(name);
}

function statFile(isFile = true): () => Promise<{ isFile: () => boolean }> {
  return async () => ({ isFile: () => isFile });
}

describe("CdpFileInputSetter", () => {
  it("sets the selected file through the expected CDP command order", async () => {
    const debug = createDebugger();
    const setter = new CdpFileInputSetter(debug);

    await setter.setFileInputFiles("#saveGameFileInput", ["factory.sav"]);

    expect(debug.commands).toEqual([
      "DOM.enable",
      "DOM.getDocument",
      "DOM.querySelector",
      "DOM.setFileInputFiles",
      "DOM.resolveNode",
      "Runtime.callFunctionOn",
    ]);
    expect(debug.sendCommand).toHaveBeenCalledWith(
      "Runtime.callFunctionOn",
      expect.objectContaining({
        objectId: "input-object",
        functionDeclaration: expect.stringContaining("jQuery"),
        userGesture: true,
      }),
    );
    expect(debug.attach).toHaveBeenCalledWith();
    expect(debug.detach).toHaveBeenCalledTimes(1);
  });

  it("reports a missing selector", async () => {
    const debug = createDebugger({
      sendCommand: vi.fn(async (method: string) => {
        if (method === "DOM.getDocument") {
          return { root: { nodeId: 1 } };
        }
        if (method === "DOM.querySelector") {
          return { nodeId: 0 };
        }
        return {};
      }),
    });
    const setter = new CdpFileInputSetter(debug);

    await expect(setter.setFileInputFiles("#missing", ["factory.sav"])).rejects.toMatchObject({
      code: "upload-control-not-found",
    });
  });

  it("reports debugger attach failure", async () => {
    const debug = createDebugger({
      attach: vi.fn(() => {
        throw new Error("busy");
      }),
    });
    const setter = new CdpFileInputSetter(debug);

    await expect(
      setter.setFileInputFiles("#saveGameFileInput", ["factory.sav"]),
    ).rejects.toMatchObject({
      code: "debugger-attach-failed",
    });
  });

  it("reports an unexpected debugger detach", async () => {
    const debug = createDebugger();
    debug.sendCommand = vi.fn(async (method: string) => {
      if (method === "DOM.getDocument") {
        for (const listener of debug.detachListeners) {
          listener({}, "target closed");
        }
        return { root: { nodeId: 1 } };
      }
      return {};
    });
    const setter = new CdpFileInputSetter(debug);

    await expect(
      setter.setFileInputFiles("#saveGameFileInput", ["factory.sav"]),
    ).rejects.toMatchObject({
      code: "debugger-detached",
    });
  });
});

describe("ElectronSaveUploader", () => {
  it("checks the current authorization generation before loading and selecting a file", async () => {
    const calls: string[] = [];
    const token = { generation: 1 };
    const guard = {
      assertUploadAllowed: vi.fn((receivedToken: typeof token) => {
        calls.push(`guard:${receivedToken.generation}`);
      }),
    };
    const debug = createDebugger({
      sendCommand: vi.fn(async (method: string) => {
        calls.push(method);
        if (method === "DOM.getDocument") {
          return { root: { nodeId: 1 } };
        }
        if (method === "DOM.querySelector") {
          return { nodeId: 7 };
        }
        if (method === "DOM.resolveNode") {
          return { object: { objectId: "input-object" } };
        }
        return {};
      }),
    });
    const mapWindow = createMapWindow({
      loadMap: vi.fn(async () => {
        calls.push("loadMap");
      }),
      getDebugger: () => debug,
    });
    const uploader = new ElectronSaveUploader({
      mapWindow,
      statFile: statFile(),
      authorization: guard,
    });

    await uploader.upload(absoluteSavePath(), token);

    expect(calls).toEqual([
      "guard:1",
      "loadMap",
      "guard:1",
      "DOM.enable",
      "DOM.getDocument",
      "DOM.querySelector",
      "DOM.setFileInputFiles",
      "DOM.resolveNode",
      "Runtime.callFunctionOn",
      "guard:1",
    ]);
  });

  it("does not load the map if authorization was revoked before upload execution", async () => {
    const mapWindow = createMapWindow();
    const uploader = new ElectronSaveUploader({
      mapWindow,
      statFile: statFile(),
      authorization: {
        assertUploadAllowed: () => {
          throw new UploadError(
            "upload-consent-required",
            "Third-party upload permission is required.",
          );
        },
      },
    });

    await expect(uploader.upload(absoluteSavePath(), { generation: 1 })).rejects.toMatchObject({
      code: "upload-consent-required",
    });
    expect(mapWindow.loadMap).not.toHaveBeenCalled();
  });

  it("loads the map, selects the file, and waits for the upload panel transition to finish", async () => {
    const debug = createDebugger();
    const mapWindow = createMapWindow({ getDebugger: () => debug });
    const uploader = new ElectronSaveUploader({ mapWindow, statFile: statFile() });

    await uploader.upload(absoluteSavePath());

    expect(mapWindow.loadMap).toHaveBeenCalledWith(
      getMapUrlForLanguage("zh-CN"),
      60_000,
      expect.any(AbortSignal),
    );
    expect(mapWindow.getElementState).toHaveBeenCalledWith("#saveGameFileInput");
    expect(mapWindow.getElementState).toHaveBeenCalledWith("#dropSaveGame");
    expect(mapWindow.waitForElementState).toHaveBeenCalledWith(
      "#dropSaveGame",
      "hidden",
      5_000,
      expect.any(AbortSignal),
    );
    expect(mapWindow.getInputFileCount).toHaveBeenCalledWith("#saveGameFileInput");
  });

  it("restores the map scroll position after a successful upload", async () => {
    const calls: string[] = [];
    const scrollPosition = { x: 12, y: 345 };
    const mapWindow = createMapWindow({
      getScrollPosition: vi.fn(async () => {
        calls.push("get-scroll");
        return scrollPosition;
      }),
      loadMap: vi.fn(async () => {
        calls.push("load-map");
      }),
      waitForElementState: vi.fn(async () => {
        calls.push("processing-started");
      }),
      restoreScrollPosition: vi.fn(async (position) => {
        calls.push(`restore-scroll:${position.x}:${position.y}`);
      }),
    });
    const uploader = new ElectronSaveUploader({ mapWindow, statFile: statFile() });

    await uploader.upload(absoluteSavePath());

    expect(calls.indexOf("get-scroll")).toBeLessThan(calls.indexOf("load-map"));
    expect(calls.at(-1)).toBe("restore-scroll:12:345");
  });

  it("opens the map by loading the configured map URL without selecting a save file", async () => {
    const mapWindow = createMapWindow();
    const uploader = new ElectronSaveUploader({ mapWindow, statFile: statFile() });

    await uploader.openMap();

    expect(mapWindow.loadMap).toHaveBeenCalledWith(getMapUrlForLanguage("zh-CN"), 60_000);
    expect(mapWindow.show).toHaveBeenCalledTimes(1);
    expect(mapWindow.focus).toHaveBeenCalledTimes(1);
    expect(mapWindow.getElementState).not.toHaveBeenCalled();
  });

  it("uses an explicit target URL only when main-process code injects one", async () => {
    const mapWindow = createMapWindow();
    const uploader = new ElectronSaveUploader({
      mapWindow,
      statFile: statFile(),
      targetUrl: "http://127.0.0.1:49152/fixture?token=test",
    });

    await uploader.upload(absoluteSavePath());

    expect(mapWindow.loadMap).toHaveBeenCalledWith(
      "http://127.0.0.1:49152/fixture?token=test",
      60_000,
      expect.any(AbortSignal),
    );
  });

  it("uses the latest target URL provider value for each map load", async () => {
    let targetUrl = getMapUrlForLanguage("en");
    const mapWindow = createMapWindow();
    const uploader = new ElectronSaveUploader({
      mapWindow,
      statFile: statFile(),
      targetUrl: () => targetUrl,
    });

    await uploader.openMap();
    targetUrl = getMapUrlForLanguage("zh-CN");
    await uploader.upload(absoluteSavePath());

    expect(mapWindow.loadMap).toHaveBeenNthCalledWith(1, getMapUrlForLanguage("en"), 60_000);
    expect(mapWindow.loadMap).toHaveBeenNthCalledWith(
      2,
      getMapUrlForLanguage("zh-CN"),
      60_000,
      expect.any(AbortSignal),
    );
  });

  it("distinguishes page load failure", async () => {
    const uploader = new ElectronSaveUploader({
      mapWindow: createMapWindow({ loadMap: vi.fn().mockRejectedValue(new Error("timeout")) }),
      statFile: statFile(),
    });

    await expect(uploader.upload(absoluteSavePath())).rejects.toBeInstanceOf(UploadError);
    await expect(uploader.upload(absoluteSavePath())).rejects.toMatchObject({
      code: "page-load-failed",
    });
  });

  it("restores the map scroll position when the upload fails", async () => {
    const scrollPosition = { x: 0, y: 640 };
    const mapWindow = createMapWindow({
      getScrollPosition: vi.fn().mockResolvedValue(scrollPosition),
      loadMap: vi.fn().mockRejectedValue(new Error("timeout")),
      restoreScrollPosition: vi.fn().mockResolvedValue(undefined),
    });
    const uploader = new ElectronSaveUploader({ mapWindow, statFile: statFile() });

    await expect(uploader.upload(absoluteSavePath())).rejects.toMatchObject({
      code: "page-load-failed",
    });

    expect(mapWindow.restoreScrollPosition).toHaveBeenCalledWith(scrollPosition);
  });

  it("distinguishes upload completion timeout after processing starts", async () => {
    const uploader = new ElectronSaveUploader({
      mapWindow: createMapWindow({
        getInputFileCount: vi.fn().mockResolvedValue(1),
      }),
      statFile: statFile(),
      timeoutMs: 5,
    });

    await expect(uploader.upload(absoluteSavePath())).rejects.toMatchObject({
      code: "upload-timeout",
    });
  });

  it("rejects non-absolute save paths before loading the map", async () => {
    const mapWindow = createMapWindow();
    const uploader = new ElectronSaveUploader({ mapWindow, statFile: statFile() });

    await expect(uploader.upload("relative.sav")).rejects.toMatchObject({
      code: "invalid-save-path",
    });
    expect(mapWindow.loadMap).not.toHaveBeenCalled();
  });

  it("rejects missing, non-file, and non-sav paths before loading the map", async () => {
    const missingMapWindow = createMapWindow();
    const missingUploader = new ElectronSaveUploader({
      mapWindow: missingMapWindow,
      statFile: async () => {
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      },
    });

    await expect(missingUploader.upload(absoluteSavePath())).rejects.toMatchObject({
      code: "save-file-not-found",
    });
    expect(missingMapWindow.loadMap).not.toHaveBeenCalled();

    const directoryMapWindow = createMapWindow();
    const directoryUploader = new ElectronSaveUploader({
      mapWindow: directoryMapWindow,
      statFile: statFile(false),
    });
    await expect(directoryUploader.upload(absoluteSavePath())).rejects.toMatchObject({
      code: "save-file-not-file",
    });
    expect(directoryMapWindow.loadMap).not.toHaveBeenCalled();

    const textMapWindow = createMapWindow();
    const textUploader = new ElectronSaveUploader({
      mapWindow: textMapWindow,
      statFile: statFile(),
    });
    await expect(textUploader.upload(absoluteSavePath("factory.txt"))).rejects.toMatchObject({
      code: "save-file-extension-invalid",
    });
    expect(textMapWindow.loadMap).not.toHaveBeenCalled();
  });

  it("fails when the upload input or initial upload panel state is not ready", async () => {
    const missingInputUploader = new ElectronSaveUploader({
      mapWindow: createMapWindow({
        getElementState: vi.fn().mockResolvedValueOnce("missing").mockResolvedValue("visible"),
      }),
      statFile: statFile(),
    });
    await expect(missingInputUploader.upload(absoluteSavePath())).rejects.toMatchObject({
      code: "upload-control-not-found",
    });

    const hiddenPanelUploader = new ElectronSaveUploader({
      mapWindow: createMapWindow({
        getElementState: vi.fn().mockResolvedValueOnce("visible").mockResolvedValueOnce("hidden"),
      }),
      statFile: statFile(),
    });
    await expect(hiddenPanelUploader.upload(absoluteSavePath())).rejects.toMatchObject({
      code: "upload-panel-not-ready",
    });
  });

  it("fails when the upload panel never hides after selecting the file", async () => {
    const uploader = new ElectronSaveUploader({
      mapWindow: createMapWindow({
        waitForElementState: vi.fn().mockRejectedValue(new Error("timeout")),
      }),
      statFile: statFile(),
      processingStartTimeoutMs: 5,
    });

    await expect(uploader.upload(absoluteSavePath())).rejects.toMatchObject({
      code: "upload-not-started",
    });
  });

  it("wraps upload work with temporary background processing", async () => {
    const calls: string[] = [];
    const uploader = new ElectronSaveUploader({
      mapWindow: createMapWindow({
        withUploadProcessing: async (operation) => {
          calls.push("start");
          try {
            return await operation();
          } finally {
            calls.push("finish");
          }
        },
      }),
      statFile: statFile(),
    });

    await uploader.upload(absoluteSavePath());

    expect(calls).toEqual(["start", "finish"]);
  });

  it("aborts active upload work when closed", async () => {
    let signal: AbortSignal | undefined;
    const uploader = new ElectronSaveUploader({
      mapWindow: createMapWindow({
        loadMap: vi.fn((_url, _timeout, receivedSignal) => {
          signal = receivedSignal;
          return new Promise<void>((_resolve, reject) => {
            receivedSignal?.addEventListener("abort", () => reject(new Error("aborted")), {
              once: true,
            });
          });
        }),
      }),
      statFile: statFile(),
    });

    const upload = uploader.upload(absoluteSavePath());
    await vi.waitFor(() => expect(signal).toBeDefined());
    await uploader.close();
    await upload.catch(() => undefined);

    expect(signal?.aborted).toBe(true);
  });

  it("reports whether a cancelled active upload had already provided the file", async () => {
    let processingStarted!: () => void;
    const processing = new Promise<void>((resolve) => {
      processingStarted = resolve;
    });
    const uploader = new ElectronSaveUploader({
      mapWindow: createMapWindow({
        waitForElementState: vi.fn((_selector, _state, _timeout, signal) => {
          processingStarted();
          return new Promise<void>((_resolve, reject) => {
            // Keep the upload active after DOM.setFileInputFiles succeeds.
            signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          });
        }),
      }),
      statFile: statFile(),
    });

    const upload = uploader.upload(absoluteSavePath());
    await processing;
    expect(uploader.getActiveUploadStatus()).toEqual({ fileProvided: true });
    await expect(uploader.close()).resolves.toEqual({ fileProvided: true });
    await upload.catch(() => undefined);
  });
});

describe("DOM scripts", () => {
  it("treats missing, visible, and hidden elements as explicit states", () => {
    expect(getElementVisibilityScript("#dropSaveGame")).toContain("missing");
    expect(getElementVisibilityScript("#dropSaveGame")).toContain("hidden");
    expect(getElementVisibilityScript("#dropSaveGame")).toContain("visible");
  });
});
