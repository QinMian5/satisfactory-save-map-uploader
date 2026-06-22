// abstract: Secure preload bridge exposing the minimal renderer command API.
// out_of_scope: Renderer DOM updates, service implementations, and map page automation.

import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { createPreloadApi, type IpcRendererPort } from "./preload-api.js";

const ipcRendererPort: IpcRendererPort = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener as (event: IpcRendererEvent, ...args: unknown[]) => void);
  },
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(
      channel,
      listener as (event: IpcRendererEvent, ...args: unknown[]) => void,
    );
  },
};

contextBridge.exposeInMainWorld("satisfactoryApp", createPreloadApi(ipcRendererPort));
