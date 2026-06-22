// abstract: Thin React composition root for renderer views.
// out_of_scope: Electron IPC internals, save watching, and map upload automation.

import { useSatisfactoryApp } from "./hooks/use-satisfactory-app.js";
import {
  getConsentViewModel,
  getDashboardViewModel,
  getLockedViewModel,
  getRendererViewMode,
} from "./view-model.js";
import { ConsentView } from "./views/consent-view.js";
import { DashboardView } from "./views/dashboard-view.js";
import { LoadingView } from "./views/loading-view.js";
import { LockedView } from "./views/locked-view.js";

export function App() {
  const { commandError, commands, state } = useSatisfactoryApp();

  if (!state) {
    return <LoadingView error={commandError} />;
  }

  const viewMode = getRendererViewMode(state);
  if (viewMode === "consent") {
    return <ConsentView commands={commands} model={getConsentViewModel(state)} />;
  }
  if (viewMode === "locked") {
    return <LockedView commands={commands} model={getLockedViewModel(state)} />;
  }
  return <DashboardView commands={commands} model={getDashboardViewModel(state, commandError)} />;
}
