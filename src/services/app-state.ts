// abstract: Mutable application state store with serializable snapshots and bounded logs.
// out_of_scope: Electron IPC transport, filesystem watching, and map upload automation.

import type {
  AppLanguage,
  AppLogEntry,
  AppStateSnapshot,
  LogLevel,
  ThirdPartyUploadPermissionStatus,
} from "../shared/state.js";
import { DEFAULT_APP_LANGUAGE } from "../shared/state.js";

type AppStateStoreOptions = {
  saveRoot: string | null;
  consentRequired?: boolean;
  permissionStatus?: ThirdPartyUploadPermissionStatus;
  acceptedDisclosureVersion?: number | null;
  currentDisclosureVersion?: number;
  autoStartWatcher?: boolean;
  language?: AppLanguage;
  maxLogs?: number;
  now?: () => Date;
};

type StateListener = (snapshot: AppStateSnapshot) => void;

const DEFAULT_MAX_LOGS = 100;
const MAX_LOG_MESSAGE_LENGTH = 2_000;

export class AppStateStore {
  private readonly maxLogs: number;
  private readonly now: () => Date;
  private readonly listeners = new Set<StateListener>();
  private snapshot: AppStateSnapshot;

  constructor(options: AppStateStoreOptions) {
    this.maxLogs = options.maxLogs ?? DEFAULT_MAX_LOGS;
    this.now = options.now ?? (() => new Date());
    this.snapshot = {
      watcherStatus: "stopped",
      uploadStatus: "idle",
      saveRoot: options.saveRoot,
      latestSavePath: null,
      lastUploadStartedAt: null,
      lastUploadFinishedAt: null,
      lastUploadResult: null,
      lastError: null,
      consentRequired: options.consentRequired ?? true,
      permissionStatus:
        options.permissionStatus ?? ((options.consentRequired ?? true) ? "not-granted" : "granted"),
      acceptedDisclosureVersion: options.acceptedDisclosureVersion ?? null,
      currentDisclosureVersion: options.currentDisclosureVersion ?? 1,
      autoStartWatcher: options.autoStartWatcher ?? false,
      consentPersistenceStatus: "idle",
      consentPersistenceMessage: null,
      language: options.language ?? DEFAULT_APP_LANGUAGE,
      privacyNotice: null,
      logs: [],
    };
  }

  getSnapshot(): AppStateSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(patch: Partial<AppStateSnapshot>): AppStateSnapshot {
    this.snapshot = cloneSnapshot({
      ...this.snapshot,
      ...patch,
      logs: patch.logs ?? this.snapshot.logs,
    });
    this.emit();
    return this.getSnapshot();
  }

  addLog(level: LogLevel, message: string): AppStateSnapshot {
    const entry: AppLogEntry = {
      timestamp: this.now().toISOString(),
      level,
      message: truncateLogMessage(message),
    };
    const logs = [...this.snapshot.logs, entry].slice(-this.maxLogs);
    return this.update({ logs });
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

function truncateLogMessage(message: string): string {
  if (message.length <= MAX_LOG_MESSAGE_LENGTH) {
    return message;
  }
  return `${message.slice(0, MAX_LOG_MESSAGE_LENGTH)}...`;
}

function cloneSnapshot(snapshot: AppStateSnapshot): AppStateSnapshot {
  return {
    ...snapshot,
    logs: snapshot.logs.map((entry) => ({ ...entry })),
  };
}
