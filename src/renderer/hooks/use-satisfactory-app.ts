// abstract: React hook that owns the secure preload bridge subscription and commands.
// out_of_scope: Presentational layout, save watching internals, and Electron IPC handlers.

import { useCallback, useEffect, useState } from "react";
import type { AppStateSnapshot } from "../../shared/state.js";

export type SatisfactoryAppCommands = {
  acceptThirdPartyUpload: () => Promise<void>;
  declineThirdPartyUpload: () => Promise<void>;
  revokeThirdPartyUpload: () => Promise<void>;
  startWatcher: () => Promise<void>;
  stopWatcher: () => Promise<void>;
  uploadLatestSave: () => Promise<void>;
};

export type SatisfactoryAppModel = {
  state: AppStateSnapshot | null;
  commandError: string | null;
  commands: SatisfactoryAppCommands;
};

export function useSatisfactoryApp(): SatisfactoryAppModel {
  const [state, setState] = useState<AppStateSnapshot | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = window.satisfactoryApp.onStateChanged((nextState) => {
      if (mounted) {
        setState(nextState);
      }
    });

    window.satisfactoryApp
      .getState()
      .then((nextState) => {
        if (mounted) {
          setState(nextState);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setCommandError(getErrorMessage(error));
        }
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const runCommand = useCallback(async (command: () => Promise<AppStateSnapshot>) => {
    setCommandError(null);
    try {
      setState(await command());
    } catch (error) {
      setCommandError(getErrorMessage(error));
    }
  }, []);

  return {
    state,
    commandError,
    commands: {
      acceptThirdPartyUpload: () => runCommand(window.satisfactoryApp.acceptThirdPartyUpload),
      declineThirdPartyUpload: () => runCommand(window.satisfactoryApp.declineThirdPartyUpload),
      revokeThirdPartyUpload: () => runCommand(window.satisfactoryApp.revokeThirdPartyUpload),
      startWatcher: () => runCommand(window.satisfactoryApp.startWatcher),
      stopWatcher: () => runCommand(window.satisfactoryApp.stopWatcher),
      uploadLatestSave: () => runCommand(window.satisfactoryApp.uploadLatestSave),
    },
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
