// abstract: Lazy Electron map window lifecycle and DOM wait helpers for save uploads.
// out_of_scope: Watcher scheduling, app state mutation, and renderer status presentation.

import {
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  session,
  type View,
  WebContentsView,
  type WebContentsViewConstructorOptions,
} from "electron";
import {
  type DebuggerPort,
  type ElementVisibilityState,
  getElementVisibilityScript,
  getInputFileCountScript,
  MAP_URL,
  type MapWindowPort,
  type ScrollPosition,
} from "../../services/save-uploader.js";
import { createMapNavigationPolicy, isAllowedMapNavigation } from "../security/map-navigation.js";
import {
  type MapResourcePolicyConfig,
  type ResourceRequestAuditSession,
  registerMapResourceRequestAudit,
} from "../security/map-resource-audit.js";
import {
  clearWebPermissionHandlers,
  denyAllWebPermissions,
  type PermissionSession,
} from "../security/permissions.js";
import { createMapViewOptions, createMapWindowOptions } from "../security/window-options.js";

const DOM_POLL_INTERVAL_MS = 250;
const MAP_VIEWPORT_ALIGNMENT_TOP_PADDING_PX = 16;
const MAP_VIEWPORT_ALIGNMENT_TIMEOUT_MS = 2_000;
const MAP_VIEWPORT_ALIGNMENT_POLL_INTERVAL_MS = 100;
const MAP_VIEWPORT_ALIGNMENT_SELECTORS = [
  "body > main > div:nth-child(2) > div:nth-child(2) > div.col-md-4.col-lg-3",
  ".leaflet-container",
  "#interactiveMap",
  "#map",
  "#map-container",
];
export const DEFAULT_EMBEDDED_MAP_TOOLBAR_WIDTH = 300;

type Size = {
  width: number;
  height: number;
};

type Bounds = Size & {
  x: number;
  y: number;
};

export function getEmbeddedMapViewBounds(
  contentSize: Size,
  toolbarWidth = DEFAULT_EMBEDDED_MAP_TOOLBAR_WIDTH,
): Bounds {
  return {
    x: toolbarWidth,
    y: 0,
    width: Math.max(0, contentSize.width - toolbarWidth),
    height: contentSize.height,
  };
}

export function getMapViewportAlignmentScript(): string {
  return `(() => {
    const selectors = ${JSON.stringify(MAP_VIEWPORT_ALIGNMENT_SELECTORS)};
    const topPadding = ${MAP_VIEWPORT_ALIGNMENT_TOP_PADDING_PX};
    const timeoutMs = ${MAP_VIEWPORT_ALIGNMENT_TIMEOUT_MS};
    const pollIntervalMs = ${MAP_VIEWPORT_ALIGNMENT_POLL_INTERVAL_MS};
    const getHeaderHeight = () => {
      const nav = document.querySelector("body > header > nav");
      if (!nav || typeof nav.getBoundingClientRect !== "function") {
        return 0;
      }
      const navRect = nav.getBoundingClientRect();
      if (Number.isFinite(navRect.height)) {
        return Math.max(0, Math.round(navRect.height));
      }
      if (Number.isFinite(navRect.top) && Number.isFinite(navRect.bottom)) {
        return Math.max(0, Math.round(navRect.bottom - navRect.top));
      }
      if (Number.isFinite(nav.offsetHeight)) {
        return Math.max(0, Math.round(nav.offsetHeight));
      }
        return 0;
    };
    const findTarget = () => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (!element || typeof element.getBoundingClientRect !== "function") {
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (!Number.isFinite(rect.top)) {
          continue;
        }
        return { rect, selector };
      }
      return undefined;
    };
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const poll = () => {
        const target = findTarget();
        if (target) {
          const headerHeight = getHeaderHeight();
          const y = Math.max(
            0,
            Math.round(target.rect.top + window.scrollY - headerHeight - topPadding),
          );
          window.scrollTo({ behavior: "auto", left: window.scrollX, top: y });
          resolve({ aligned: true, headerHeight, selector: target.selector, y });
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          resolve({ aligned: false });
          return;
        }
        window.setTimeout(poll, pollIntervalMs);
      };
      poll();
    });
  })()`;
}

type NavigationEvent = {
  url?: string;
  isMainFrame?: boolean;
  preventDefault: () => void;
};

export type ManagedWebContents = {
  debugger: DebuggerPort;
  setWindowOpenHandler: (handler: () => { action: "deny" }) => void;
  setBackgroundThrottling: (allowed: boolean) => void;
  on: (event: string, listener: (...args: never[]) => void) => void;
  off: (event: string, listener: (...args: never[]) => void) => void;
  loadURL: (url: string) => Promise<void>;
  executeJavaScript: <T = unknown>(script: string, userGesture?: boolean) => Promise<T>;
  focus?: () => void;
  close?: (options?: { waitForBeforeUnload?: boolean }) => void;
  isDestroyed?: () => boolean;
};

