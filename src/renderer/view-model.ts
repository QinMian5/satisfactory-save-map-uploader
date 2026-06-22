// abstract: Renderer-only view selection and user-facing status copy.
// out_of_scope: DOM mutation, Electron IPC, and main-process state mutation.

import type { AppStateSnapshot } from "../shared/state.js";
import { getRendererCopy } from "./i18n.js";

export type RendererViewMode = "consent" | "dashboard";

export type DashboardSummary = {
  latestSaveTitle: string;
  issueTitle: string | null;
  issueDetail: string | null;
  showIssue: boolean;
  showStartButton: boolean;
  showStopButton: boolean;
};

export type DashboardViewModel = {
  latestSaveTitle: string;
  issueTitle: string | null;
  issueDetail: string | null;
  showIssue: boolean;
  showStartButton: boolean;
  showStopButton: boolean;
  startDisabled: boolean;
  stopDisabled: boolean;
  uploadDisabled: boolean;
};

export type ConsentViewModel = {
  isSaving: boolean;
  issueTitle: string | null;
  issueDetail: string | null;
  showIssue: boolean;
};

export function getRendererViewMode(state: AppStateSnapshot): RendererViewMode {
  if (state.permissionStatus === "granted") {
    return "dashboard";
  }
  return "consent";
}

export function getDashboardSummary(state: AppStateSnapshot): DashboardSummary {
  const issue = getDashboardIssue(state);
  const copy = getRendererCopy(state.language);

  return {
    latestSaveTitle: getSaveFileName(state.latestSavePath) ?? copy.dashboard.noSaveSelected,
    issueTitle: issue?.title ?? null,
    issueDetail: issue?.detail ?? null,
    showIssue: Boolean(issue),
    showStartButton: state.watcherStatus === "stopped" || state.watcherStatus === "error",
    showStopButton: state.watcherStatus !== "stopped" && state.watcherStatus !== "error",
  };
}

export function getDashboardViewModel(
  state: AppStateSnapshot,
  commandError: string | null,
): DashboardViewModel {
  const summary = getDashboardSummary(state);
  const copy = getRendererCopy(state.language);
  return {
    latestSaveTitle: summary.latestSaveTitle,
    issueTitle: commandError ? copy.dashboard.commandFailed : summary.issueTitle,
    issueDetail: commandError ?? summary.issueDetail,
    showIssue: summary.showIssue || Boolean(commandError),
    showStartButton: summary.showStartButton,
    showStopButton: summary.showStopButton,
    startDisabled:
      state.consentPersistenceStatus === "saving" || state.watcherStatus === "starting",
    stopDisabled: state.watcherStatus === "stopping",
    uploadDisabled: isUploadBusy(state.uploadStatus) || state.consentRequired,
  };
}

export function getConsentViewModel(state: AppStateSnapshot): ConsentViewModel {
  const issue = getPermissionPersistenceIssue(state);

  return {
    isSaving: state.consentPersistenceStatus === "saving",
    issueTitle: issue?.title ?? null,
    issueDetail: issue?.detail ?? null,
    showIssue: Boolean(issue),
  };
}

function getDashboardIssue(state: AppStateSnapshot): { title: string; detail: string } | null {
  const copy = getRendererCopy(state.language);
  if (
    state.consentPersistenceStatus === "error" ||
    state.consentPersistenceStatus === "durable-revoke-failed"
  ) {
    return {
      title: copy.dashboard.settingsNotSaved,
      detail: state.consentPersistenceMessage ?? copy.dashboard.settingsNotSavedDetail,
    };
  }

  if (state.lastError) {
    return {
      title: copy.dashboard.actionNeeded,
      detail: state.lastError,
    };
  }

  return null;
}

function getPermissionPersistenceIssue(
  state: AppStateSnapshot,
): { title: string; detail: string } | null {
  const copy = getRendererCopy(state.language);
  if (
    state.consentPersistenceStatus !== "error" &&
    state.consentPersistenceStatus !== "durable-revoke-failed"
  ) {
    return null;
  }

  return {
    title: copy.dashboard.settingsNotSaved,
    detail: state.consentPersistenceMessage ?? copy.dashboard.settingsNotSavedDetail,
  };
}

function getSaveFileName(savePath: string | null): string | null {
  if (!savePath) {
    return null;
  }
  return savePath.split(/[\\/]/).pop() || savePath;
}

function isUploadBusy(uploadStatus: AppStateSnapshot["uploadStatus"]): boolean {
  return (
    uploadStatus === "loading-page" ||
    uploadStatus === "selecting-file" ||
    uploadStatus === "processing"
  );
}
