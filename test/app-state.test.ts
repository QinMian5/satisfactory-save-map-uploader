// abstract: Tests for serializable application state snapshots and bounded logs.
// out_of_scope: Electron IPC, filesystem watching, and map upload automation.

import { describe, expect, it, vi } from "vitest";
import { AppStateStore } from "../src/services/app-state.js";

describe("AppStateStore", () => {
  it("creates a serializable initial snapshot", () => {
    const store = new AppStateStore({ saveRoot: "C:\\Saves" });

    expect(store.getSnapshot()).toMatchObject({
      watcherStatus: "stopped",
      uploadStatus: "idle",
      saveRoot: "C:\\Saves",
      latestSavePath: null,
      lastUploadStartedAt: null,
      lastUploadFinishedAt: null,
      lastUploadResult: null,
      lastError: null,
      consentRequired: true,
      acceptedDisclosureVersion: null,
      currentDisclosureVersion: 1,
      autoStartWatcher: false,
      privacyNotice: null,
      logs: [],
    });
  });

  it("updates subscribers with immutable snapshots", () => {
    const store = new AppStateStore({ saveRoot: "C:\\Saves" });
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.update({ watcherStatus: "running", latestSavePath: "factory.sav" });
    unsubscribe();
    store.update({ watcherStatus: "stopped" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      watcherStatus: "running",
      latestSavePath: "factory.sav",
    });
    expect(store.getSnapshot().watcherStatus).toBe("stopped");
  });

  it("keeps only the newest log entries", () => {
    const now = vi
      .fn<() => Date>()
      .mockReturnValueOnce(new Date("2026-06-20T00:00:00.000Z"))
      .mockReturnValueOnce(new Date("2026-06-20T00:00:01.000Z"))
      .mockReturnValueOnce(new Date("2026-06-20T00:00:02.000Z"));
    const store = new AppStateStore({ saveRoot: "C:\\Saves", maxLogs: 2, now });

    store.addLog("info", "first");
    store.addLog("warn", "second");
    store.addLog("error", "third");

    expect(store.getSnapshot().logs).toEqual([
      {
        level: "warn",
        message: "second",
        timestamp: "2026-06-20T00:00:01.000Z",
      },
      {
        level: "error",
        message: "third",
        timestamp: "2026-06-20T00:00:02.000Z",
      },
    ]);
  });
});
