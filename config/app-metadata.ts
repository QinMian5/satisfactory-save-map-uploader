// abstract: Centralized application metadata for Electron packaging and distribution docs.
// out_of_scope: Runtime state, Store account management, and signing credentials.

export const APP_METADATA = {
  packageName: "satisfactory-save-map-uploader",
  productName: "Satisfactory Save Map Uploader",
  appId: "io.github.qinmian5.satisfactory-save-map-uploader",
  executableName: "SatisfactorySaveMapUploader",
  version: "0.1.0",
  author: "QinMian5",
  description:
    "Desktop uploader that provides selected Satisfactory saves to the Satisfactory Calculator interactive map.",
} as const;

export const STORE_METADATA = {
  publisher: "CN=DCC117A3-6615-4987-B0AD-FF45756501E3",
  publisherDisplayName: "Mian Qin",
  packageIdentityName: "MianQin.SatisfactorySaveMapUploader",
  packageFamilyName: "MianQin.SatisfactorySaveMapUploader_xrv9fnatjde9j",
  packageSid: "S-1-15-2-906032442-619397748-1334772913-511471008-4167244459-819296471-2325134967",
  partnerCenterProductId: "9PHQ2D03K6ZS",
  storeUrl: "https://apps.microsoft.com/detail/9PHQ2D03K6ZS",
  storeProtocolLink: "ms-windows-store://pdp/?productid=9PHQ2D03K6ZS",
  msaAppId: "3d9d611b-125c-4112-887d-598d626a311b",
} as const;
