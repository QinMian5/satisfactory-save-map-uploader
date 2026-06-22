// abstract: Renderer global API declaration for the secure preload bridge.
// out_of_scope: Preload implementation, Electron IPC handlers, and DOM rendering logic.

import type { SatisfactoryRendererApi } from "../shared/ipc.js";

declare global {
  interface Window {
    satisfactoryApp: SatisfactoryRendererApi;
  }
}
