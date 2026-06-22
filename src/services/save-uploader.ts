// abstract: Electron Chromium save upload orchestration through Chrome DevTools Protocol.
// out_of_scope: Filesystem watching, renderer state presentation, and real third-party site tests.

import { stat } from "node:fs/promises";
import path from "node:path";
import type { UploadConsentToken } from "./consent-controller.js";

const DEFAULT_UPLOAD_TIMEOUT_MS = 60_000;
const DEFAULT_PROCESSING_START_TIMEOUT_MS = 5_000;

export const UPLOAD_CONFIG = {
  mapUrl: "https://satisfactory-calculator.com/zh/interactive-map",
  selectors: {
    saveFileInput: "#saveGameFileInput",
    uploadPanel: "#dropSaveGame",
  },
  timeouts: {
    pageLoadMs: DEFAULT_UPLOAD_TIMEOUT_MS,
    processingMs: DEFAULT_UPLOAD_TIMEOUT_MS,
    processingStartMs: DEFAULT_PROCESSING_START_TIMEOUT_MS,
  },
};

export const MAP_URL = UPLOAD_CONFIG.mapUrl;
export const SAVE_FILE_INPUT_SELECTOR = UPLOAD_CONFIG.selectors.saveFileInput;
export const UPLOAD_PANEL_SELECTOR = UPLOAD_CONFIG.selectors.uploadPanel;

export type ElementVisibilityState = "missing" | "visible" | "hidden";

export type ScrollPosition = {
  x: number;
  y: number;
};

export type UploadErrorCode =
  | "debugger-attach-failed"
  | "debugger-detached"
  | "file-selection-failed"
  | "invalid-save-path"
  | "upload-control-not-found"
  | "upload-panel-not-ready"
  | "upload-not-started"
  | "page-load-failed"
  | "save-file-extension-invalid"
  | "save-file-not-file"
  | "save-file-not-found"
  | "upload-cancelled"
  | "upload-consent-required"
  | "upload-timeout";

export class UploadError extends Error {
  readonly code: UploadErrorCode;

  constructor(code: UploadErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "UploadError";
    this.code = code;
  }
}

export type DebuggerPort = {
  isAttached: () => boolean;
  attach: (protocolVersion?: string) => void;
  detach: () => void;
  sendCommand: <T = unknown>(method: string, commandParams?: Record<string, unknown>) => Promise<T>;
  on: (event: "detach", listener: (event: unknown, reason: string) => void) => void;
  off: (event: "detach", listener: (event: unknown, reason: string) => void) => void;
};

export type MapWindowPort = {
  loadMap: (url: string, timeoutMs: number, signal?: AbortSignal) => Promise<void>;
  waitForDomReady: (timeoutMs: number, signal?: AbortSignal) => Promise<void>;
  getElementState: (selector: string) => Promise<ElementVisibilityState>;
  getInputFileCount: (selector: string) => Promise<number>;
  getScrollPosition: () => Promise<ScrollPosition>;
  restoreScrollPosition: (position: ScrollPosition) => Promise<void>;
  waitForElementState: (
    selector: string,
    expectedState: ElementVisibilityState,
    timeoutMs: number,
    signal?: AbortSignal,
  ) => Promise<void>;
  withUploadProcessing: <T>(operation: () => Promise<T>) => Promise<T>;
  show: () => void;
  focus: () => void;
  destroy: () => void | Promise<void>;
  getDebugger: () => DebuggerPort;
};

type ElectronSaveUploaderOptions = {
  mapWindow: MapWindowPort;
  targetUrl?: string;
  timeoutMs?: number;
  processingStartTimeoutMs?: number;
  statFile?: (savePath: string) => Promise<{ isFile: () => boolean }>;
  authorization?: {
    assertUploadAllowed: (token: UploadConsentToken) => void;
  };
};

type DomDocument = {
  root: {
    nodeId: number;
  };
};

type QuerySelectorResult = {
  nodeId: number;
};

