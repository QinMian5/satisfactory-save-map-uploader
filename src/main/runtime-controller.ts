// abstract: Main-process orchestration for consent, watcher lifecycle, and upload commands.
// out_of_scope: Electron app bootstrapping, renderer DOM, and preferences JSON validation.

import type { AppStateStore } from "../services/app-state.js";
import {
  type ConsentController,
  ConsentRequiredError,
  type UploadAuthorizationPort,
} from "../services/consent-controller.js";
import type { UserPreferences } from "../services/preferences.js";
import { type SaveUploadPort, SaveWatcherService } from "../services/save-watcher.js";
import type { AppStateSnapshot, DisclosureSnapshot } from "../shared/state.js";

type PreferencesWriter = {
  save: (preferences: UserPreferences) => Promise<void>;
};

type RevocationMarkerWriter = {
  markRevoked: () => Promise<void>;
  clearAndConfirmAbsent: () => Promise<void>;
};

type RevocationPreparation = {
  fileProvided: boolean;
  cleanup: () => Promise<void>;
};

type RuntimeWatcherPort = Pick<
  SaveWatcherService,
  "start" | "stop" | "uploadLatestSave" | "openMap" | "close" | "prepareForRevocation"
>;

type RuntimeControllerOptions = {
  state: AppStateStore;
  consent: ConsentController;
  preferences: PreferencesWriter;
  revocationMarker: RevocationMarkerWriter;
  resolveSaveRoot: () => string;
  createUploader: (authorization: UploadAuthorizationPort) => SaveUploadPort;
  quitApp?: () => void;
  createWatcher?: (options: {
    saveRoot: string;
    state: AppStateStore;
    uploader: SaveUploadPort;
    authorization: UploadAuthorizationPort;
  }) => RuntimeWatcherPort;
};

export class AppRuntimeController {
  private readonly state: AppStateStore;
  private readonly consent: ConsentController;
  private readonly preferences: PreferencesWriter;
  private readonly revocationMarker: RevocationMarkerWriter;
  private readonly resolveSaveRoot: () => string;
  private readonly createUploader: (authorization: UploadAuthorizationPort) => SaveUploadPort;
  private readonly quitApp: () => void;
  private readonly createWatcher: NonNullable<RuntimeControllerOptions["createWatcher"]>;
  private watcher: RuntimeWatcherPort | undefined;
  private uploader: SaveUploadPort | undefined;
  private commandQueue: Promise<void> = Promise.resolve();
  private consentMutationQueue: Promise<void> = Promise.resolve();
  private consentIntentId = 0;
  private closed = false;

  constructor(options: RuntimeControllerOptions) {
    this.state = options.state;
    this.consent = options.consent;
    this.preferences = options.preferences;
    this.revocationMarker = options.revocationMarker;
    this.resolveSaveRoot = options.resolveSaveRoot;
    this.createUploader = options.createUploader;
    this.quitApp = options.quitApp ?? (() => undefined);
    this.createWatcher =
      options.createWatcher ??
      ((watcherOptions) =>
        new SaveWatcherService({
          saveRoot: watcherOptions.saveRoot,
          state: watcherOptions.state,
          uploader: watcherOptions.uploader,
          authorization: watcherOptions.authorization,
        }));
    this.syncConsentState();
  }

  async startAfterLaunch(): Promise<AppStateSnapshot> {
    if (!this.requireConsent()) {
      this.syncConsentState();
      return this.state.getSnapshot();
    }
    await this.openMapInternal();
    this.syncConsentState();
    return this.state.getSnapshot();
  }

  async getDisclosure(): Promise<DisclosureSnapshot> {
    return this.snapshotDisclosure();
  }

