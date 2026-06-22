// abstract: Vite build settings for the React status-window renderer.
// out_of_scope: Electron main-process bundling, save watching, and map automation.

import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  root: path.resolve(ROOT, "src", "renderer"),
  build: {
    outDir: path.resolve(ROOT, ".vite", "renderer", "main_window"),
    sourcemap: command === "serve",
  },
  plugins: [react(), tailwindcss()],
}));