export type ManagedBrowserWindow = {
  webContents: ManagedWebContents;
  on: (event: string, listener: (...args: never[]) => void) => void;
  hide: () => void;
  show: () => void;
  focus: () => void;
  restore: () => void;
  isMinimized: () => boolean;
  isDestroyed: () => boolean;
  destroy: () => void | Promise<void>;
};

export type ManagedMapView = {
  webContents: ManagedWebContents;
  setBounds: (bounds: Bounds) => void;
};

type ManagedHostWindow = {
  contentView: {
    addChildView: (view: View) => void;
    removeChildView: (view: View) => void;
  };
  getContentBounds: () => Size;
  on: (event: "resize" | "closed", listener: () => void) => void;
  off: (event: "resize" | "closed", listener: () => void) => void;
};

type MapWindowManagerOptions = {
  createWindow?: (options: BrowserWindowConstructorOptions) => ManagedBrowserWindow;
  createView?: (options: WebContentsViewConstructorOptions) => ManagedMapView;
  hostWindow?: ManagedHostWindow;
  createSession?: (partition: string, options: { cache: false }) => PermissionSession;
  allowedOrigin?: string;
  partition?: string;
  embeddedToolbarWidth?: number;
  configureSession?: (mapSession: PermissionSession) => void;
  onBackgroundThrottlingChange?: (allowed: boolean) => void;
  resourceRequestPolicy?: MapResourcePolicyConfig;
  showOnCreate?: boolean;
};

export class MapWindowManager implements MapWindowPort {
  private window: ManagedBrowserWindow | undefined;
  private mapSession: PermissionSession | undefined;
  private isQuitting = false;
  private hasLoadedMapContent = false;
  private readonly createWindow: (options: BrowserWindowConstructorOptions) => ManagedBrowserWindow;
  private readonly createView: (options: WebContentsViewConstructorOptions) => ManagedMapView;
  private readonly hostWindow: ManagedHostWindow | undefined;
  private readonly createSession: (
    partition: string,
    options: { cache: false },
  ) => PermissionSession;
  private readonly navigationPolicy: (targetUrl: string, isMainFrame: boolean) => boolean;
  private readonly partition: string;
  private readonly embeddedToolbarWidth: number;
  private readonly configureSession: ((mapSession: PermissionSession) => void) | undefined;
  private readonly onBackgroundThrottlingChange: ((allowed: boolean) => void) | undefined;
  private readonly resourceRequestPolicy: MapResourcePolicyConfig | undefined;
  private readonly showOnCreate: boolean;

  constructor(options: MapWindowManagerOptions = {}) {
    this.createWindow =
      options.createWindow ??
      ((windowOptions) => new BrowserWindow(windowOptions) as unknown as ManagedBrowserWindow);
    this.createView =
      options.createView ??
      ((viewOptions) => new WebContentsView(viewOptions) as unknown as ManagedMapView);
    this.hostWindow = options.hostWindow;
    this.createSession =
      options.createSession ??
      ((partition, sessionOptions) => session.fromPartition(partition, sessionOptions));
    this.navigationPolicy = options.allowedOrigin
      ? createMapNavigationPolicy(options.allowedOrigin)
      : isAllowedMapNavigation;
    this.partition = options.partition ?? "map";
    this.embeddedToolbarWidth = options.embeddedToolbarWidth ?? DEFAULT_EMBEDDED_MAP_TOOLBAR_WIDTH;
    this.configureSession = options.configureSession;
    this.onBackgroundThrottlingChange = options.onBackgroundThrottlingChange;
    this.resourceRequestPolicy = options.resourceRequestPolicy;
    this.showOnCreate = options.showOnCreate ?? false;
  }

  async loadMap(url = MAP_URL, timeoutMs: number, signal?: AbortSignal): Promise<void> {
    const window = this.getOrCreateWindow();
    await loadUrlWithTimeout(window, url, timeoutMs, signal);
    this.hasLoadedMapContent = true;
    await this.alignViewportToMapContent(url, signal);
  }

  async waitForDomReady(timeoutMs: number, signal?: AbortSignal): Promise<void> {
    await waitForCondition(timeoutMs, signal, async () => {
      const readyState = await this.getOrCreateWindow().webContents.executeJavaScript(
        "document.readyState",
        true,
      );
      return readyState === "interactive" || readyState === "complete";
    });
  }