  async acceptThirdPartyUpload(): Promise<AppStateSnapshot> {
    const intent = this.createConsentIntent();
    return this.runConsentMutation(async () => {
      if (!this.isCurrentConsentIntent(intent)) {
        return;
      }
      const preferences = this.consent.createAcceptedPreferences({ autoStartWatcher: false });
      this.syncConsentState({
        consentPersistenceStatus: "saving",
        consentPersistenceMessage: "Saving third-party upload permission.",
        privacyNotice: "Saving third-party upload permission.",
      });
      try {
        await this.preferences.save(preferences);
        if (!this.isCurrentConsentIntent(intent)) {
          return;
        }
        await this.revocationMarker.clearAndConfirmAbsent();
        if (!this.isCurrentConsentIntent(intent)) {
          return;
        }
      } catch (error) {
        this.reportConsentPersistenceError(
          "Third-party upload permission could not be saved.",
          error,
        );
        return;
      }
      this.consent.acceptInMemory({ autoStartWatcher: false });
      this.syncConsentState({
        consentPersistenceStatus: "saved",
        consentPersistenceMessage: "Third-party upload permission saved.",
        privacyNotice:
          "Third-party upload permission is saved. Start watching when you are ready to upload saves.",
        lastError: null,
      });
      await this.openMapInternal();
    });
  }

  async declineThirdPartyUpload(): Promise<AppStateSnapshot> {
    this.syncConsentState({
      uploadStatus: "needs-consent",
      permissionStatus: "not-granted",
      privacyNotice:
        "Third-party upload permission was not granted. The app will exit without scanning saves.",
    });
    this.quitApp();
    return this.state.getSnapshot();
  }

  async revokeThirdPartyUpload(): Promise<AppStateSnapshot> {
    const intent = this.createConsentIntent();
    const revokedPreferences = this.consent.revokeInMemory();
    this.syncConsentState({
      uploadStatus: "needs-consent",
      permissionStatus: "revoked",
      autoStartWatcher: false,
      consentPersistenceStatus: "saving",
      consentPersistenceMessage: "Revoking third-party upload permission.",
      privacyNotice: "Revoking third-party upload permission.",
    });
    const cancellation = await this.prepareWatcherForRevocation();

    return this.runConsentMutation(async () => {
      if (!this.isCurrentConsentIntent(intent)) {
        await cancellation.cleanup();
        return;
      }

      let markerSaved = false;
      let preferencesSaved = false;
      let markerError: unknown;
      let preferencesError: unknown;

      try {
        await this.revocationMarker.markRevoked();
        markerSaved = true;
      } catch (error) {
        markerError = error;
      }

      await cancellation.cleanup();

      if (!this.isCurrentConsentIntent(intent)) {
        return;
      }

      try {
        await this.preferences.save(revokedPreferences);
      } catch (error) {
        preferencesError = error;
      }

      preferencesSaved = !preferencesError;

      if (!this.isCurrentConsentIntent(intent)) {
        return;
      }

      this.reportRevocationPersistenceResult({
        fileProvided: cancellation.fileProvided,
        markerSaved,
        preferencesSaved,
        markerError,
        preferencesError,
      });
    });
  }

  private reportRevocationPersistenceResult(options: {
    fileProvided: boolean;
    markerSaved: boolean;
    preferencesSaved: boolean;
    markerError: unknown;
    preferencesError: unknown;
  }): void {
    const durable = options.markerSaved || options.preferencesSaved;
    const baseNotice = options.fileProvided
      ? "Third-party upload permission was revoked. The current file may already have been provided to the third-party page; future uploads are blocked."
      : "Third-party upload permission was revoked. Pending upload was cancelled before a file was provided.";

    if (durable) {
      const warning = options.preferencesError ?? options.markerError;
      this.state.update({
        latestSavePath: null,
        lastUploadResult: "error",
        lastError: warning ? errorMessage(warning) : null,
        permissionStatus: "revoked",
        consentPersistenceStatus: "saved",
        consentPersistenceMessage: "Revocation is saved for future restarts.",
        privacyNotice: `${baseNotice} This app will remain revoked after restart.`,
      });
      if (warning) {
        this.state.addLog("warn", errorMessage(warning));
      }
      return;
    }

    const failure = [
      options.markerError ? errorMessage(options.markerError) : null,
      options.preferencesError ? errorMessage(options.preferencesError) : null,
    ]
      .filter(Boolean)
      .join(" ");
    this.state.update({
      latestSavePath: null,
      lastUploadResult: "error",
      lastError: failure || "Revocation could not be persisted.",
      permissionStatus: "revocation-save-failed",
      consentPersistenceStatus: "durable-revoke-failed",
      consentPersistenceMessage:
        "Revocation is active for this session, but could not be saved for restart.",
      privacyNotice: `${baseNotice} Revocation is active for this session, but the app cannot guarantee it will remain revoked after restart. Retry revoke before exiting.`,
    });
    this.state.addLog("error", failure || "Revocation could not be persisted.");
  }

