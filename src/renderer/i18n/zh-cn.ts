// abstract: Simplified Chinese renderer and runtime message templates.
// out_of_scope: Language registry ownership and formatter implementation.

import { getMapUrlForLanguage } from "../../shared/language.js";
import type { RendererCopy, RuntimeMessageTemplates } from "./types.js";

export const ZH_CN_RENDERER_COPY: RendererCopy = {
  documentTitle: "Satisfactory Save Map Uploader",
  language: {
    label: "语言",
    tooltip: "切换界面语言",
  },
  loading: {
    loading: "加载中",
    error: "错误",
  },
  consent: {
    appName: "Satisfactory Save Map Uploader",
    title: "允许上传幸福工厂存档？",
    warningTitle: "存档会提供给第三方网站",
    warningDescription: `只有在你允许后，本应用才会监控本地 Satisfactory .sav 存档。地图更新时，选中的存档会在应用内提供给 ${getMapUrlForLanguage("zh-CN")}。`,
    detailsTrigger: "网站可能收到什么？",
    details:
      "第三方页面可能收到存档内容、文件名、文件处理元数据、IP 地址以及常规网页请求信息。本项目不隶属于 Satisfactory、Coffee Stain 或 Satisfactory Calculator，也未获得其授权或背书。应用开发者不会接收或存储存档，也不包含分析或遥测。第三方网站自己的隐私政策和条款适用，网站变更也可能导致上传失效。",
    allow: "允许上传",
    decline: "暂不，退出",
  },
  dashboard: {
    title: "地图上传",
    start: "开始自动上传",
    startTooltip: "扫描存档目录并自动上传新存档",
    stop: "暂停自动上传",
    stopTooltip: "暂停自动上传；手动上传仍可使用",
    upload: "上传最新存档",
    uploadTooltip: "上传当前检测到的最新存档来更新地图",
    openSaveFolder: "打开存档文件夹",
    openSaveFolderTooltip: "打开当前存档所在文件夹；如果还没有当前存档，则打开默认存档目录",
    currentSaveLabel: "当前打开的存档",
    noSaveSelected: "未选择存档",
    disable: "禁用上传",
    disableTooltip: "停止后续上传并退出应用；已经提供给第三方页面的文件无法收回",
    disableDialogTitle: "禁用上传并退出？",
    disableDialogDescription:
      "这会停止后续上传并退出应用。已经提供给第三方页面的存档文件无法收回。",
    cancel: "取消",
    confirm: "确认",
    needsAttention: "需要处理",
    actionNeeded: "需要处理",
    commandFailed: "命令失败",
    settingsNotSaved: "设置未保存",
    settingsNotSavedDetail: "应用无法保存权限设置。请在关闭前重试。",
  },
};

export const ZH_CN_RUNTIME_MESSAGE_TEMPLATES: RuntimeMessageTemplates = {
  "command.failedWithDetails": "命令失败：{details}",
  "language.preferenceSaving": "正在保存语言偏好。",
  "language.preferenceSaved": "语言偏好已保存。",
  "preferences.couldNotBeSaved": "偏好设置无法保存：{details}",
  "revocation.activeButRestartNotGuaranteed":
    "本次会话已禁用上传，但应用无法保证重启后仍保持禁用。请在退出前重试禁用。",
  "revocation.cancelledBeforeFileProvided":
    "已禁用第三方上传权限。待处理的上传已在文件提供前取消。",
  "revocation.couldNotBePersisted": "撤销状态无法持久化。",
  "revocation.fileProvidedFutureBlocked":
    "已禁用第三方上传权限。当前文件可能已经提供给第三方页面；后续上传已阻止。",
  "revocation.revoking": "正在禁用第三方上传权限。",
  "revocation.savedForFutureRestarts": "撤销状态已保存，后续重启仍会生效。",
  "saveDirectory.notFound": "未找到存档目录：{path}",
  "saveFolder.openFailed": "无法打开存档文件夹：{details}",
  "smoke.acceptedWithoutWatcher": "Smoke test 模拟了授权，但没有启动监控。",
  "smoke.didNotScanSaves": "Smoke test 没有扫描存档。",
  "smoke.disclosureStillRequired": "Smoke test 保持需要授权的状态。",
  "smoke.revoked": "Smoke test 模拟了撤销。",
  "thirdPartyUpload.permissionCouldNotBeSaved": "第三方上传权限无法保存。{details}",
  "thirdPartyUpload.permissionNotGrantedExit": "未授予第三方上传权限。应用将退出，且不会扫描存档。",
  "thirdPartyUpload.permissionRequiredBeforeScanning": "扫描存档前需要第三方上传权限。",
  "thirdPartyUpload.permissionRequiredBeforeScanningOrOpeningMap":
    "扫描存档或打开地图前需要第三方上传权限。",
  "thirdPartyUpload.permissionRequiredBeforeUploadingSelected":
    "上传所选存档前需要第三方上传权限。",
  "thirdPartyUpload.permissionSaved": "第三方上传权限已保存。",
  "thirdPartyUpload.permissionSavedStartWhenReady":
    "第三方上传权限已保存。准备好上传存档后，可以开始自动上传。",
  "thirdPartyUpload.permissionSaving": "正在保存第三方上传权限。",
  "upload.failedWithDetails": "上传失败：{details}",
};