type ResolveNodeResult = {
  object: {
    objectId?: string;
  };
};

export class CdpFileInputSetter {
  constructor(private readonly debug: DebuggerPort) {}

  async setFileInputFiles(selector: string, files: string[]): Promise<void> {
    let detachedReason: string | null = null;
    let attachedByUs = false;
    let detaching = false;
    const onDetach = (_event: unknown, reason: string): void => {
      if (!detaching) {
        detachedReason = reason || "unknown reason";
      }
    };

    try {
      if (this.debug.isAttached()) {
        throw new UploadError(
          "debugger-attach-failed",
          "Could not attach debugger because it is already attached.",
        );
      }

      try {
        this.debug.attach();
        attachedByUs = true;
      } catch (error) {
        throw new UploadError("debugger-attach-failed", "Could not attach debugger.", error);
      }

      this.debug.on("detach", onDetach);
      await this.sendCommandOrThrowOnDetach("DOM.enable", undefined, () => detachedReason);
      const document = await this.sendCommandOrThrowOnDetach<DomDocument>(
        "DOM.getDocument",
        { depth: -1, pierce: true },
        () => detachedReason,
      );
      const query = await this.sendCommandOrThrowOnDetach<QuerySelectorResult>(
        "DOM.querySelector",
        {
          nodeId: document.root.nodeId,
          selector,
        },
        () => detachedReason,
      );

      if (!query.nodeId) {
        throw new UploadError(
          "upload-control-not-found",
          `Could not find map upload control: ${selector}`,
        );
      }

      await this.sendCommandOrThrowOnDetach(
        "DOM.setFileInputFiles",
        {
          nodeId: query.nodeId,
          files,
        },
        () => detachedReason,
      );
      const resolvedNode = await this.sendCommandOrThrowOnDetach<ResolveNodeResult>(
        "DOM.resolveNode",
        { nodeId: query.nodeId },
        () => detachedReason,
      );
      if (!resolvedNode.object.objectId) {
        throw new UploadError(
          "file-selection-failed",
          `Could not resolve map upload control: ${selector}`,
        );
      }
      await this.sendCommandOrThrowOnDetach(
        "Runtime.callFunctionOn",
        {
          objectId: resolvedNode.object.objectId,
          functionDeclaration: `function() {
            const input = this;
            const startedAt = Date.now();
            const dispatch = () => {
              if (!input.files || input.files.length === 0) {
                return;
              }
              const jQuery = window.jQuery || window.$;
              if (jQuery && jQuery.fn && typeof jQuery.fn.trigger === "function") {
                jQuery(input).trigger("change");
              } else {
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
              }
              if (input.files && input.files.length > 0 && Date.now() - startedAt < 5000) {
                window.setTimeout(dispatch, 100);
              }
            };
            dispatch();
          }`,
          userGesture: true,
        },
        () => detachedReason,
      );
    } finally {
      this.debug.off("detach", onDetach);
      if (attachedByUs) {
        detaching = true;
        try {
          this.debug.detach();
        } catch {
          // Electron throws when detach is called after the target was already closed.
        }
      }
    }
  }

  private async sendCommandOrThrowOnDetach<T = unknown>(
    method: string,
    params: Record<string, unknown> | undefined,
    getDetachedReason: () => string | null,
  ): Promise<T> {
    let result: T;
    try {
      result = await this.debug.sendCommand<T>(method, params);
    } catch (error) {
      const reason = getDetachedReason();
      if (reason) {
        throw new UploadError("debugger-detached", `Debugger detached during upload: ${reason}`);
      }
      throw new UploadError("file-selection-failed", `CDP command failed: ${method}`, error);
    }
    const reason = getDetachedReason();
    if (reason) {
      throw new UploadError("debugger-detached", `Debugger detached during upload: ${reason}`);
    }
    return result;
  }
}

