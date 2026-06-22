// abstract: Renderer-only view selection and user-facing status copy.
// out_of_scope: DOM mutation, Electron IPC, and main-process state mutation.

import type { AppStateSnapshot, UploadStatus, WatcherStatus } from "../shared/state.js";

export type RendererViewMode = "consent" | "dashboard" | "locked";

export type PrimaryStatusTone = "neutral" | "working" | "success" | "warning" | "error";

export type PrimaryStatusCopy = {
  title: string;
  detail: string;
  tone: PrimaryStatusTone;
};

export type DashboardSummary = {
  latestSaveTitle: string;
  lastUpdateTitle: string;
  issueTitle: string | null;
  issueDetail: string | null;
  showIssue: boolean;
  showStartButton: boolean;
  showStopButton: boolean;
};

export type DiagnosticField = {
  label: string;
  value: string;
};

export type DashboardViewModel = {
  primaryStatus: PrimaryStatusCopy;
  watcherStatus: WatcherStatus;
  latestSaveTitle: string;
  lastUpdateTitle: string;
  issueTitle: string | null;
  issueDetail: string | null;
  showIssue: boolean;
  showStartButton: boolean;
  showStopButton: boolean;
  startDisabled: boolean;
  stopDisabled: boolean;
  uploadDisabled: boolean;
  diagnostics: DiagnosticField[];
  logs: AppStateSnapshot["logs"];
};

export type ConsentViewModel = {
  isSaving: boolean;
};

export type LockedViewModel = {
  isSaving: boolean;
  privacyNotice: string;
};

const UPLOAD_STATUS_TITLES: Record<UploadStatus, PrimaryStatusCopy> = {
  idle: {
    title: "Ready",
    detail: "",
    tone: "neutral",
  },
  "needs-consent": {
    title: "Permission required",
    detail: "",
    tone: "warning",
  },
  "loading-page": {
    title: "Opening map page",
    detail: "",
    tone: "working",
  },
  "selecting-file": {
    title: "Selecting save file",
    detail: "",
    tone: "working",
  },
  processing: {
    title: "Uploading latest save",
    detail: "",
    tone: "working",
  },
  success: {
    title: "Map updated",
    detail: "",
    tone: "success",
  },
  error: {
    title: "Upload needs attention",
    detail: "",
    tone: "error",
  },
};

const WATCHER_STATUS_TITLES: Record<WatcherStatus, PrimaryStatusCopy> = {
  starting: {
    title: "Starting watcher",
    detail: "",
    tone: "working",
  },
  running: {
    title: "Waiting for new saves",
    detail: "",
    tone: "neutral",
  },
  stopping: {
    title: "Stopping watcher",
    detail: "",
    tone: "working",
  },
  stopped: {
    title: "Watcher stopped",
    detail: "",
    tone: "neutral",
  },
  error: {
    title: "Watcher needs attention",
    detail: "",
    tone: "error",
  },
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

export function getPrimaryStatusCopy(state: AppStateSnapshot): PrimaryStatusCopy {
  if (state.permissionStatus !== "granted") {
    return state.permissionStatus === "revocation-save-failed"
      ? {
          title: "Permission revoked for this session",
          detail: "",
          tone: "error",
        }
      : {
          title: "Permission required",
          detail: "",
          tone: "warning",
        };
  }

  if (state.uploadStatus !== "idle") {
    return UPLOAD_STATUS_TITLES[state.uploadStatus];
  }
  return WATCHER_STATUS_TITLES[state.watcherStatus];
}

export function getDashboardSummary(state: AppStateSnapshot): DashboardSummary {
  const issue = getDashboardIssue(state);

  return {
    latestSaveTitle: getSaveFileName(state.latestSavePath) ?? "No save selected",
    lastUpdateTitle: getLastUpdateTitle(state),
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
    primaryStatus: getPrimaryStatusCopy(state),
    watcherStatus: state.watcherStatus,
    latestSaveTitle: summary.latestSaveTitle,
    lastUpdateTitle: summary.lastUpdateTitle,
    issueTitle: commandError ? "Command failed" : summary.issueTitle,
    issueDetail: commandError ?? summary.issueDetail,
    showIssue: summary.showIssue || Boolean(commandError),
    showStartButton: summary.showStartButton,
    showStopButton: summary.showStopButton,
    startDisabled:
      state.consentPersistenceStatus === "saving" || state.watcherStatus === "starting",
    stopDisabled: state.watcherStatus === "stopping",
    uploadDisabled: isUploadBusy(state.uploadStatus) || state.consentRequired,
    diagnostics: [
      { label: "Full save directory", value: state.saveRoot ?? "Not resolved" },
      { label: "Selected save path", value: state.latestSavePath ?? "None" },
      { label: "Watcher engine", value: state.watcherStatus },
      { label: "Map automation", value: state.uploadStatus },
      { label: "Started at", value: state.lastUploadStartedAt ?? "Never" },
      { label: "Finished at", value: state.lastUploadFinishedAt ?? "Never" },
      { label: "Outcome", value: state.lastUploadResult ?? "None" },
      {
        label: "Settings save state",
        value: state.consentPersistenceMessage
          ? `${state.consentPersistenceStatus}: ${state.consentPersistenceMessage}`
          : state.consentPersistenceStatus,
      },
      { label: "Current issue", value: state.lastError ?? "None" },
      { label: "Permission note", value: state.privacyNotice ?? "None" },
    ],
    logs: state.logs,
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

function getLastUpdateTitle(state: AppStateSnapshot): string {
  if (state.lastUploadResult === "success") {
    return "Map updated";
  }
  if (state.lastUploadResult === "error") {
    return "Last update failed";
  }
  return "Not updated yet";
}

function getSaveFileName(savePath: string | null): string | null {
  if (!savePath) {
    return null;
  }
  return savePath.split(/[\\/]/).pop() || savePath;
}

function isUploadBusy(uploadStatus: UploadStatus): boolean {
  return (
    uploadStatus === "loading-page" ||
    uploadStatus === "selecting-file" ||
    uploadStatus === "processing"
  );
}
