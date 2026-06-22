// abstract: Vite build settings for the secure Electron preload bundle.
// out_of_scope: Renderer bundling, main-process service wiring, and IPC handlers.

import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  build: {
    sourcemap: command === "serve",
  },
}));
