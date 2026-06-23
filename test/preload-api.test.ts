// abstract: Tests for the preload API wrapper without importing Electron runtime objects.
// out_of_scope: Real contextBridge exposure, renderer DOM behavior, and Electron IPC transport.

import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createPreloadApi, type IpcRendererPort } from "../src/main/preload-api.js";
import { IPC_CHANNELS } from "../src/shared/ipc.js";

function createIpcRenderer(): IpcRendererPort & {
  listeners: Map<string, Array<(event: unknown, state: unknown) => void>>;
} {
  const listeners = new Map<string, Array<(event: unknown, state: unknown) => void>>();
  return {
    listeners,
    invoke: vi.fn().mockResolvedValue({ watcherStatus: "stopped" }),
    on: (channel, listener) => {
      listeners.set(channel, [...(listeners.get(channel) ?? []), listener]);
    },
    removeListener: (channel, listener) => {
      listeners.set(
        channel,
        (listeners.get(channel) ?? []).filter((candidate) => candidate !== listener),
      );
    },
  };
}

describe("createPreloadApi", () => {
  it("exposes command methods without exposing raw ipcRenderer", () => {
    const ipcRenderer = createIpcRenderer();
    const api = createPreloadApi(ipcRenderer);

    expect(Object.keys(api).sort()).toEqual([
      "acceptThirdPartyUpload",
      "declineThirdPartyUpload",
      "getDisclosure",
      "getState",
      "onStateChanged",
      "openMap",
      "openSaveFolder",
      "revokeThirdPartyUpload",
      "setLanguage",
      "startWatcher",
      "stopWatcher",
      "uploadLatestSave",
    ]);
    expect(api).not.toHaveProperty("ipcRenderer");
  });

  it("subscribes without passing the Electron event object and can unsubscribe", () => {
    const ipcRenderer = createIpcRenderer();
    const api = createPreloadApi(ipcRenderer);
    const listener = vi.fn();

    const unsubscribe = api.onStateChanged(listener);
    const state = { watcherStatus: "running" };
    const event = { sender: "electron-event" };
    ipcRenderer.listeners.get(IPC_CHANNELS.stateChanged)?.[0]?.(event, state);

    expect(listener).toHaveBeenCalledWith(state);
    expect(listener).not.toHaveBeenCalledWith(event, state);

    unsubscribe();
    expect(ipcRenderer.listeners.get(IPC_CHANNELS.stateChanged)).toEqual([]);
  });

  it("does not let the renderer provide a disclosure version when accepting", async () => {
    const ipcRenderer = createIpcRenderer();
    const api = createPreloadApi(ipcRenderer);

    await api.acceptThirdPartyUpload();

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.acceptThirdPartyUpload);
    expect(ipcRenderer.invoke).not.toHaveBeenCalledWith(
      IPC_CHANNELS.acceptThirdPartyUpload,
      expect.anything(),
    );
  });

  it("lets the renderer request only a supported language preference update", async () => {
    const ipcRenderer = createIpcRenderer();
    const api = createPreloadApi(ipcRenderer);

    await (
      api as unknown as {
        setLanguage: (language: "en" | "zh-CN") => Promise<unknown>;
      }
    ).setLanguage("zh-CN");

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.setLanguage, "zh-CN");
  });

  it("lets the renderer request opening the save folder without providing a path", async () => {
    const ipcRenderer = createIpcRenderer();
    const api = createPreloadApi(ipcRenderer);

    await api.openSaveFolder();

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.openSaveFolder);
    expect(ipcRenderer.invoke).not.toHaveBeenCalledWith(
      IPC_CHANNELS.openSaveFolder,
      expect.anything(),
    );
  });

  it("forwards preload invoke arguments to the real Electron ipcRenderer", async () => {
    const preload = await readFile("src/main/preload.ts", "utf8");

    expect(preload).toContain("invoke: (channel, ...args)");
    expect(preload).toContain("ipcRenderer.invoke(channel, ...args)");
  });
});
