// abstract: Third-party upload disclosure consent state and generation guard.
// out_of_scope: Preferences file IO, Electron IPC, and save watcher orchestration.

import type { AppLanguage } from "../shared/state.js";
import type { UserPreferences } from "./preferences.js";

export const CURRENT_DISCLOSURE_VERSION = 1;

export type UploadConsentToken = {
  generation: number;
};

export type ConsentSnapshot = {
  consentRequired: boolean;
  acceptedDisclosureVersion: number | null;
  currentDisclosureVersion: number;
  autoStartWatcher: boolean;
  language: AppLanguage;
};

export type UploadAuthorizationPort = {
  createUploadToken: () => UploadConsentToken;
  assertUploadAllowed: (token: UploadConsentToken) => void;
};

type ConsentControllerOptions = {
  preferences: UserPreferences;
  revocation?: {
    revoked: boolean;
    warning: string | null;
  };
  now?: () => Date;
};

export class ConsentRequiredError extends Error {
  constructor(message = "Third-party upload permission is required.") {
    super(message);
    this.name = "ConsentRequiredError";
  }
}

export class ConsentController implements UploadAuthorizationPort {
  private acceptedDisclosureVersion: number | null;
  private autoStartWatcher: boolean;
  private language: AppLanguage;
  private generation = 0;
  private readonly now: () => Date;

  constructor(options: ConsentControllerOptions) {
    if (options.revocation?.revoked) {
      this.acceptedDisclosureVersion = null;
      this.autoStartWatcher = false;
    } else {
      this.acceptedDisclosureVersion = options.preferences.thirdPartyUploadDisclosureVersion;
      this.autoStartWatcher = false;
    }
    this.language = options.preferences.language;
    this.now = options.now ?? (() => new Date());
  }

  getSnapshot(): ConsentSnapshot {
    return {
      consentRequired: !this.hasCurrentConsent(),
      acceptedDisclosureVersion: this.acceptedDisclosureVersion,
      currentDisclosureVersion: CURRENT_DISCLOSURE_VERSION,
      autoStartWatcher: this.autoStartWatcher,
      language: this.language,
    };
  }

  shouldAutoStartWatcher(): boolean {
    return this.hasCurrentConsent() && this.autoStartWatcher;
  }

  acceptInMemory(options: { autoStartWatcher: boolean }): UserPreferences {
    this.acceptedDisclosureVersion = CURRENT_DISCLOSURE_VERSION;
    this.autoStartWatcher = options.autoStartWatcher;
    this.generation += 1;
    return this.toPreferences(this.now().toISOString());
  }

  createAcceptedPreferences(options: { autoStartWatcher: boolean }): UserPreferences {
    return {
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: CURRENT_DISCLOSURE_VERSION,
      autoStartWatcher: options.autoStartWatcher,
      acceptedAt: this.now().toISOString(),
      language: this.language,
    };
  }

  setAutoStartWatcher(autoStartWatcher: boolean): UserPreferences {
    this.autoStartWatcher = autoStartWatcher;
    this.generation += 1;
    return this.toPreferences(this.hasCurrentConsent() ? this.now().toISOString() : null);
  }

  createAutoStartPreferences(autoStartWatcher: boolean): UserPreferences {
    return {
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: this.acceptedDisclosureVersion,
      autoStartWatcher,
      acceptedAt: this.hasCurrentConsent() ? this.now().toISOString() : null,
      language: this.language,
    };
  }

  createLanguagePreferences(language: AppLanguage): UserPreferences {
    return {
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: this.acceptedDisclosureVersion,
      autoStartWatcher: this.autoStartWatcher,
      acceptedAt: this.hasCurrentConsent() ? this.now().toISOString() : null,
      language,
    };
  }

  setLanguageInMemory(language: AppLanguage): UserPreferences {
    this.language = language;
    return this.toPreferences(this.hasCurrentConsent() ? this.now().toISOString() : null);
  }

  revokeInMemory(): UserPreferences {
    this.acceptedDisclosureVersion = null;
    this.autoStartWatcher = false;
    this.generation += 1;
    return this.toPreferences(null);
  }

  getGeneration(): number {
    return this.generation;
  }

  createUploadToken(): UploadConsentToken {
    this.assertCurrentConsent();
    return { generation: this.generation };
  }

  assertUploadAllowed(token: UploadConsentToken): void {
    this.assertCurrentConsent();
    if (token.generation !== this.generation) {
      throw new ConsentRequiredError("Third-party upload permission was revoked.");
    }
  }

  private hasCurrentConsent(): boolean {
    return this.acceptedDisclosureVersion === CURRENT_DISCLOSURE_VERSION;
  }

  private assertCurrentConsent(): void {
    if (!this.hasCurrentConsent()) {
      throw new ConsentRequiredError();
    }
  }

  private toPreferences(acceptedAt: string | null): UserPreferences {
    return {
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: this.acceptedDisclosureVersion,
      autoStartWatcher: this.autoStartWatcher,
      acceptedAt,
      language: this.language,
    };
  }
}
