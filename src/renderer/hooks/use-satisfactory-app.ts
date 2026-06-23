// abstract: React hook that owns the secure preload bridge subscription and commands.
// out_of_scope: Presentational layout, save watching internals, and Electron IPC handlers.

import { useCallback, useEffect, useState } from "react";
import { type LocalizedMessage, localizedMessage } from "../../shared/i18n-messages.js";
import type { AppLanguage, AppStateSnapshot } from "../../shared/state.js";

export type SatisfactoryAppCommands = {
  acceptThirdPartyUpload: () => Promise<void>;
  declineThirdPartyUpload: () => Promise<void>;
  disableUploadsAndExit: () => Promise<void>;
  revokeThirdPartyUpload: () => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  startWatcher: () => Promise<void>;
  stopWatcher: () => Promise<void>;
  uploadLatestSave: () => Promise<void>;
  openSaveFolder: () => Promise<void>;
};

export type SatisfactoryAppModel = {
  state: AppStateSnapshot | null;
  commandError: LocalizedMessage | null;
  commands: SatisfactoryAppCommands;
};

export function useSatisfactoryApp(): SatisfactoryAppModel {
  const [state, setState] = useState<AppStateSnapshot | null>(null);
  const [commandError, setCommandError] = useState<LocalizedMessage | null>(null);

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
          setCommandError(
            localizedMessage("command.failedWithDetails", { details: getErrorMessage(error) }),
          );
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
      setCommandError(
        localizedMessage("command.failedWithDetails", { details: getErrorMessage(error) }),
      );
    }
  }, []);

  const disableUploadsAndExit = useCallback(async () => {
    setCommandError(null);
    try {
      const revokedState = await window.satisfactoryApp.revokeThirdPartyUpload();
      setState(revokedState);
      if (
        revokedState.permissionStatus === "revocation-save-failed" ||
        revokedState.consentPersistenceStatus === "durable-revoke-failed"
      ) {
        return;
      }
      setState(await window.satisfactoryApp.declineThirdPartyUpload());
    } catch (error) {
      setCommandError(
        localizedMessage("command.failedWithDetails", { details: getErrorMessage(error) }),
      );
    }
  }, []);

  return {
    state,
    commandError,
    commands: {
      acceptThirdPartyUpload: () => runCommand(window.satisfactoryApp.acceptThirdPartyUpload),
      declineThirdPartyUpload: () => runCommand(window.satisfactoryApp.declineThirdPartyUpload),
      disableUploadsAndExit,
      revokeThirdPartyUpload: () => runCommand(window.satisfactoryApp.revokeThirdPartyUpload),
      setLanguage: (language) => runCommand(() => window.satisfactoryApp.setLanguage(language)),
      startWatcher: () => runCommand(window.satisfactoryApp.startWatcher),
      stopWatcher: () => runCommand(window.satisfactoryApp.stopWatcher),
      uploadLatestSave: () => runCommand(window.satisfactoryApp.uploadLatestSave),
      openSaveFolder: () => runCommand(window.satisfactoryApp.openSaveFolder),
    },
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
