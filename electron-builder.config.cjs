// abstract: electron-builder settings for Windows AppX/MSIX-family package artifacts.
// out_of_scope: Electron Forge Vite packaging, runtime behavior, and release publication.

const packageJson = require("./package.json");
const versionMacro = "$" + "{version}";
const archMacro = "$" + "{arch}";
const extMacro = "$" + "{ext}";

module.exports = {
  appId: "io.github.qinmian5.satisfactory-save-map-uploader",
  productName: packageJson.productName,
  artifactName: `SatisfactorySaveMapUploader-${versionMacro}-${archMacro}.${extMacro}`,
  directories: {
    output: "out/make/appx",
  },
  win: {
    executableName: "SatisfactorySaveMapUploader",
    target: ["appx"],
  },
  appx: {
    identityName: "MianQin.SatisfactorySaveMapUploader",
    applicationId: "SatisfactorySaveMapUploader",
    displayName: "Satisfactory Save Map Uploader",
    publisher: "CN=DCC117A3-6615-4987-B0AD-FF45756501E3",
    publisherDisplayName: "Mian Qin",
    languages: ["en-US", "zh-CN"],
    artifactName: `SatisfactorySaveMapUploader-${versionMacro}-${archMacro}.${extMacro}`,
  },
};
