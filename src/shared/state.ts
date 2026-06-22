// abstract: Serializable state contracts shared by Electron main, preload, and renderer code.
// out_of_scope: State mutation, IPC transport, and filesystem watching.

import type { AppLanguage } from "./language.js";

export type { AppLanguage } from "./language.js";
export {
  DEFAULT_APP_LANGUAGE,
  SUPPORTED_APP_LANGUAGES,
} from "./language.js";

export type WatcherStatus = "starting" | "running" | "stopping" | "stopped" | "error";

export type UploadStatus =
  | "idle"
  | "needs-consent"
  | "loading-page"
  | "selecting-file"
  | "processing"
  | "success"
  | "error";

export type UploadResult = "success" | "error";

export type ConsentPersistenceStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "durable-revoke-failed";

export type ThirdPartyUploadPermissionStatus =
  | "not-granted"
  | "granted"
  | "revoked"
  | "revocation-save-failed";

export type LogLevel = "info" | "warn" | "error";

export type AppLogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
};

export type AppStateSnapshot = {
  watcherStatus: WatcherStatus;
  uploadStatus: UploadStatus;
  saveRoot: string | null;
  latestSavePath: string | null;
  lastUploadStartedAt: string | null;
  lastUploadFinishedAt: string | null;
  lastUploadResult: UploadResult | null;
  lastError: string | null;
  consentRequired: boolean;
  permissionStatus: ThirdPartyUploadPermissionStatus;
  acceptedDisclosureVersion: number | null;
  currentDisclosureVersion: number;
  autoStartWatcher: boolean;
  consentPersistenceStatus: ConsentPersistenceStatus;
  consentPersistenceMessage: string | null;
  language: AppLanguage;
  privacyNotice: string | null;
  logs: AppLogEntry[];
};

export type DisclosureSnapshot = Pick<
  AppStateSnapshot,
  | "consentRequired"
  | "permissionStatus"
  | "acceptedDisclosureVersion"
  | "currentDisclosureVersion"
  | "autoStartWatcher"
  | "privacyNotice"
>;