export class ElectronSaveUploader {
  private readonly mapWindow: MapWindowPort;
  private readonly targetUrl: string;
  private readonly timeoutMs: number;
  private readonly processingStartTimeoutMs: number;
  private readonly statFile: (savePath: string) => Promise<{ isFile: () => boolean }>;
  private readonly authorization:
    | {
        assertUploadAllowed: (token: UploadConsentToken) => void;
      }
    | undefined;
  private activeUpload:
    | {
        controller: AbortController;
        fileProvided: boolean;
      }
    | undefined;

  constructor(options: ElectronSaveUploaderOptions) {
    this.mapWindow = options.mapWindow;
    this.targetUrl = options.targetUrl ?? MAP_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;
    this.processingStartTimeoutMs =
      options.processingStartTimeoutMs ?? DEFAULT_PROCESSING_START_TIMEOUT_MS;
    this.statFile = options.statFile ?? stat;
    this.authorization = options.authorization;
  }

  async upload(savePath: string, token?: UploadConsentToken): Promise<void> {
    this.assertUploadAllowed(token);
    await this.validateSavePath(savePath);
    if (this.activeUpload) {
      throw new UploadError("upload-cancelled", "Another upload is already active.");
    }

    const controller = new AbortController();
    this.activeUpload = { controller, fileProvided: false };
    try {
      await this.mapWindow.withUploadProcessing(() =>
        this.uploadWithSignal(savePath, controller.signal, token),
      );
    } finally {
      if (this.activeUpload?.controller === controller) {
        this.activeUpload = undefined;
      }
    }
  }

  private async uploadWithSignal(
    savePath: string,
    signal: AbortSignal,
    token: UploadConsentToken | undefined,
  ): Promise<void> {
    const scrollPosition = await this.captureScrollPosition();
    try {
      try {
        throwIfAborted(signal);
        await this.mapWindow.loadMap(this.targetUrl, this.timeoutMs, signal);
        throwIfAborted(signal);
        await this.mapWindow.waitForDomReady(this.timeoutMs, signal);
      } catch (error) {
        if (signal.aborted) {
          throw new UploadError("upload-cancelled", "Upload was cancelled.", error);
        }
        throw new UploadError("page-load-failed", "Map page did not finish loading.", error);
      }

      this.assertUploadAllowed(token);
      const inputState = await this.mapWindow.getElementState(SAVE_FILE_INPUT_SELECTOR);
      if (inputState === "missing") {
        throw new UploadError(
          "upload-control-not-found",
          `Could not find map upload control: ${SAVE_FILE_INPUT_SELECTOR}`,
        );
      }

      const panelState = await this.mapWindow.getElementState(UPLOAD_PANEL_SELECTOR);
      if (panelState !== "visible") {
        throw new UploadError(
          "upload-panel-not-ready",
          `Map upload panel was not ready: ${UPLOAD_PANEL_SELECTOR}`,
        );
      }

      const setter = new CdpFileInputSetter(this.mapWindow.getDebugger());
      await setter.setFileInputFiles(SAVE_FILE_INPUT_SELECTOR, [savePath]);
      if (this.activeUpload) {
        this.activeUpload.fileProvided = true;
      }
      this.assertUploadAllowed(token);

      await this.waitForProcessingStart(signal);

      try {
        await this.waitForProcessingFinish(signal);
      } catch (error) {
        if (signal.aborted) {
          throw new UploadError("upload-cancelled", "Upload was cancelled.", error);
        }
        throw new UploadError(
          "upload-timeout",
          "Map page did not finish processing the save.",
          error,
        );
      }
    } finally {
      await this.restoreScrollPosition(scrollPosition);
    }
  }

  private async captureScrollPosition(): Promise<ScrollPosition | undefined> {
    try {
      return await this.mapWindow.getScrollPosition();
    } catch {
      return undefined;
    }
  }

  private async restoreScrollPosition(position: ScrollPosition | undefined): Promise<void> {
    if (!position) {
      return;
    }
    try {
      await this.mapWindow.restoreScrollPosition(position);
    } catch {
      // Scroll restoration is best-effort and must not mask upload results.
    }
  }

