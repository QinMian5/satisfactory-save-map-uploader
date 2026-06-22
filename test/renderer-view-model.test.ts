// abstract: Tests for renderer view selection and primary status copy.
// out_of_scope: Browser DOM rendering, Electron IPC execution, and visual regression testing.

import { describe, expect, it } from "vitest";
import {
  getConsentViewModel,
  getDashboardSummary,
  getDashboardViewModel,
  getLockedViewModel,
  getPrimaryStatusCopy,
  getRendererViewMode,
} from "../src/renderer/view-model.js";
import type { AppStateSnapshot } from "../src/shared/state.js";

function state(patch: Partial<AppStateSnapshot> = {}): AppStateSnapshot {
  return {
    watcherStatus: "stopped",
    uploadStatus: "idle",
    saveRoot: null,
    latestSavePath: null,
    lastUploadStartedAt: null,
    lastUploadFinishedAt: null,
    lastUploadResult: null,
    lastError: null,
    consentRequired: true,
    acceptedDisclosureVersion: null,
    currentDisclosureVersion: 1,
    autoStartWatcher: false,
    consentPersistenceStatus: "idle",
    consentPersistenceMessage: null,
    privacyNotice: null,
    permissionStatus: "not-granted",
    logs: [],
    ...patch,
  };
}

