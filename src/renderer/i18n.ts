// abstract: Renderer copy dictionaries for supported interface languages.
// out_of_scope: Preference persistence, Electron IPC transport, and browser locale detection.

import { type AppLanguage, getMapUrlForLanguage } from "../shared/language.js";

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
    commandsLabel: string;
    start: string;
    startTooltip: string;
    stop: string;
    stopTooltip: string;
    upload: string;
    uploadTooltip: string;
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

export const RENDERER_LANGUAGE_COPY: Record<AppLanguage, RendererCopy> = {
  en: {
    documentTitle: "Satisfactory Save Map Watcher",
    language: {
      label: "Language",
      tooltip: "Change interface language.",
    },
    loading: {
      loading: "Loading",
      error: "Error",
    },
    consent: {
      appName: "Satisfactory Save Map Watcher",
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
      title: "Map watcher",
      commandsLabel: "Watcher commands",
      start: "Start automatic upload",
      startTooltip: "Scan the save folder and upload new saves automatically.",
      stop: "Pause watching",
      stopTooltip: "Stop automatic monitoring. Manual uploads remain available.",
      upload: "Upload latest save",
      uploadTooltip: "Upload the newest detected save to update the map once.",
      currentSaveLabel: "Currently opened save",
      noSaveSelected: "No save selected",
      disable: "Disable uploads",
      disableTooltip:
        "Stops future uploads and exits the app. Files already provided to the third-party page cannot be taken back.",
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
  },
  "zh-CN": {
    documentTitle: "Satisfactory Save Map Watcher",
    language: {
      label: "语言",
      tooltip: "切换界面语言。",
    },
    loading: {
      loading: "加载中",
      error: "错误",
    },
    consent: {
      appName: "Satisfactory Save Map Watcher",
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
      title: "地图监控",
      commandsLabel: "监控操作",
      start: "开始自动上传",
      startTooltip: "扫描存档目录，并自动上传新的存档。",
      stop: "暂停监控",
      stopTooltip: "停止自动监控。手动上传仍可使用。",
      upload: "上传最新存档",
      uploadTooltip: "上传当前检测到的最新存档来更新地图。",
      currentSaveLabel: "当前打开的存档",
      noSaveSelected: "未选择存档",
      disable: "禁用上传",
      disableTooltip: "停止后续上传并退出应用。已经提供给第三方页面的文件无法收回。",
      disableDialogTitle: "禁用上传并退出？",
      disableDialogDescription:
        "这会停止后续上传并退出应用。已经提供给第三方页面的存档文件无法收回。",
      cancel: "取消",
      confirm: "Confirm",
      needsAttention: "需要处理",
      actionNeeded: "需要处理",
      commandFailed: "命令失败",
      settingsNotSaved: "设置未保存",
      settingsNotSavedDetail: "应用无法保存权限设置。请在关闭前重试。",
    },
  },
};

export function getRendererCopy(language: AppLanguage): RendererCopy {
  return RENDERER_LANGUAGE_COPY[language];
}
