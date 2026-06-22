// abstract: Secure Electron BrowserWindow option builders for local and remote windows.
// out_of_scope: Runtime navigation filtering, permission handlers, and window lifecycle.

import type { BrowserWindowConstructorOptions, WebContentsViewConstructorOptions } from "electron";

const mapWebPreferences = (partition: string) => ({
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  webviewTag: false,
  partition,
});

export function createStatusWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1420,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: "Satisfactory Save Map Uploader",
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
    },
  };
}

export function createMapWindowOptions(partition = "map"): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 860,
    show: false,
    title: "Satisfactory Interactive Map",
    webPreferences: mapWebPreferences(partition),
  };
}

export function createMapViewOptions(partition = "map"): WebContentsViewConstructorOptions {
  return {
    webPreferences: mapWebPreferences(partition),
  };
}
