// abstract: Tests for renderer view selection and primary status copy.
// out_of_scope: Browser DOM rendering, Electron IPC execution, and visual regression testing.

import { describe, expect, it } from "vitest";
import {
  getConsentViewModel,
  getDashboardSummary,
  getDashboardViewModel,
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
    language: "en",
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

  it("returns to the first-run consent view after revocation", () => {
    expect(getRendererViewMode(state({ permissionStatus: "revoked" }))).toBe("consent");
  });

  it("keeps durable revoke failures on the consent view with a visible issue", () => {
    const revokeFailureState = state({
      consentPersistenceStatus: "durable-revoke-failed",
      consentPersistenceMessage: "Revocation could not be saved for restart.",
      permissionStatus: "revocation-save-failed",
    });

    expect(getRendererViewMode(revokeFailureState)).toBe("consent");
    expect(getConsentViewModel(revokeFailureState)).toEqual({
      isSaving: false,
      issueTitle: "Settings were not saved",
      issueDetail: "Revocation could not be saved for restart.",
      showIssue: true,
    });
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
      issueTitle: null,
      issueDetail: null,
      showIssue: false,
      showStartButton: false,
      showStopButton: true,
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
    });
  });

  it("maps concise user-facing summary fields through the selected language", () => {
    expect(
      getDashboardSummary(
        state({
          permissionStatus: "granted",
          consentRequired: false,
          language: "zh-CN",
        }),
      ),
    ).toMatchObject({
      latestSaveTitle: "未选择存档",
    });

    expect(
      getConsentViewModel(
        state({
          language: "zh-CN",
          consentPersistenceStatus: "error",
          consentPersistenceMessage: "无法保存设置。",
        }),
      ),
    ).toMatchObject({
      issueTitle: "设置未保存",
      issueDetail: "无法保存设置。",
      showIssue: true,
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
      }),
      null,
    );

    expect(model).toMatchObject({
      latestSaveTitle: "World.sav",
      showStartButton: false,
      showStopButton: true,
      stopDisabled: false,
      uploadDisabled: true,
    });
    expect(model).not.toHaveProperty("primaryStatus");
    expect(model).not.toHaveProperty("watcherStatus");
    expect(model).not.toHaveProperty("lastUpdateTitle");
    expect(model).not.toHaveProperty("diagnostics");
    expect(model).not.toHaveProperty("logs");
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

  it("maps consent views to narrow props", () => {
    expect(getConsentViewModel(state({ consentPersistenceStatus: "saving" }))).toEqual({
      isSaving: true,
      issueTitle: null,
      issueDetail: null,
      showIssue: false,
    });
  });
});
