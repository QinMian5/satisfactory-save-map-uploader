// abstract: Renderer localization type contracts.
// out_of_scope: Runtime message key ownership and language preference persistence.

import type { LocalizedMessageKey } from "../../shared/i18n-messages.js";

export type RendererCopy = {
  documentTitle: string;
  language: {
    label: string;
    tooltip: string;
  };
  loading: {
    loading: string;
    error: string;
  };
  consent: {
    appName: string;
    title: string;
    warningTitle: string;
    warningDescription: string;
    detailsTrigger: string;
    details: string;
    allow: string;
    decline: string;
  };
  dashboard: {
    title: string;
    start: string;
    startTooltip: string;
    stop: string;
    stopTooltip: string;
    upload: string;
    uploadTooltip: string;
    openSaveFolder: string;
    openSaveFolderTooltip: string;
    currentSaveLabel: string;
    noSaveSelected: string;
    disable: string;
    disableTooltip: string;
    disableDialogTitle: string;
    disableDialogDescription: string;
    cancel: string;
    confirm: string;
    needsAttention: string;
    actionNeeded: string;
    commandFailed: string;
    settingsNotSaved: string;
    settingsNotSavedDetail: string;
  };
};

export type RuntimeMessageTemplates = Record<LocalizedMessageKey, string>;