  async startWatcher(): Promise<AppStateSnapshot> {
    return this.runExclusive(async () => {
      await this.startWatcherInternal({ persistAutoStart: false });
    });
  }

  async stopWatcher(): Promise<AppStateSnapshot> {
    return this.runExclusive(async () => {
      if (this.consent.getSnapshot().acceptedDisclosureVersion !== null) {
        const preferences = this.consent.setAutoStartWatcher(false);
        try {
          await this.preferences.save(preferences);
        } catch (error) {
          this.reportPreferenceError(error);
        }
      }
      await this.watcher?.stop();
      this.syncConsentState();
    });
  }

  async uploadLatestSave(): Promise<AppStateSnapshot> {
    return this.runExclusive(async () => {
      if (!this.requireConsent()) {
        return;
      }
      await this.getOrCreateWatcher().uploadLatestSave();
    });
  }

  async openMap(): Promise<AppStateSnapshot> {
    return this.runExclusive(async () => {
      if (!this.requireConsent()) {
        return;
      }
      await this.openMapInternal();
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.closeWatcher();
  }

  private async startWatcherInternal(options: { persistAutoStart: boolean }): Promise<void> {
    if (!this.requireConsent()) {
      return;
    }
    if (options.persistAutoStart) {
      const preferences = this.consent.createAutoStartPreferences(true);
      try {
        await this.preferences.save(preferences);
      } catch (error) {
        this.reportPreferenceError(error);
        return;
      }
      this.consent.setAutoStartWatcher(true);
      this.syncConsentState({ lastError: null });
    }
    await this.getOrCreateWatcher().start();
  }

  private getOrCreateWatcher(): RuntimeWatcherPort {
    if (this.watcher) {
      return this.watcher;
    }
    const saveRoot = this.resolveSaveRoot();
    this.state.update({ saveRoot });
    const uploader = this.getOrCreateUploader();
    this.watcher = this.createWatcher({
      saveRoot,
      state: this.state,
      uploader,
      authorization: this.consent,
    });
    return this.watcher;
  }

  private getOrCreateUploader(): SaveUploadPort {
    if (!this.uploader) {
      this.uploader = this.createUploader(this.consent);
    }
    return this.uploader;
  }

  private async openMapInternal(): Promise<void> {
    try {
      await this.getOrCreateUploader().openMap();
    } catch (error) {
      const message = errorMessage(error);
      this.state.update({
        uploadStatus: "error",
        lastUploadResult: "error",
        lastError: message,
      });
      this.state.addLog("error", message);
    }
  }

  private async closeWatcher(): Promise<{ fileProvided: boolean }> {
    const watcher = this.watcher;
    this.watcher = undefined;
    if (!watcher) {
      this.state.update({ watcherStatus: "stopped" });
      return this.closeUploader();
    }
    const result = await watcher.close();
    this.uploader = undefined;
    return result;
  }

  private async prepareWatcherForRevocation(): Promise<RevocationPreparation> {
    const watcher = this.watcher;
    this.watcher = undefined;
    if (!watcher) {
      this.state.update({ watcherStatus: "stopped" });
      const uploader = this.uploader;
      this.uploader = undefined;
      const status = uploader?.getActiveUploadStatus?.() ?? { fileProvided: false };
      uploader?.abortActiveUpload?.();
      return {
        fileProvided: status.fileProvided,
        cleanup: async () => {
          await uploader?.close();
        },
      };
    }
    this.uploader = undefined;
    return watcher.prepareForRevocation();
  }

  private async closeUploader(): Promise<{ fileProvided: boolean }> {
    const uploader = this.uploader;
    this.uploader = undefined;
    const result = await uploader?.close();
    return result ?? { fileProvided: false };
  }

  private requireConsent(): boolean {
    try {
      this.consent.createUploadToken();
      return true;
    } catch (error) {
      if (error instanceof ConsentRequiredError || error instanceof Error) {
        this.state.update({
          consentRequired: true,
          permissionStatus: this.unauthorizedPermissionStatus(),
          uploadStatus: "needs-consent",
          lastError: error.message,
          privacyNotice:
            "Third-party upload permission is required before scanning saves or opening the map.",
        });
        this.state.addLog("warn", error.message);
      }
      return false;
    }
  }

  private syncConsentState(patch: Partial<AppStateSnapshot> = {}): void {
    const consent = this.consent.getSnapshot();
    this.state.update({
      consentRequired: consent.consentRequired,
      permissionStatus:
        patch.permissionStatus ??
        (consent.consentRequired ? this.unauthorizedPermissionStatus() : "granted"),
      acceptedDisclosureVersion: consent.acceptedDisclosureVersion,
      currentDisclosureVersion: consent.currentDisclosureVersion,
      autoStartWatcher: consent.autoStartWatcher,
      ...patch,
    });
  }

  private snapshotDisclosure(): DisclosureSnapshot {
    const snapshot = this.state.getSnapshot();
    return {
      consentRequired: snapshot.consentRequired,
      permissionStatus: snapshot.permissionStatus,
      acceptedDisclosureVersion: snapshot.acceptedDisclosureVersion,
      currentDisclosureVersion: snapshot.currentDisclosureVersion,
      autoStartWatcher: snapshot.autoStartWatcher,
      privacyNotice: snapshot.privacyNotice,
    };
  }

  private reportPreferenceError(error: unknown): void {
    const message = errorMessage(error);
    this.syncConsentState({
      permissionStatus: this.unauthorizedPermissionStatus(),
      consentPersistenceStatus: "error",
      consentPersistenceMessage: message,
      lastError: message,
      privacyNotice: `Preferences could not be saved: ${message}`,
    });
    this.state.addLog("error", message);
  }

  private reportConsentPersistenceError(prefix: string, error: unknown): void {
    const message = errorMessage(error);
    this.syncConsentState({
      permissionStatus: this.unauthorizedPermissionStatus(),
      consentPersistenceStatus: "error",
      consentPersistenceMessage: `${prefix} ${message}`,
      lastError: message,
      privacyNotice: `${prefix} ${message}`,
    });
    this.state.addLog("error", message);
  }

  private async runExclusive(operation: () => Promise<void>): Promise<AppStateSnapshot> {
    const run = this.commandQueue.then(async () => {
      if (!this.closed) {
        await operation();
      }
    });
    this.commandQueue = run.catch(() => undefined);
    await run;
    return this.state.getSnapshot();
  }

  private createConsentIntent(): number {
    this.consentIntentId += 1;
    return this.consentIntentId;
  }

  private isCurrentConsentIntent(intent: number): boolean {
    return intent === this.consentIntentId;
  }

  private async runConsentMutation(operation: () => Promise<void>): Promise<AppStateSnapshot> {
    const run = this.consentMutationQueue.then(async () => {
      if (!this.closed) {
        await operation();
      }
    });
    this.consentMutationQueue = run.catch(() => undefined);
    await run;
    return this.state.getSnapshot();
  }

  private unauthorizedPermissionStatus(): AppStateSnapshot["permissionStatus"] {
    const current = this.state.getSnapshot().permissionStatus;
    return current === "revoked" || current === "revocation-save-failed" ? current : "not-granted";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