  private async waitForProcessingStart(signal: AbortSignal): Promise<void> {
    try {
      await this.mapWindow.waitForElementState(
        UPLOAD_PANEL_SELECTOR,
        "hidden",
        this.processingStartTimeoutMs,
        signal,
      );
    } catch (error) {
      if (signal.aborted) {
        throw new UploadError("upload-cancelled", "Upload was cancelled.", error);
      }
      throw new UploadError("upload-not-started", "Map page did not start processing the save.");
    }
  }

  private async waitForProcessingFinish(signal: AbortSignal): Promise<void> {
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() <= deadline) {
      throwIfAborted(signal);
      const panelState = await this.mapWindow.getElementState(UPLOAD_PANEL_SELECTOR);
      const selectedFileCount = await this.mapWindow.getInputFileCount(SAVE_FILE_INPUT_SELECTOR);
      if (panelState === "visible" && selectedFileCount === 0) {
        return;
      }
      await delay(100, signal);
    }
    throw new Error("Timed out waiting for map upload processing to finish.");
  }

  private async validateSavePath(savePath: string): Promise<void> {
    if (!path.isAbsolute(savePath)) {
      throw new UploadError("invalid-save-path", `Save path must be absolute: ${savePath}`);
    }

    let fileStats: { isFile: () => boolean };
    try {
      fileStats = await this.statFile(savePath);
    } catch (error) {
      throw new UploadError("save-file-not-found", `Save file not found: ${savePath}`, error);
    }

    if (!fileStats.isFile()) {
      throw new UploadError("save-file-not-file", `Save path is not a file: ${savePath}`);
    }

    if (path.extname(savePath).toLowerCase() !== ".sav") {
      throw new UploadError(
        "save-file-extension-invalid",
        `Save file must use the .sav extension: ${savePath}`,
      );
    }
  }

  async openMap(): Promise<void> {
    await this.mapWindow.loadMap(this.targetUrl, this.timeoutMs);
    this.mapWindow.show();
    this.mapWindow.focus();
  }

  getActiveUploadStatus(): { fileProvided: boolean } {
    return { fileProvided: this.activeUpload?.fileProvided ?? false };
  }

  abortActiveUpload(): void {
    this.activeUpload?.controller.abort();
  }

  async close(): Promise<{ fileProvided: boolean }> {
    const status = this.getActiveUploadStatus();
    this.abortActiveUpload();
    await this.mapWindow.destroy();
    return status;
  }

  private assertUploadAllowed(token: UploadConsentToken | undefined): void {
    if (!this.authorization) {
      return;
    }
    if (!token) {
      throw new UploadError(
        "upload-consent-required",
        "Third-party upload permission is required.",
      );
    }
    try {
      this.authorization.assertUploadAllowed(token);
    } catch (error) {
      throw new UploadError(
        "upload-consent-required",
        error instanceof Error ? error.message : "Third-party upload permission is required.",
        error,
      );
    }
  }
}

export function getElementVisibilityScript(selector: string): string {
  const escapedSelector = JSON.stringify(selector);
  return `(() => {
    const element = document.querySelector(${escapedSelector});
    if (!element) return "missing";
    const style = window.getComputedStyle(element);
    const hidden =
      style.display === "none" ||
      style.visibility === "hidden" ||
      element.getClientRects().length === 0;
    return hidden ? "hidden" : "visible";
  })()`;
}

export function getInputFileCountScript(selector: string): string {
  const escapedSelector = JSON.stringify(selector);
  return `(() => {
    const input = document.querySelector(${escapedSelector});
    if (!input || !("files" in input) || !input.files) return 0;
    return input.files.length;
  })()`;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new UploadError("upload-cancelled", "Upload was cancelled.");
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new UploadError("upload-cancelled", "Upload was cancelled."));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new UploadError("upload-cancelled", "Upload was cancelled."));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
