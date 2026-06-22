// abstract: Pure preload API construction for the renderer command bridge.
// out_of_scope: Electron context exposure, renderer DOM updates, and service implementations.

import { IPC_CHANNELS, type SatisfactoryRendererApi } from "../shared/ipc.js";
import type { AppLanguage, AppStateSnapshot, DisclosureSnapshot } from "../shared/state.js";

export type IpcRendererPort = {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: (event: unknown, state: AppStateSnapshot) => void) => void;
  removeListener: (
    channel: string,
    listener: (event: unknown, state: AppStateSnapshot) => void,
  ) => void;
};

export function createPreloadApi(ipcRenderer: IpcRendererPort): SatisfactoryRendererApi {
  return {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.getState) as Promise<AppStateSnapshot>,
    getDisclosure: () =>
      ipcRenderer.invoke(IPC_CHANNELS.getDisclosure) as Promise<DisclosureSnapshot>,
    acceptThirdPartyUpload: () =>
      ipcRenderer.invoke(IPC_CHANNELS.acceptThirdPartyUpload) as Promise<AppStateSnapshot>,
    declineThirdPartyUpload: () =>
      ipcRenderer.invoke(IPC_CHANNELS.declineThirdPartyUpload) as Promise<AppStateSnapshot>,
    revokeThirdPartyUpload: () =>
      ipcRenderer.invoke(IPC_CHANNELS.revokeThirdPartyUpload) as Promise<AppStateSnapshot>,
    setLanguage: (language: AppLanguage) =>
      ipcRenderer.invoke(IPC_CHANNELS.setLanguage, language) as Promise<AppStateSnapshot>,
    startWatcher: () => ipcRenderer.invoke(IPC_CHANNELS.startWatcher) as Promise<AppStateSnapshot>,
    stopWatcher: () => ipcRenderer.invoke(IPC_CHANNELS.stopWatcher) as Promise<AppStateSnapshot>,
    uploadLatestSave: () =>
      ipcRenderer.invoke(IPC_CHANNELS.uploadLatestSave) as Promise<AppStateSnapshot>,
    openMap: () => ipcRenderer.invoke(IPC_CHANNELS.openMap) as Promise<AppStateSnapshot>,
    onStateChanged: (listener: (state: AppStateSnapshot) => void) => {
      const handler = (_event: unknown, state: AppStateSnapshot): void => {
        listener(state);
      };
      ipcRenderer.on(IPC_CHANNELS.stateChanged, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, handler);
      };
    },
  };
}
