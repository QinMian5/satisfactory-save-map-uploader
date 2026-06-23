// abstract: Satisfactory save watcher service with debounced serial latest-save uploads.
// out_of_scope: Save-file discovery internals, Electron window construction, and DOM upload details.

import { existsSync, type FSWatcher, type WatchEventType, watch as watchFiles } from "node:fs";
import {
  type CancelableDebouncedAsyncTask,
  createCancelableDebouncedAsyncTask,
} from "../debounce.js";
import { findLatestSave } from "../saves.js";
import { localizedMessage } from "../shared/i18n-messages.js";
import type { AppStateStore } from "./app-state.js";
import type { UploadAuthorizationPort, UploadConsentToken } from "./consent-controller.js";

export type WatchCallback = (eventType: WatchEventType, filename: string | Buffer | null) => void;

export type WatcherPort = Pick<FSWatcher, "close">;

export type SaveUploadPort = {
  upload: (savePath: string, token?: UploadConsentToken) => Promise<void>;
  openMap: () => Promise<void>;
  getActiveUploadStatus?: () => { fileProvided: boolean };
  abortActiveUpload?: () => void;
  close: () => Promise<{ fileProvided: boolean } | undefined>;
};

type SaveWatcherServiceOptions = {
  saveRoot: string;
  state: AppStateStore;
  uploader: SaveUploadPort;
  exists?: (path: string) => boolean;
  findLatestSave?: (root: string) => Promise<string | null>;
  watch?: (root: string, options: { recursive: true }, callback: WatchCallback) => WatcherPort;
  debounceMs?: number;
  uploadOnStart?: boolean;
  authorization?: UploadAuthorizationPort;
  now?: () => Date;
};

const DEFAULT_DEBOUNCE_MS = 2_000;
type UploadSource = "automatic" | "manual";
type UploadRequest = {
  reason: string;
  source: UploadSource;
  savePath?: string;
};

export class SaveWatcherService {
  private readonly saveRoot: string;
  private readonly state: AppStateStore;
  private readonly uploader: SaveUploadPort;
  private readonly exists: (path: string) => boolean;
  private readonly findLatestSave: (root: string) => Promise<string | null>;
  private readonly watch: (
    root: string,
    options: { recursive: true },
    callback: WatchCallback,
  ) => WatcherPort;
  private readonly uploadOnStart: boolean;
  private readonly authorization: UploadAuthorizationPort | undefined;
  private readonly now: () => Date;
  private watcher: WatcherPort | undefined;
  private readonly scheduledAutomaticUpload: CancelableDebouncedAsyncTask;
  private uploading = false;
  private pendingUpload: UploadRequest | undefined;
  private closing = false;
  private operationId = 0;

  constructor(options: SaveWatcherServiceOptions) {
    this.saveRoot = options.saveRoot;
    this.state = options.state;
    this.uploader = options.uploader;
    this.exists = options.exists ?? existsSync;
    this.findLatestSave = options.findLatestSave ?? findLatestSave;
    this.watch = options.watch ?? watchFiles;
    this.uploadOnStart = options.uploadOnStart ?? true;
    this.authorization = options.authorization;
    this.now = options.now ?? (() => new Date());
    this.scheduledAutomaticUpload = createCancelableDebouncedAsyncTask(
      () => this.enqueueUpload({ reason: "save change", source: "automatic" }),
      options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
    );
  }

  async start(): Promise<void> {
    this.closing = false;
    if (this.watcher) {
      return;
    }

    this.state.update({
      watcherStatus: "starting",
      saveRoot: this.saveRoot,
      lastError: null,
    });
    this.state.addLog("info", `Checking save directory: ${this.saveRoot}`);

    if (!this.exists(this.saveRoot)) {
      const message = `Save directory not found: ${this.saveRoot}`;
      this.state.update({
        watcherStatus: "error",
        lastError: localizedMessage("saveDirectory.notFound", { path: this.saveRoot }),
      });
      this.state.addLog("error", message);
      return;
    }

    this.watcher = this.watch(this.saveRoot, { recursive: true }, (_eventType, filename) => {
      if (!filename || filename.toString().toLowerCase().endsWith(".sav")) {
        this.scheduledAutomaticUpload.schedule();
      }
    });

    this.state.update({ watcherStatus: "running" });
    this.state.addLog("info", `Watching Satisfactory saves under ${this.saveRoot}`);

    if (this.uploadOnStart) {
      void this.enqueueUpload({ reason: "initial scan", source: "automatic" });
    }
  }