  async getElementState(selector: string): Promise<ElementVisibilityState> {
    return this.getOrCreateWindow().webContents.executeJavaScript<ElementVisibilityState>(
      getElementVisibilityScript(selector),
      true,
    );
  }

  async getInputFileCount(selector: string): Promise<number> {
    return this.getOrCreateWindow().webContents.executeJavaScript<number>(
      getInputFileCountScript(selector),
      true,
    );
  }

  async getScrollPosition(): Promise<ScrollPosition> {
    const window = this.window;
    if (!window || window.isDestroyed() || !this.hasLoadedMapContent) {
      return { x: 0, y: 0 };
    }

    const position = await window.webContents.executeJavaScript<{
      x?: unknown;
      y?: unknown;
    }>(
      `(() => ({
        x: Number.isFinite(window.scrollX) ? window.scrollX : 0,
        y: Number.isFinite(window.scrollY) ? window.scrollY : 0,
      }))()`,
      true,
    );
    return {
      x: typeof position.x === "number" && Number.isFinite(position.x) ? position.x : 0,
      y: typeof position.y === "number" && Number.isFinite(position.y) ? position.y : 0,
    };
  }

  async restoreScrollPosition(position: ScrollPosition): Promise<void> {
    const window = this.window;
    if (!window || window.isDestroyed() || !this.hasLoadedMapContent) {
      return;
    }

    const x = Number.isFinite(position.x) ? position.x : 0;
    const y = Number.isFinite(position.y) ? position.y : 0;
    await window.webContents.executeJavaScript(`window.scrollTo(${x}, ${y})`, true);
  }

  async waitForElementState(
    selector: string,
    expectedState: ElementVisibilityState,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<void> {
    await waitForCondition(timeoutMs, signal, async () => {
      return (await this.getElementState(selector)) === expectedState;
    });
  }

  async withUploadProcessing<T>(operation: () => Promise<T>): Promise<T> {
    const window = this.getOrCreateWindow();
    window.webContents.setBackgroundThrottling(false);
    this.onBackgroundThrottlingChange?.(false);
    return operation();
  }

  private async alignViewportToMapContent(url: string, signal?: AbortSignal): Promise<void> {
    const window = this.window;
    if (!shouldAlignMapViewport(url) || signal?.aborted || !window || window.isDestroyed()) {
      return;
    }

    try {
      await window.webContents.executeJavaScript(getMapViewportAlignmentScript(), true);
    } catch {
      // Viewport alignment is best-effort and must not mask page load or upload results.
    }
  }

  show(): void {
    const window = this.getOrCreateWindow();
    window.show();
  }

  focus(): void {
    const window = this.getOrCreateWindow();
    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
  }

  destroy(): void {
    this.isQuitting = true;
    const window = this.window;
    const mapSession = this.mapSession;
    this.window = undefined;
    this.hasLoadedMapContent = false;
    clearWebPermissionHandlers(this.mapSession);
    this.mapSession = undefined;
    if (window && !window.isDestroyed()) {
      window.destroy();
    }
    void clearMapSessionData(mapSession);
  }

  getDebugger(): DebuggerPort {
    return this.getOrCreateWindow().webContents.debugger;
  }

  hasWindow(): boolean {
    return Boolean(this.window && !this.window.isDestroyed());
  }

  getOrCreateWindow(): ManagedBrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }

    this.isQuitting = false;
    this.hasLoadedMapContent = false;
    this.mapSession = this.createSession(this.partition, { cache: false });
    configureMapSession(this.mapSession);
    if (this.resourceRequestPolicy) {
      registerMapResourceRequestAudit(
        this.mapSession as ResourceRequestAuditSession,
        this.resourceRequestPolicy.logPath,
        { mode: this.resourceRequestPolicy.mode },
      );
    }
    this.configureSession?.(this.mapSession);

    const createdWindow = this.hostWindow
      ? createEmbeddedMapWindow({
          hostWindow: this.hostWindow,
          view: this.createView(createMapViewOptions(this.partition)),
          toolbarWidth: this.embeddedToolbarWidth,
        })
      : this.createWindow(createMapWindowOptions(this.partition));
    this.window = createdWindow;
    if (this.showOnCreate) {
      this.window.show();
      this.window.focus();
    }
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const blockNavigation = createNavigationBlocker(this.navigationPolicy);
    this.window.webContents.on("will-navigate", blockNavigation);
    this.window.webContents.on("will-redirect", blockNavigation);
    this.window.on("close", (event: { preventDefault: () => void }) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.window?.hide();
      }
    });
    this.window.on("closed", () => {
      if (this.window === createdWindow) {
        this.window = undefined;
        this.hasLoadedMapContent = false;
      }
    });

    return this.window;
  }
}

