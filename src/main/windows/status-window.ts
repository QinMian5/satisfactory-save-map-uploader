// abstract: Electron status window creation and focus helpers for the local renderer.
// out_of_scope: Watcher services, map window lifecycle, and IPC handler implementation.

import { BrowserWindow } from "electron";
import { createStatusWindowOptions } from "../security/window-options.js";

export type StatusWindowRendererEntry =
  | {
      kind: "url";
      value: string;
    }
  | {
      kind: "file";
      value: string;
    };

export function createStatusWindow(
  preloadPath: string,
  rendererEntry: StatusWindowRendererEntry,
): BrowserWindow {
  const window = new BrowserWindow(createStatusWindowOptions(preloadPath));
  if (rendererEntry.kind === "url") {
    void window.loadURL(rendererEntry.value);
  } else {
    void window.loadFile(rendererEntry.value);
  }
  return window;
}

export function restoreAndFocus(window: BrowserWindow): void {
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}
