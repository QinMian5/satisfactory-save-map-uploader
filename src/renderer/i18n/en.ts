// abstract: English renderer and runtime message templates.
// out_of_scope: Language registry ownership and formatter implementation.

import { getMapUrlForLanguage } from "../../shared/language.js";
import type { RendererCopy, RuntimeMessageTemplates } from "./types.js";

export const EN_RENDERER_COPY: RendererCopy = {
  documentTitle: "Satisfactory Save Map Uploader",
  language: {
    label: "Language",
    tooltip: "Change interface language",
  },
  loading: {
    loading: "Loading",
    error: "Error",
  },
  consent: {
    appName: "Satisfactory Save Map Uploader",
    title: "Allow Satisfactory save uploads?",
    warningTitle: "Uploads go to a third-party website",
    warningDescription: `This app can watch local Satisfactory .sav files only after you allow it. When the map is updated, the selected save file is provided to ${getMapUrlForLanguage("en")} inside the application.`,
    detailsTrigger: "What can the site receive?",
    details:
      "The third-party page may receive the save file contents, file name, file-processing metadata, IP address, and normal web request information. This project is not affiliated with, authorized by, or endorsed by Satisfactory, Coffee Stain, or Satisfactory Calculator. The app developer does not receive or store save files and does not include analytics or telemetry. The third-party site's own privacy policy and terms apply, and site changes can break uploads.",
    allow: "Allow uploads",
    decline: "Not now, exit",
  },
  dashboard: {
    title: "Map uploader",
    start: "Start automatic upload",
    startTooltip: "Scan the save folder and upload new saves automatically",
    stop: "Pause watching",
    stopTooltip: "Pause automatic monitoring; manual uploads remain available",
    upload: "Upload latest save",
    uploadTooltip: "Upload the newest detected save to update the map once",
    openSaveFolder: "Open save folder",
    openSaveFolderTooltip:
      "Open the current save folder, or the default save folder if no save is open",
    currentSaveLabel: "Currently opened save",
    noSaveSelected: "No save selected",
    disable: "Disable uploads",
    disableTooltip:
      "Stop future uploads and exit the app; files already provided cannot be taken back",
    disableDialogTitle: "Disable uploads and exit?",
    disableDialogDescription:
      "This stops future uploads and exits the app. It cannot take back a save file already provided to the third-party page.",
    cancel: "Cancel",
    confirm: "Confirm",
    needsAttention: "Needs attention",
    actionNeeded: "Action needed",
    commandFailed: "Command failed",
    settingsNotSaved: "Settings were not saved",
    settingsNotSavedDetail:
      "The app could not save your permission settings. Retry before closing the app.",
  },
};

export const EN_RUNTIME_MESSAGE_TEMPLATES: RuntimeMessageTemplates = {
  "command.failedWithDetails": "Command failed: {details}",
  "language.preferenceSaving": "Saving language preference.",
  "language.preferenceSaved": "Language preference saved.",
  "preferences.couldNotBeSaved": "Preferences could not be saved: {details}",
  "revocation.activeButRestartNotGuaranteed":
    "Revocation is active for this session, but the app cannot guarantee it will remain revoked after restart. Retry revoke before exiting.",
  "revocation.cancelledBeforeFileProvided":
    "Third-party upload permission was revoked. Pending upload was cancelled before a file was provided.",
  "revocation.couldNotBePersisted": "Revocation could not be persisted.",
  "revocation.fileProvidedFutureBlocked":
    "Third-party upload permission was revoked. The current file may already have been provided to the third-party page; future uploads are blocked.",
  "revocation.revoking": "Revoking third-party upload permission.",
  "revocation.savedForFutureRestarts": "Revocation is saved for future restarts.",
  "saveDirectory.notFound": "Save directory not found: {path}",
  "saveFolder.openFailed": "Could not open save folder: {details}",
  "smoke.acceptedWithoutWatcher": "Smoke test simulated accept without starting watcher.",
  "smoke.didNotScanSaves": "Smoke test did not scan saves.",
  "smoke.disclosureStillRequired": "Smoke test kept disclosure required.",
  "smoke.revoked": "Smoke test simulated revoke.",
  "thirdPartyUpload.permissionCouldNotBeSaved":
    "Third-party upload permission could not be saved. {details}",
  "thirdPartyUpload.permissionNotGrantedExit":
    "Third-party upload permission was not granted. The app will exit without scanning saves.",
  "thirdPartyUpload.permissionRequiredBeforeScanning":
    "Third-party upload permission is required before scanning saves.",
  "thirdPartyUpload.permissionRequiredBeforeScanningOrOpeningMap":
    "Third-party upload permission is required before scanning saves or opening the map.",
  "thirdPartyUpload.permissionRequiredBeforeUploadingSelected":
    "Third-party upload permission is required before uploading the selected save.",
  "thirdPartyUpload.permissionSaved": "Third-party upload permission saved.",
  "thirdPartyUpload.permissionSavedStartWhenReady":
    "Third-party upload permission is saved. Start automatic upload when you are ready to upload saves.",
  "thirdPartyUpload.permissionSaving": "Saving third-party upload permission.",
  "upload.failedWithDetails": "Upload failed: {details}",
};
