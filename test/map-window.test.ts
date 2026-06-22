// abstract: Tests for map window lifecycle, navigation guards, and upload background throttling.
// out_of_scope: Real Electron BrowserWindow construction, real sessions, and network loading.

import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  getEmbeddedMapViewBounds,
  getMapViewportAlignmentScript,
  type ManagedBrowserWindow,
  MapWindowManager,
} from "../src/main/windows/map-window.js";

type HandlerMap = Map<string, Array<(...args: unknown[]) => void>>;

function createFakeWindow(): ManagedBrowserWindow & {
  handlers: HandlerMap;
  hidden: boolean;
  destroyed: boolean;
  throttling: boolean[];
} {
  const handlers: HandlerMap = new Map();
  const window = {
    handlers,
    hidden: false,
    destroyed: false,
    throttling: [],
    webContents: {
      debugger: {
        isAttached: () => false,
        attach: vi.fn(),
        detach: vi.fn(),
        sendCommand: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      },
      setWindowOpenHandler: vi.fn(),
      setBackgroundThrottling: (allowed: boolean) => {
        window.throttling.push(allowed);
      },
      on: (event: string, listener: (...args: unknown[]) => void) => {
        handlers.set(event, [...(handlers.get(event) ?? []), listener]);
      },
      off: vi.fn(),
      loadURL: vi.fn().mockResolvedValue(undefined),
      executeJavaScript: vi.fn().mockResolvedValue("complete"),
      isDestroyed: () => window.destroyed,
    },
    on: (event: string, listener: (...args: unknown[]) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), listener]);
    },
    once: (event: string, listener: (...args: unknown[]) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), listener]);
    },
    hide: () => {
      window.hidden = true;
    },
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    isMinimized: () => false,
    isDestroyed: () => window.destroyed,
    destroy: () => {
      window.destroyed = true;
      for (const listener of handlers.get("closed") ?? []) {
        listener();
      }
    },
  } satisfies ManagedBrowserWindow & {
    handlers: HandlerMap;
    hidden: boolean;
    destroyed: boolean;
    throttling: boolean[];
  };

  return window;
}

function createFakeView(): {
  webContents: ManagedBrowserWindow["webContents"];
  bounds: { x: number; y: number; width: number; height: number } | undefined;
  setBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  closed: boolean;
} {
  const view = {
    bounds: undefined as { x: number; y: number; width: number; height: number } | undefined,
    closed: false,
    webContents: createFakeWindow().webContents,
    setBounds(bounds: { x: number; y: number; width: number; height: number }) {
      view.bounds = bounds;
    },
  };
  view.webContents.close = () => {
    view.closed = true;
  };
  return view;
}

function createFakeHostWindow() {
  const handlers: HandlerMap = new Map();
  const host = {
    addedViews: [] as unknown[],
    removedViews: [] as unknown[],
    contentBounds: { width: 1280, height: 720 },
    contentView: {
      addChildView: vi.fn((view: unknown) => {
        host.addedViews.push(view);
      }),
      removeChildView: vi.fn((view: unknown) => {
        host.removedViews.push(view);
      }),
    },
    getContentBounds: () => host.contentBounds,
    on: (event: string, listener: (...args: unknown[]) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), listener]);
    },
    off: vi.fn(),
    emit: (event: string) => {
      for (const listener of handlers.get(event) ?? []) {
        listener();
      }
    },
  };
  return host;
}