function createEmbeddedMapWindow(options: {
  hostWindow: ManagedHostWindow;
  view: ManagedMapView;
  toolbarWidth: number;
}): ManagedBrowserWindow {
  const { hostWindow, view, toolbarWidth } = options;
  const closedListeners: Array<() => void> = [];
  let destroyed = false;

  const updateBounds = (): void => {
    if (!destroyed) {
      view.setBounds(getEmbeddedMapViewBounds(hostWindow.getContentBounds(), toolbarWidth));
    }
  };

  const hostView = view as unknown as View;
  hostWindow.contentView.addChildView(hostView);
  updateBounds();
  hostWindow.on("resize", updateBounds);

  return {
    webContents: view.webContents,
    on: (event: string, listener: (...args: never[]) => void) => {
      if (event === "closed") {
        closedListeners.push(listener as () => void);
      }
    },
    hide: () => {
      view.setBounds({ x: toolbarWidth, y: 0, width: 0, height: 0 });
    },
    show: updateBounds,
    focus: () => {
      view.webContents.focus?.();
    },
    restore: () => undefined,
    isMinimized: () => false,
    isDestroyed: () => destroyed || view.webContents.isDestroyed?.() === true,
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      hostWindow.off("resize", updateBounds);
      hostWindow.contentView.removeChildView(hostView);
      if (view.webContents.isDestroyed?.() !== true) {
        view.webContents.close?.({ waitForBeforeUnload: false });
      }
      for (const listener of closedListeners) {
        listener();
      }
    },
  };
}

function configureMapSession(mapSession: PermissionSession): void {
  denyAllWebPermissions(mapSession);
}

async function clearMapSessionData(mapSession: PermissionSession | undefined): Promise<void> {
  if (!mapSession) {
    return;
  }
  await mapSession.clearStorageData?.().catch(() => undefined);
  await mapSession.clearCache?.().catch(() => undefined);
}

function createNavigationBlocker(policy: (targetUrl: string, isMainFrame: boolean) => boolean) {
  return (
    event: NavigationEvent,
    legacyUrl?: string,
    _legacyIsInPlace?: boolean,
    legacyIsMainFrame?: boolean,
  ): void => {
    const targetUrl = event.url ?? legacyUrl ?? "";
    const isMainFrame = event.isMainFrame ?? legacyIsMainFrame ?? true;
    if (!policy(targetUrl, isMainFrame)) {
      event.preventDefault();
    }
  };
}

function shouldAlignMapViewport(url: string): boolean {
  try {
    return new URL(url).origin === new URL(MAP_URL).origin;
  } catch {
    return false;
  }
}

function loadUrlWithTimeout(
  window: ManagedBrowserWindow,
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.isDestroyed()) {
      reject(new Error("Map window was destroyed before loading."));
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      rejectOnce(new Error(`Timed out loading ${url}`));
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timer);
      window.webContents.off("did-finish-load", onLoad);
      window.webContents.off("did-fail-load", onFail);
      window.webContents.off("destroyed", onDestroyed);
      signal?.removeEventListener("abort", onAbort);
    };
    const resolveOnce = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };
    const rejectOnce = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const onLoad = (): void => {
      resolveOnce();
    };
    const onFail = (
      _event: unknown,
      errorCode: number,
      errorDescription: string,
      _validatedUrl?: string,
      isMainFrame = true,
    ): void => {
      if (!isMainFrame) {
        return;
      }
      if (errorCode === -3) {
        return;
      }
      rejectOnce(new Error(`Failed to load ${url}: ${errorCode} ${errorDescription}`));
    };
    const onDestroyed = (): void => {
      rejectOnce(new Error("Map window was destroyed while loading."));
    };
    const onAbort = (): void => {
      rejectOnce(new Error("Map load was cancelled."));
    };

    window.webContents.on("did-finish-load", onLoad);
    window.webContents.on("did-fail-load", onFail);
    window.webContents.on("destroyed", onDestroyed);
    signal?.addEventListener("abort", onAbort, { once: true });
    window.webContents.loadURL(url).catch((error: unknown) => {
      rejectOnce(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

async function waitForCondition(
  timeoutMs: number,
  signal: AbortSignal | undefined,
  predicate: () => Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error("Operation was cancelled.");
    }
    if (await predicate()) {
      return;
    }
    await delay(DOM_POLL_INTERVAL_MS, signal);
  }
  throw new Error("Timed out waiting for page condition.");
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Operation was cancelled."));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error("Operation was cancelled."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
