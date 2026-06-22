// abstract: React mount entry for the Electron status-window renderer.
// out_of_scope: Electron IPC internals, save watching, and map upload automation.

import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing renderer root element.");
}

createRoot(rootElement).render(<App />);
