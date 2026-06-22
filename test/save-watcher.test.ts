// abstract: Tests for watcher lifecycle, debounce, and serial upload behavior.
// out_of_scope: Real filesystem watching, Electron windows, and third-party map behavior.

import { afterEach, describe, expect, it, vi } from "vitest";
import { AppStateStore } from "../src/services/app-state.js";
import { SaveWatcherService, type WatchCallback } from "../src/services/save-watcher.js";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SaveWatcherService", () => {
  it("does not scan or upload when the authorization guard rejects startup upload", async () => {
    const findLatestSave = vi.fn().mockResolvedValue("latest.sav");
    const upload = vi.fn().mockResolvedValue(undefined);
    const state = new AppStateStore({ saveRoot: "C:\\Saves" });
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state,
      exists: () => true,
      findLatestSave,
      watch: vi.fn((_root, _options, _next) => ({ close: vi.fn() })),
      uploader: { upload, openMap: vi.fn(), close: vi.fn() },
      debounceMs: 2_000,
      authorization: {
        createUploadToken: () => {
          throw new Error("Third-party upload permission is required.");
        },
        assertUploadAllowed: () => {
          throw new Error("Third-party upload permission is required.");
        },
      },
    });

    await service.start();

    expect(findLatestSave).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(state.getSnapshot()).toMatchObject({
      uploadStatus: "needs-consent",
      lastError: "Third-party upload permission is required.",
    });
  });

  it("starts and stops idempotently", async () => {
    let callback: WatchCallback | undefined;
    const close = vi.fn();
    const state = new AppStateStore({ saveRoot: "C:\\Saves" });
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state,
      exists: () => true,
      findLatestSave: async () => null,
      watch: (_root, _options, next) => {
        callback = next;
        return { close };
      },
      uploader: { upload: vi.fn(), openMap: vi.fn(), close: vi.fn() },
      debounceMs: 2_000,
    });

    await service.start();
    await service.start();
    expect(callback).toBeDefined();
    expect(state.getSnapshot().watcherStatus).toBe("running");

    await service.stop();
    await service.stop();

    expect(close).toHaveBeenCalledTimes(1);
    expect(state.getSnapshot().watcherStatus).toBe("stopped");
  });

  it("reports map open failures without throwing", async () => {
    const state = new AppStateStore({ saveRoot: "C:\\Saves" });
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state,
      exists: () => true,
      findLatestSave: async () => null,
      watch: vi.fn((_root, _options, _next) => ({ close: vi.fn() })),
      uploader: {
        upload: vi.fn(),
        openMap: vi.fn().mockRejectedValue(new Error("map unavailable")),
        close: vi.fn(),
      },
      debounceMs: 2_000,
    });

    await expect(service.openMap()).resolves.toBeUndefined();

    expect(state.getSnapshot()).toMatchObject({
      uploadStatus: "error",
      lastError: "map unavailable",
    });
  });

  it("reports a missing save directory without throwing", async () => {
    const state = new AppStateStore({ saveRoot: "C:\\Missing" });
    const service = new SaveWatcherService({
      saveRoot: "C:\\Missing",
      state,
      exists: () => false,
      findLatestSave: async () => null,
      watch: vi.fn(),
      uploader: { upload: vi.fn(), openMap: vi.fn(), close: vi.fn() },
      debounceMs: 2_000,
    });

    await service.start();

    expect(state.getSnapshot()).toMatchObject({
      watcherStatus: "error",
      lastError: "Save directory not found: C:\\Missing",
    });
  });

  it("debounces rapid save change events", async () => {
    vi.useFakeTimers();
    let callback!: WatchCallback;
    const upload = vi.fn().mockResolvedValue(undefined);
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state: new AppStateStore({ saveRoot: "C:\\Saves" }),
      exists: () => true,
      findLatestSave: async () => "latest.sav",
      watch: (_root, _options, next) => {
        callback = next;
        return { close: vi.fn() };
      },
      uploader: { upload, openMap: vi.fn(), close: vi.fn() },
      debounceMs: 2_000,
      uploadOnStart: false,
    });

    await service.start();
    callback("change", "a.sav");
    callback("change", "b.sav");
    callback("change", "c.sav");

    await vi.advanceTimersByTimeAsync(1_999);
    expect(upload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith("latest.sav", undefined);
  });

  it("serializes uploads and processes the latest save after a concurrent change", async () => {
    vi.useFakeTimers();
    const first = createDeferred();
    let latestSave = "first.sav";
    let callback!: WatchCallback;
    const uploaded: string[] = [];
    const upload = vi.fn(async (savePath: string) => {
      uploaded.push(savePath);
      if (savePath === "first.sav") {
        await first.promise;
      }
    });
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state: new AppStateStore({ saveRoot: "C:\\Saves" }),
      exists: () => true,
      findLatestSave: async () => latestSave,
      watch: (_root, _options, next) => {
        callback = next;
        return { close: vi.fn() };
      },
      uploader: { upload, openMap: vi.fn(), close: vi.fn() },
      debounceMs: 2_000,
    });

    await service.start();
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    latestSave = "second.sav";
    callback("change", "second.sav");
    await vi.advanceTimersByTimeAsync(2_000);

    expect(uploaded).toEqual(["first.sav"]);
    first.resolve();
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(2));

    expect(uploaded).toEqual(["first.sav", "second.sav"]);
  });

  it("logs the first watcher upload as an initial scan instead of an app startup scan", async () => {
    const state = new AppStateStore({ saveRoot: "C:\\Saves" });
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state,
      exists: () => true,
      findLatestSave: async () => "latest.sav",
      watch: vi.fn((_root, _options, _next) => ({ close: vi.fn() })),
      uploader: { upload: vi.fn().mockResolvedValue(undefined), openMap: vi.fn(), close: vi.fn() },
      debounceMs: 2_000,
    });

    await service.start();
    await vi.waitFor(() => expect(state.getSnapshot().lastUploadResult).toBe("success"));

    const messages = state.getSnapshot().logs.map((entry) => entry.message);
    expect(messages).toContain("Uploading latest save after initial scan: latest.sav");
    expect(messages).not.toContain("Uploading latest save after startup scan: latest.sav");
  });

  it("stops receiving events and clears pending automatic uploads without interrupting the active upload", async () => {
    vi.useFakeTimers();
    const first = createDeferred();
    let latestSave = "first.sav";
    let callback!: WatchCallback;
    const close = vi.fn();
    const uploaded: string[] = [];
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state: new AppStateStore({ saveRoot: "C:\\Saves" }),
      exists: () => true,
      findLatestSave: async () => latestSave,
      watch: (_root, _options, next) => {
        callback = next;
        return { close };
      },
      uploader: {
        upload: vi.fn(async (savePath: string) => {
          uploaded.push(savePath);
          if (savePath === "first.sav") {
            await first.promise;
          }
        }),
        openMap: vi.fn(),
        close: vi.fn(),
      },
      debounceMs: 2_000,
    });

    await service.start();
    await vi.waitFor(() => expect(uploaded).toEqual(["first.sav"]));
    latestSave = "second.sav";
    callback("change", "second.sav");
    await vi.advanceTimersByTimeAsync(2_000);

    await service.stop();
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);

    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(uploaded).toEqual(["first.sav"]);
  });

  it("allows manual upload after stop and keeps it on the same serial queue", async () => {
    vi.useFakeTimers();
    const first = createDeferred();
    let latestSave = "first.sav";
    const uploaded: string[] = [];
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state: new AppStateStore({ saveRoot: "C:\\Saves" }),
      exists: () => true,
      findLatestSave: async () => latestSave,
      watch: vi.fn((_root, _options, _next) => ({ close: vi.fn() })),
      uploader: {
        upload: vi.fn(async (savePath: string) => {
          uploaded.push(savePath);
          if (savePath === "first.sav") {
            await first.promise;
          }
        }),
        openMap: vi.fn(),
        close: vi.fn(),
      },
      debounceMs: 2_000,
    });

    await service.start();
    await vi.waitFor(() => expect(uploaded).toEqual(["first.sav"]));
    await service.stop();
    latestSave = "manual.sav";
    void service.uploadLatestSave();

    expect(uploaded).toEqual(["first.sav"]);
    first.resolve();
    await vi.waitFor(() => expect(uploaded).toEqual(["first.sav", "manual.sav"]));
  });

  it("uploads a specified save path without scanning for the latest save", async () => {
    const findLatestSave = vi.fn().mockResolvedValue("newer.sav");
    const upload = vi.fn().mockResolvedValue(undefined);
    const state = new AppStateStore({ saveRoot: "C:\\Saves" });
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state,
      exists: () => true,
      findLatestSave,
      watch: vi.fn((_root, _options, _next) => ({ close: vi.fn() })),
      uploader: { upload, openMap: vi.fn(), close: vi.fn() },
      debounceMs: 2_000,
      uploadOnStart: false,
    });

    await service.start();
    await service.uploadSave("C:\\Saves\\previously-opened.sav", "language change");

    expect(findLatestSave).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledWith("C:\\Saves\\previously-opened.sav", undefined);
    expect(state.getSnapshot()).toMatchObject({
      latestSavePath: "C:\\Saves\\previously-opened.sav",
      uploadStatus: "success",
      lastUploadResult: "success",
    });
  });

  it("does not let a closed active upload write a stale final result", async () => {
    const first = createDeferred();
    const state = new AppStateStore({ saveRoot: "C:\\Saves" });
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state,
      exists: () => true,
      findLatestSave: async () => "first.sav",
      watch: vi.fn((_root, _options, _next) => ({ close: vi.fn() })),
      uploader: {
        upload: vi.fn(async () => {
          await first.promise;
        }),
        openMap: vi.fn(),
        close: vi.fn(),
      },
      debounceMs: 2_000,
    });

    await service.start();
    await vi.waitFor(() => expect(state.getSnapshot().uploadStatus).toBe("loading-page"));
    await service.close();
    first.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.getSnapshot().lastUploadResult).toBeNull();
  });

  it("returns active upload cancellation metadata when closed for revocation", async () => {
    const service = new SaveWatcherService({
      saveRoot: "C:\\Saves",
      state: new AppStateStore({ saveRoot: "C:\\Saves" }),
      exists: () => true,
      findLatestSave: async () => null,
      watch: vi.fn((_root, _options, _next) => ({ close: vi.fn() })),
      uploader: {
        upload: vi.fn(),
        openMap: vi.fn(),
        close: vi.fn().mockResolvedValue({ fileProvided: true }),
      },
      debounceMs: 2_000,
    });

    await expect(service.close()).resolves.toEqual({ fileProvided: true });
  });
});
