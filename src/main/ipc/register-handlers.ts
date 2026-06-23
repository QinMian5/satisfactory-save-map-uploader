// abstract: Main-process IPC handler registration for status-window commands.
// out_of_scope: Preload API exposure, renderer DOM updates, and service internals.

import type { BrowserWindow, IpcMain } from "electron";
import type { AppStateStore } from "../../services/app-state.js";
import { IPC_CHANNELS } from "../../shared/ipc.js";
import type { AppLanguage, AppStateSnapshot, DisclosureSnapshot } from "../../shared/state.js";
import { assertTrustedSender } from "./sender-validation.js";

type RegisterIpcHandlersOptions = {
  ipcMain: IpcMain;
  statusWindow: BrowserWindow;
  commands: {
    startWatcher: () => Promise<AppStateSnapshot>;
    stopWatcher: () => Promise<AppStateSnapshot>;
    uploadLatestSave: () => Promise<AppStateSnapshot>;
    openMap: () => Promise<AppStateSnapshot>;
    openSaveFolder: () => Promise<AppStateSnapshot>;
    acceptThirdPartyUpload: () => Promise<AppStateSnapshot>;
    declineThirdPartyUpload: () => Promise<AppStateSnapshot>;
    revokeThirdPartyUpload: () => Promise<AppStateSnapshot>;
    setLanguage: (language: AppLanguage) => Promise<AppStateSnapshot>;
    getDisclosure: () => Promise<DisclosureSnapshot>;
  };
  state: AppStateStore;
};

export function registerIpcHandlers(options: RegisterIpcHandlersOptions): () => void {
  const { ipcMain, statusWindow, commands, state } = options;
  const trustedSender = statusWindow.webContents;

  ipcMain.handle(IPC_CHANNELS.getState, (event) => {
    assertTrustedSender(event, trustedSender);
    return state.getSnapshot();
  });
  ipcMain.handle(IPC_CHANNELS.getDisclosure, async (event): Promise<DisclosureSnapshot> => {
    assertTrustedSender(event, trustedSender);
    return commands.getDisclosure();
  });
  ipcMain.handle(IPC_CHANNELS.acceptThirdPartyUpload, async (event): Promise<AppStateSnapshot> => {
    assertTrustedSender(event, trustedSender);
    return commands.acceptThirdPartyUpload();
  });
  ipcMain.handle(IPC_CHANNELS.declineThirdPartyUpload, async (event): Promise<AppStateSnapshot> => {
    assertTrustedSender(event, trustedSender);
    return commands.declineThirdPartyUpload();
  });
  ipcMain.handle(IPC_CHANNELS.revokeThirdPartyUpload, async (event): Promise<AppStateSnapshot> => {
    assertTrustedSender(event, trustedSender);
    return commands.revokeThirdPartyUpload();
  });
  ipcMain.handle(
    IPC_CHANNELS.setLanguage,
    async (event, language: AppLanguage): Promise<AppStateSnapshot> => {
      assertTrustedSender(event, trustedSender);
      return commands.setLanguage(language);
    },
  );
  ipcMain.handle(IPC_CHANNELS.startWatcher, async (event): Promise<AppStateSnapshot> => {
    assertTrustedSender(event, trustedSender);
    return commands.startWatcher();
  });
  ipcMain.handle(IPC_CHANNELS.stopWatcher, async (event): Promise<AppStateSnapshot> => {
    assertTrustedSender(event, trustedSender);
    return commands.stopWatcher();
  });
  ipcMain.handle(IPC_CHANNELS.uploadLatestSave, async (event): Promise<AppStateSnapshot> => {
    assertTrustedSender(event, trustedSender);
    return commands.uploadLatestSave();
  });
  ipcMain.handle(IPC_CHANNELS.openMap, async (event): Promise<AppStateSnapshot> => {
    assertTrustedSender(event, trustedSender);
    return commands.openMap();
  });
  ipcMain.handle(IPC_CHANNELS.openSaveFolder, async (event): Promise<AppStateSnapshot> => {
    assertTrustedSender(event, trustedSender);
    return commands.openSaveFolder();
  });

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.getState);
    ipcMain.removeHandler(IPC_CHANNELS.getDisclosure);
    ipcMain.removeHandler(IPC_CHANNELS.acceptThirdPartyUpload);
    ipcMain.removeHandler(IPC_CHANNELS.declineThirdPartyUpload);
    ipcMain.removeHandler(IPC_CHANNELS.revokeThirdPartyUpload);
    ipcMain.removeHandler(IPC_CHANNELS.setLanguage);
    ipcMain.removeHandler(IPC_CHANNELS.startWatcher);
    ipcMain.removeHandler(IPC_CHANNELS.stopWatcher);
    ipcMain.removeHandler(IPC_CHANNELS.uploadLatestSave);
    ipcMain.removeHandler(IPC_CHANNELS.openMap);
    ipcMain.removeHandler(IPC_CHANNELS.openSaveFolder);
  };
}
