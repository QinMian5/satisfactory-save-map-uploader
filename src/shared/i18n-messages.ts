// abstract: Typed runtime message DTOs shared across Electron boundaries.
// out_of_scope: Renderer copy templates, language preference persistence, and log storage.

export const LOCALIZED_MESSAGE_KEYS = [
  "command.failedWithDetails",
  "language.preferenceSaving",
  "language.preferenceSaved",
  "preferences.couldNotBeSaved",
  "revocation.activeButRestartNotGuaranteed",
  "revocation.cancelledBeforeFileProvided",
  "revocation.couldNotBePersisted",
  "revocation.fileProvidedFutureBlocked",
  "revocation.revoking",
  "revocation.savedForFutureRestarts",
  "saveDirectory.notFound",
  "saveFolder.openFailed",
  "smoke.acceptedWithoutWatcher",
  "smoke.didNotScanSaves",
  "smoke.disclosureStillRequired",
  "smoke.revoked",
  "thirdPartyUpload.permissionCouldNotBeSaved",
  "thirdPartyUpload.permissionNotGrantedExit",
  "thirdPartyUpload.permissionRequiredBeforeScanning",
  "thirdPartyUpload.permissionRequiredBeforeScanningOrOpeningMap",
  "thirdPartyUpload.permissionRequiredBeforeUploadingSelected",
  "thirdPartyUpload.permissionSaved",
  "thirdPartyUpload.permissionSavedStartWhenReady",
  "thirdPartyUpload.permissionSaving",
  "upload.failedWithDetails",
] as const;

export type LocalizedMessageKey = (typeof LOCALIZED_MESSAGE_KEYS)[number];

export type LocalizedMessageParams = Record<string, string | number | boolean | null | undefined>;

export type LocalizedMessage = {
  key: LocalizedMessageKey;
  params?: LocalizedMessageParams;
};

export function localizedMessage(
  key: LocalizedMessageKey,
  params?: LocalizedMessageParams,
): LocalizedMessage {
  return params ? { key, params } : { key };
}