describe("renderer view model", () => {
  it("shows only the consent gate before third-party upload permission is granted", () => {
    expect(getRendererViewMode(state({ permissionStatus: "not-granted" }))).toBe("consent");
  });

  it("shows the dashboard only after permission is granted", () => {
    expect(
      getRendererViewMode(
        state({
          consentRequired: false,
          acceptedDisclosureVersion: 1,
          permissionStatus: "granted",
        }),
      ),
    ).toBe("dashboard");
  });

  it("shows a locked permission view after revocation or failed durable revocation", () => {
    expect(getRendererViewMode(state({ permissionStatus: "revoked" }))).toBe("locked");
    expect(getRendererViewMode(state({ permissionStatus: "revocation-save-failed" }))).toBe(
      "locked",
    );
  });

  it("summarizes noisy watcher and upload states into a primary user-facing status", () => {
    expect(
      getPrimaryStatusCopy(
        state({
          watcherStatus: "running",
          uploadStatus: "idle",
          permissionStatus: "granted",
          consentRequired: false,
        }),
      ),
    ).toMatchObject({
      title: "Waiting for new saves",
      detail: "",
      tone: "neutral",
    });
    expect(
      getPrimaryStatusCopy(
        state({
          uploadStatus: "processing",
          permissionStatus: "granted",
          consentRequired: false,
        }),
      ),
    ).toMatchObject({
      title: "Uploading latest save",
      detail: "",
      tone: "working",
    });
  });

  it("does not show explanatory detail text in the primary status card", () => {
    const uploadStates: AppStateSnapshot["uploadStatus"][] = [
      "idle",
      "needs-consent",
      "loading-page",
      "selecting-file",
      "processing",
      "success",
      "error",
    ];
    const watcherStates: AppStateSnapshot["watcherStatus"][] = [
      "starting",
      "running",
      "stopping",
      "stopped",
      "error",
    ];

    for (const uploadStatus of uploadStates) {
      expect(
        getPrimaryStatusCopy(
          state({
            uploadStatus,
            permissionStatus: "granted",
            consentRequired: false,
          }),
        ).detail,
      ).toBe("");
    }

    for (const watcherStatus of watcherStates) {
      expect(
        getPrimaryStatusCopy(
          state({
            watcherStatus,
            uploadStatus: "idle",
            permissionStatus: "granted",
            consentRequired: false,
          }),
        ).detail,
      ).toBe("");
    }

    expect(getPrimaryStatusCopy(state({ permissionStatus: "not-granted" })).detail).toBe("");
    expect(getPrimaryStatusCopy(state({ permissionStatus: "revocation-save-failed" })).detail).toBe(
      "",
    );
  });

  it("maps dashboard state to concise user-facing summary fields", () => {
    expect(
      getDashboardSummary(
        state({
          watcherStatus: "running",
          uploadStatus: "idle",
          permissionStatus: "granted",
          consentRequired: false,
          saveRoot: "C:\\Users\\tester\\AppData\\Local\\FactoryGame\\Saved\\SaveGames",
          latestSavePath:
            "C:\\Users\\tester\\AppData\\Local\\FactoryGame\\Saved\\SaveGames\\123\\Factory.sav",
          lastUploadFinishedAt: "2026-06-21T12:34:56.000Z",
          lastUploadResult: "success",
        }),
      ),
    ).toEqual({
      latestSaveTitle: "Factory.sav",
      lastUpdateTitle: "Map updated",
      issueTitle: null,
      issueDetail: null,
      showIssue: false,
      showStartButton: false,
      showStopButton: true,
    });
  });

  it("keeps primary error copy short because the issue banner carries details", () => {
    expect(
      getPrimaryStatusCopy(
        state({
          uploadStatus: "error",
          permissionStatus: "granted",
          consentRequired: false,
        }),
      ),
    ).toMatchObject({
      title: "Upload needs attention",
      detail: "",
      tone: "error",
    });
  });

  it("does not show placeholder guidance in summary titles", () => {
    expect(
      getDashboardSummary(
        state({
          permissionStatus: "granted",
          consentRequired: false,
        }),
      ),
    ).toMatchObject({
      latestSaveTitle: "No save selected",
      lastUpdateTitle: "Not updated yet",
    });
  });

  it("shows dashboard issues only when user action is needed", () => {
    expect(
      getDashboardSummary(
        state({
          permissionStatus: "granted",
          consentRequired: false,
          lastError: "Map page did not finish processing the save.",
        }),
      ),
    ).toMatchObject({
      issueTitle: "Action needed",
      issueDetail: "Map page did not finish processing the save.",
      showIssue: true,
    });

    expect(
      getDashboardSummary(
        state({
          permissionStatus: "granted",
          consentRequired: false,
          consentPersistenceStatus: "error",
          consentPersistenceMessage: "Could not save preferences.",
        }),
      ),
    ).toMatchObject({
      issueTitle: "Settings were not saved",
      issueDetail: "Could not save preferences.",
      showIssue: true,
    });
  });

  it("maps dashboard state to a narrow view model for presentational components", () => {
    const model = getDashboardViewModel(
      state({
        watcherStatus: "running",
        uploadStatus: "processing",
        permissionStatus: "granted",
        consentRequired: false,
        latestSavePath: "C:\\Factory\\World.sav",
        logs: [{ timestamp: "2026-06-21T12:00:00.000Z", level: "info", message: "Started" }],
      }),
      null,
    );

    expect(model).toMatchObject({
      latestSaveTitle: "World.sav",
      lastUpdateTitle: "Not updated yet",
      showStartButton: false,
      showStopButton: true,
      stopDisabled: false,
      uploadDisabled: true,
    });
    expect(model.diagnostics.map((field) => field.label)).toContain("Full save directory");
    expect(model.logs).toHaveLength(1);
  });

  it("maps command errors into the dashboard issue banner", () => {
    expect(
      getDashboardViewModel(
        state({
          permissionStatus: "granted",
          consentRequired: false,
        }),
        "Manual upload failed.",
      ),
    ).toMatchObject({
      issueTitle: "Command failed",
      issueDetail: "Manual upload failed.",
      showIssue: true,
    });
  });

  it("maps consent and locked views to narrow props", () => {
    expect(getConsentViewModel(state({ consentPersistenceStatus: "saving" }))).toEqual({
      isSaving: true,
    });
    expect(getLockedViewModel(state({ privacyNotice: "Revoked in this session." }))).toEqual({
      isSaving: false,
      privacyNotice: "Revoked in this session.",
    });
  });
});