  async stop(): Promise<void> {
    this.scheduledAutomaticUpload.cancel();
    if (this.pendingUpload?.source === "automatic") {
      this.pendingUpload = undefined;
    }

    if (!this.watcher) {
      this.state.update({ watcherStatus: "stopped" });
      return;
    }

    this.state.update({ watcherStatus: "stopping" });
    this.watcher.close();
    this.watcher = undefined;
    this.state.update({ watcherStatus: "stopped" });
    this.state.addLog("info", "Watcher stopped.");
  }

  async uploadLatestSave(): Promise<void> {
    await this.enqueueUpload({ reason: "manual upload", source: "manual" });
  }

  async uploadSave(savePath: string, reason: string): Promise<void> {
    await this.enqueueUpload({ reason, source: "manual", savePath });
  }

  async openMap(): Promise<void> {
    try {
      this.authorization?.createUploadToken();
    } catch (error) {
      this.reportConsentRequired(error);
      return;
    }
    try {
      await this.uploader.openMap();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.update({
        uploadStatus: "error",
        lastUploadResult: "error",
        lastError: localizedMessage("upload.failedWithDetails", { details: message }),
      });
      this.state.addLog("error", message);
    }
  }

  async close(): Promise<{ fileProvided: boolean }> {
    const preparation = await this.prepareForRevocation();
    const result = await this.uploader.close();
    return result ?? { fileProvided: preparation.fileProvided };
  }

  async prepareForRevocation(): Promise<{
    fileProvided: boolean;
    cleanup: () => Promise<void>;
  }> {
    this.closing = true;
    this.operationId += 1;
    this.pendingUpload = undefined;
    this.scheduledAutomaticUpload.cancel();
    const status = this.uploader.getActiveUploadStatus?.() ?? { fileProvided: false };
    this.uploader.abortActiveUpload?.();
    await this.stop();
    return {
      fileProvided: status.fileProvided,
      cleanup: async () => {
        await this.uploader.close();
      },
    };
  }

  private async enqueueUpload(request: UploadRequest): Promise<void> {
    if (this.closing) {
      return;
    }
    if (request.source === "automatic" && !this.watcher) {
      return;
    }
    if (this.uploading) {
      this.pendingUpload = request;
      return;
    }

    this.uploading = true;

    try {
      let current: UploadRequest | undefined = request;
      while (current && !this.closing) {
        if (current.source === "manual" || this.watcher) {
          await this.uploadOnce(current);
        }
        current = this.pendingUpload;
        this.pendingUpload = undefined;
      }
    } finally {
      this.uploading = false;
    }
  }

  private async uploadOnce(request: UploadRequest): Promise<void> {
    let token: UploadConsentToken | undefined;
    try {
      token = this.authorization?.createUploadToken();
    } catch (error) {
      this.reportConsentRequired(error);
      return;
    }

    const savePath = request.savePath ?? (await this.findLatestSave(this.saveRoot));

    if (!savePath) {
      this.state.addLog("warn", `No .sav files found under ${this.saveRoot}.`);
      return;
    }

    const currentOperationId = this.operationId + 1;
    this.operationId = currentOperationId;
    const startedAt = this.now().toISOString();
    this.state.update({
      uploadStatus: "loading-page",
      latestSavePath: savePath,
      lastUploadStartedAt: startedAt,
      lastUploadResult: null,
      lastError: null,
    });
    const uploadLabel = request.savePath ? "save" : "latest save";
    this.state.addLog("info", `Uploading ${uploadLabel} after ${request.reason}: ${savePath}`);

    try {
      await this.uploader.upload(savePath, token);
      if (!this.isCurrentOperation(currentOperationId)) {
        return;
      }
      this.state.update({
        uploadStatus: "success",
        lastUploadFinishedAt: this.now().toISOString(),
        lastUploadResult: "success",
      });
      this.state.addLog("info", `Uploaded save: ${savePath}`);
    } catch (error) {
      if (!this.isCurrentOperation(currentOperationId)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.state.update({
        uploadStatus: "error",
        lastUploadFinishedAt: this.now().toISOString(),
        lastUploadResult: "error",
        lastError: localizedMessage("upload.failedWithDetails", { details: message }),
      });
      this.state.addLog("error", message);
    }
  }

  private isCurrentOperation(operationId: number): boolean {
    return !this.closing && this.operationId === operationId;
  }

  private reportConsentRequired(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.pendingUpload = undefined;
    this.state.update({
      uploadStatus: "needs-consent",
      lastUploadResult: null,
      lastError: localizedMessage("thirdPartyUpload.permissionRequiredBeforeScanning"),
      consentRequired: true,
      privacyNotice: localizedMessage("thirdPartyUpload.permissionRequiredBeforeScanning"),
    });
    this.state.addLog("warn", message);
  }
}
