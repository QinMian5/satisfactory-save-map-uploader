// abstract: Tests for third-party upload disclosure authorization and generation guards.
// out_of_scope: Preferences file IO, Electron windows, and renderer UI.

import { describe, expect, it, vi } from "vitest";
import {
  ConsentController,
  ConsentRequiredError,
  CURRENT_DISCLOSURE_VERSION,
} from "../src/services/consent-controller.js";

describe("ConsentController", () => {
  it("requires consent when preferences are missing or disclosure is old", () => {
    const missing = new ConsentController({
      preferences: {
        schemaVersion: 1,
        thirdPartyUploadDisclosureVersion: null,
        autoStartWatcher: false,
        acceptedAt: null,
        language: "en",
      },
    });
    const old = new ConsentController({
      preferences: {
        schemaVersion: 1,
        thirdPartyUploadDisclosureVersion: CURRENT_DISCLOSURE_VERSION - 1,
        autoStartWatcher: true,
        acceptedAt: null,
        language: "en",
      },
    });

    expect(missing.getSnapshot()).toMatchObject({
      consentRequired: true,
      acceptedDisclosureVersion: null,
      autoStartWatcher: false,
    });
    expect(old.getSnapshot()).toMatchObject({
      consentRequired: true,
      acceptedDisclosureVersion: CURRENT_DISCLOSURE_VERSION - 1,
      autoStartWatcher: false,
    });
    expect(() => old.createUploadToken()).toThrow(ConsentRequiredError);
  });

  it("treats a valid revocation marker as higher priority than accepted preferences", () => {
    const controller = new ConsentController({
      preferences: {
        schemaVersion: 1,
        thirdPartyUploadDisclosureVersion: CURRENT_DISCLOSURE_VERSION,
        autoStartWatcher: true,
        acceptedAt: "2026-06-20T00:00:00.000Z",
        language: "en",
      },
      revocation: { revoked: true, warning: null },
    });

    expect(controller.getSnapshot()).toMatchObject({
      consentRequired: true,
      acceptedDisclosureVersion: null,
      autoStartWatcher: false,
    });
    expect(controller.shouldAutoStartWatcher()).toBe(false);
  });

  it("uses the unauthorized safe default when revocation marker state is uncertain", () => {
    const controller = new ConsentController({
      preferences: {
        schemaVersion: 1,
        thirdPartyUploadDisclosureVersion: CURRENT_DISCLOSURE_VERSION,
        autoStartWatcher: true,
        acceptedAt: "2026-06-20T00:00:00.000Z",
        language: "en",
      },
      revocation: { revoked: true, warning: "Could not read revocation marker." },
    });

    expect(() => controller.createUploadToken()).toThrow(ConsentRequiredError);
    expect(controller.getSnapshot()).toMatchObject({
      consentRequired: true,
      acceptedDisclosureVersion: null,
      autoStartWatcher: false,
    });
  });

  it("allows current disclosure preferences and rejects stale generation tokens after revoke", () => {
    const controller = new ConsentController({
      preferences: {
        schemaVersion: 1,
        thirdPartyUploadDisclosureVersion: CURRENT_DISCLOSURE_VERSION,
        autoStartWatcher: true,
        acceptedAt: "2026-06-20T00:00:00.000Z",
        language: "en",
      },
    });

    const token = controller.createUploadToken();
    expect(() => controller.assertUploadAllowed(token)).not.toThrow();

    controller.revokeInMemory();

    expect(controller.getSnapshot()).toMatchObject({
      consentRequired: true,
      acceptedDisclosureVersion: null,
      autoStartWatcher: false,
    });
    expect(() => controller.assertUploadAllowed(token)).toThrow(ConsentRequiredError);
  });

  it("accepts only the current disclosure version from main process state", () => {
    const now = vi.fn().mockReturnValue(new Date("2026-06-20T00:00:00.000Z"));
    const controller = new ConsentController({
      preferences: {
        schemaVersion: 1,
        thirdPartyUploadDisclosureVersion: null,
        autoStartWatcher: false,
        acceptedAt: null,
        language: "en",
      },
      now,
    });

    const accepted = controller.acceptInMemory({ autoStartWatcher: true });

    expect(accepted).toEqual({
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: CURRENT_DISCLOSURE_VERSION,
      autoStartWatcher: true,
      acceptedAt: "2026-06-20T00:00:00.000Z",
      language: "en",
    });
    expect(controller.getSnapshot().consentRequired).toBe(false);
  });
});
