// abstract: Renderer-only view selection and user-facing status copy.
// out_of_scope: DOM mutation, Electron IPC, and main-process state mutation.

import type { AppStateSnapshot } from "../shared/state.js";

export type RendererViewMode = "consent" | "dashboard" | "locked";

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
};

export type LockedViewModel = {
  isSaving: boolean;
  privacyNotice: string;
};

export function getRendererViewMode(state: AppStateSnapshot): RendererViewMode {
  if (state.permissionStatus === "granted") {
    return "dashboard";
  }
  if (state.permissionStatus === "revoked" || state.permissionStatus === "revocation-save-failed") {
    return "locked";
  }
  return "consent";
}

export function getDashboardSummary(state: AppStateSnapshot): DashboardSummary {
  const issue = getDashboardIssue(state);

  return {
    latestSaveTitle: getSaveFileName(state.latestSavePath) ?? "No save selected",
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
  return {
    latestSaveTitle: summary.latestSaveTitle,
    issueTitle: commandError ? "Command failed" : summary.issueTitle,
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
  return {
    isSaving: state.consentPersistenceStatus === "saving",
  };
}

export function getLockedViewModel(state: AppStateSnapshot): LockedViewModel {
  return {
    isSaving: state.consentPersistenceStatus === "saving",
    privacyNotice:
      state.privacyNotice ??
      "The watcher is stopped and future uploads are blocked. You can allow uploads again or exit the app.",
  };
}

function getDashboardIssue(state: AppStateSnapshot): { title: string; detail: string } | null {
  if (
    state.consentPersistenceStatus === "error" ||
    state.consentPersistenceStatus === "durable-revoke-failed"
  ) {
    return {
      title: "Settings were not saved",
      detail:
        state.consentPersistenceMessage ??
        "The app could not save your permission settings. Retry before closing the app.",
    };
  }

  if (state.lastError) {
    return {
      title: "Action needed",
      detail: state.lastError,
    };
  }

  return null;
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
