// abstract: Centralized application metadata for Electron packaging and distribution docs.
// out_of_scope: Runtime state, Store partner identity values, and signing credentials.

export const APP_METADATA = {
  packageName: "satisfactory-save-map-watcher",
  productName: "Satisfactory Save Map Watcher",
  appId: "io.github.qinmian5.satisfactory-save-map-watcher",
  squirrelName: "SatisfactorySaveMapWatcher",
  setupExe: "SatisfactorySaveMapWatcher-Setup.exe",
  version: "0.1.0",
  author: "QinMian5",
  description:
    "Desktop watcher that uploads local Satisfactory saves to the Satisfactory Calculator interactive map.",
} as const;

export const STORE_METADATA_PLACEHOLDERS = {
  publisher: "WAITING_FOR_PARTNER_CENTER",
  publisherDisplayName: "WAITING_FOR_PARTNER_CENTER",
  packageIdentityName: "WAITING_FOR_PARTNER_CENTER",
  packageFamilyName: "WAITING_FOR_PARTNER_CENTER",
  partnerCenterProductId: "WAITING_FOR_PARTNER_CENTER",
} as const;