function emitClose(window: { handlers: HandlerMap }): { prevented: boolean } {
  const event = {
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
  for (const listener of window.handlers.get("close") ?? []) {
    listener(event);
  }
  return event;
}

function emitDidFailLoad(window: { handlers: HandlerMap }, isMainFrame: boolean): void {
  for (const listener of window.handlers.get("did-fail-load") ?? []) {
    listener({}, -105, "ERR_NAME_NOT_RESOLVED", "https://example.invalid", isMainFrame);
  }
}

function emitDidFinishLoad(window: { handlers: HandlerMap }): void {
  for (const listener of window.handlers.get("did-finish-load") ?? []) {
    listener();
  }
}

async function runMapAlignmentScript(script: string, context: vm.Context): Promise<unknown> {
  return await vm.runInNewContext(script, context);
}

describe("MapWindowManager", () => {
  it("reserves the left toolbar area when embedding the map in the status window", () => {
    expect(getEmbeddedMapViewBounds({ width: 1280, height: 720 }, 300)).toEqual({
      x: 300,
      y: 0,
      width: 980,
      height: 720,
    });
  });

  it("embeds the map in the host window and updates right-side bounds on resize", () => {
    const fakeView = createFakeView();
    const fakeHostWindow = createFakeHostWindow();
    const manager = new MapWindowManager({
      hostWindow: fakeHostWindow,
      createView: () => fakeView,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
      embeddedToolbarWidth: 300,
    });

    manager.getOrCreateWindow();

    expect(fakeHostWindow.contentView.addChildView).toHaveBeenCalledWith(fakeView);
    expect(fakeView.bounds).toEqual({ x: 300, y: 0, width: 980, height: 720 });

    fakeHostWindow.contentBounds = { width: 1024, height: 640 };
    fakeHostWindow.emit("resize");

    expect(fakeView.bounds).toEqual({ x: 300, y: 0, width: 724, height: 640 });

    manager.destroy();

    expect(fakeHostWindow.contentView.removeChildView).toHaveBeenCalledWith(fakeView);
    expect(fakeView.closed).toBe(true);
  });

  it("uses the compact toolbar width by default for embedded map bounds", () => {
    const fakeView = createFakeView();
    const fakeHostWindow = createFakeHostWindow();
    const manager = new MapWindowManager({
      hostWindow: fakeHostWindow,
      createView: () => fakeView,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    manager.getOrCreateWindow();

    expect(fakeView.bounds).toEqual({ x: 300, y: 0, width: 980, height: 720 });
  });

  it("hides the map window on user close and destroys it during app quit", () => {
    const fakeWindow = createFakeWindow();
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    manager.getOrCreateWindow();
    expect(emitClose(fakeWindow).prevented).toBe(true);
    expect(fakeWindow.hidden).toBe(true);

    manager.destroy();
    expect(fakeWindow.destroyed).toBe(true);
    expect(manager.hasWindow()).toBe(false);
  });

  it("rebuilds the map window when the previous reference was destroyed", () => {
    const first = createFakeWindow();
    const second = createFakeWindow();
    const createWindow = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const manager = new MapWindowManager({
      createWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    expect(manager.getOrCreateWindow()).toBe(first);
    first.destroy();
    expect(manager.getOrCreateWindow()).toBe(second);
    expect(createWindow).toHaveBeenCalledTimes(2);
  });

  it("temporarily disables background throttling only during upload processing", async () => {
    const fakeWindow = createFakeWindow();
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    await manager.withUploadProcessing(async () => {
      expect(fakeWindow.throttling).toEqual([false]);
    });

    expect(fakeWindow.throttling).toEqual([false, true]);
  });

  it("reads and restores the remote page scroll position", async () => {
    const fakeWindow = createFakeWindow();
    fakeWindow.webContents.executeJavaScript = vi
      .fn()
      .mockResolvedValueOnce({ aligned: true })
      .mockResolvedValueOnce({ x: 16, y: 512 })
      .mockResolvedValueOnce(undefined);
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    const load = manager.loadMap("https://satisfactory-calculator.com/zh/interactive-map", 5_000);
    emitDidFinishLoad(fakeWindow);
    await load;
    await expect(manager.getScrollPosition()).resolves.toEqual({ x: 16, y: 512 });
    await manager.restoreScrollPosition({ x: 16, y: 512 });

    expect(fakeWindow.webContents.executeJavaScript).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        "body > main > div:nth-child(2) > div:nth-child(2) > div.col-md-4.col-lg-3",
      ),
      true,
    );
    expect(fakeWindow.webContents.executeJavaScript).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("window.scrollX"),
      true,
    );
    expect(fakeWindow.webContents.executeJavaScript).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("window.scrollTo(16, 512)"),
      true,
    );
  });

  it("does not create a map view only to read or restore scroll position", async () => {
    const createWindow = vi.fn(() => createFakeWindow());
    const manager = new MapWindowManager({
      createWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    await expect(manager.getScrollPosition()).resolves.toEqual({ x: 0, y: 0 });
    await manager.restoreScrollPosition({ x: 0, y: 128 });

    expect(createWindow).not.toHaveBeenCalled();
  });

  it("does not read scroll from a newly created map window before content loads", async () => {
    const fakeWindow = createFakeWindow();
    fakeWindow.webContents.executeJavaScript = vi.fn().mockResolvedValue({ x: 1, y: 2 });
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    await manager.withUploadProcessing(async () => {
      await expect(manager.getScrollPosition()).resolves.toEqual({ x: 0, y: 0 });
      await manager.restoreScrollPosition({ x: 0, y: 128 });
    });

    expect(fakeWindow.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  it("builds a page script that scrolls to the requested map layout anchor with top padding", async () => {
    const requestedAnchorSelector =
      "body > main > div:nth-child(2) > div:nth-child(2) > div.col-md-4.col-lg-3";
    const scrollTo = vi.fn();
    const querySelector = vi.fn((selector: string) => {
      if (selector === requestedAnchorSelector) {
        return {
          getBoundingClientRect: () => ({ top: 184 }),
        };
      }
      if (selector === "body > header > nav") {
        return {
          getBoundingClientRect: () => ({ height: 72 }),
        };
      }
      return null;
    });

    const result = await runMapAlignmentScript(getMapViewportAlignmentScript(), {
      document: { querySelector },
      window: {
        scrollX: 12,
        scrollY: 300,
        scrollTo,
        setTimeout,
      },
    });

    expect(querySelector).toHaveBeenCalledWith(requestedAnchorSelector);
    expect(querySelector).toHaveBeenCalledWith("body > header > nav");
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", left: 12, top: 396 });
    expect(result).toEqual({
      aligned: true,
      headerHeight: 72,
      selector: requestedAnchorSelector,
      y: 396,
    });
  });

  it("aligns the remote page to the map container after the map main frame loads", async () => {
    const fakeWindow = createFakeWindow();
    fakeWindow.webContents.executeJavaScript = vi.fn().mockResolvedValue({ aligned: false });
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    const load = manager.loadMap("https://satisfactory-calculator.com/zh/interactive-map", 5_000);
    emitDidFinishLoad(fakeWindow);
    await load;

    expect(fakeWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining(
        "body > main > div:nth-child(2) > div:nth-child(2) > div.col-md-4.col-lg-3",
      ),
      true,
    );
  });

  it("does not run map viewport alignment for non-map origins", async () => {
    const fakeWindow = createFakeWindow();
    fakeWindow.webContents.executeJavaScript = vi.fn().mockResolvedValue({ aligned: false });
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    const load = manager.loadMap("http://127.0.0.1:8123/fixture", 5_000);
    emitDidFinishLoad(fakeWindow);
    await load;

    expect(fakeWindow.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  it("restores background throttling after upload processing failure", async () => {
    const fakeWindow = createFakeWindow();
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    await expect(
      manager.withUploadProcessing(async () => {
        throw new Error("upload failed");
      }),
    ).rejects.toThrow("upload failed");

    expect(fakeWindow.throttling).toEqual([false, true]);
  });

  it("registers resource request auditing only when an audit log path is provided", () => {
    const onBeforeRequest = vi.fn();
    const fakeWindow = createFakeWindow();
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        webRequest: { onBeforeRequest },
      }),
      resourceRequestPolicy: {
        logPath: "C:\\logs\\map-resource-requests.ndjson",
        mode: "allowlist",
      },
    });

    manager.getOrCreateWindow();

    expect(onBeforeRequest).toHaveBeenCalledTimes(1);

    const managerWithoutAudit = new MapWindowManager({
      createWindow: () => createFakeWindow(),
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        webRequest: { onBeforeRequest },
      }),
    });

    managerWithoutAudit.getOrCreateWindow();

    expect(onBeforeRequest).toHaveBeenCalledTimes(1);
  });

  it("can show the map window immediately for development visual validation", () => {
    const fakeWindow = createFakeWindow();
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
      showOnCreate: true,
    });

    manager.getOrCreateWindow();

    expect(fakeWindow.show).toHaveBeenCalledTimes(1);
    expect(fakeWindow.focus).toHaveBeenCalledTimes(1);
  });

  it("ignores subframe load failures while waiting for the map main frame", async () => {
    const fakeWindow = createFakeWindow();
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    const load = manager.loadMap("https://satisfactory-calculator.com/zh/interactive-map", 5_000);
    let settled = false;
    void load.then(() => {
      settled = true;
    });

    emitDidFailLoad(fakeWindow, false);
    await Promise.resolve();
    expect(settled).toBe(false);

    emitDidFinishLoad(fakeWindow);
    await expect(load).resolves.toBeUndefined();
  });

  it("fails when the map main frame fails to load", async () => {
    const fakeWindow = createFakeWindow();
    const manager = new MapWindowManager({
      createWindow: () => fakeWindow,
      createSession: () => ({
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      }),
    });

    const load = manager.loadMap("https://satisfactory-calculator.com/zh/interactive-map", 5_000);
    emitDidFailLoad(fakeWindow, true);

    await expect(load).rejects.toThrow("Failed to load");
  });
});
