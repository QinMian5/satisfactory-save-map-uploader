// abstract: Thin React composition root for renderer views.
// out_of_scope: Electron IPC internals, save watching, and map upload automation.

import { useEffect } from "react";
import { DEFAULT_APP_LANGUAGE } from "../shared/language.js";
import { useSatisfactoryApp } from "./hooks/use-satisfactory-app.js";
import { getRendererCopy } from "./i18n.js";
import { getConsentViewModel, getDashboardViewModel, getRendererViewMode } from "./view-model.js";
import { ConsentView } from "./views/consent-view.js";
import { DashboardView } from "./views/dashboard-view.js";
import { LoadingView } from "./views/loading-view.js";

export function App() {
  const { commandError, commands, state } = useSatisfactoryApp();
  const language = state?.language ?? DEFAULT_APP_LANGUAGE;
  const copy = getRendererCopy(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = copy.documentTitle;
  }, [copy.documentTitle, language]);

  if (!state) {
    return <LoadingView copy={copy.loading} error={commandError} />;
  }

  const viewMode = getRendererViewMode(state);
  if (viewMode === "consent") {
    return (
      <ConsentView
        commands={commands}
        copy={copy}
        language={state.language}
        model={getConsentViewModel(state)}
      />
    );
  }
  return (
    <DashboardView
      commands={commands}
      copy={copy}
      language={state.language}
      model={getDashboardViewModel(state, commandError)}
    />
  );
}
