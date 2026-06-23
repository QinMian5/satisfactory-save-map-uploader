// abstract: Renderer localization registry and runtime message formatter.
// out_of_scope: Language preference persistence and main-process message production.

import type { LocalizedMessage } from "../../shared/i18n-messages.js";
import { type AppLanguage, DEFAULT_APP_LANGUAGE } from "../../shared/language.js";
import { EN_RENDERER_COPY, EN_RUNTIME_MESSAGE_TEMPLATES } from "./en.js";
import type { RendererCopy, RuntimeMessageTemplates } from "./types.js";
import { ZH_CN_RENDERER_COPY, ZH_CN_RUNTIME_MESSAGE_TEMPLATES } from "./zh-cn.js";

export type { RendererCopy, RuntimeMessageTemplates } from "./types.js";

export const RENDERER_LANGUAGE_COPY: Record<AppLanguage, RendererCopy> = {
  en: EN_RENDERER_COPY,
  "zh-CN": ZH_CN_RENDERER_COPY,
};

export const RUNTIME_MESSAGE_TEMPLATES: Record<AppLanguage, RuntimeMessageTemplates> = {
  en: EN_RUNTIME_MESSAGE_TEMPLATES,
  "zh-CN": ZH_CN_RUNTIME_MESSAGE_TEMPLATES,
};

export function getRendererCopy(language: AppLanguage): RendererCopy {
  return RENDERER_LANGUAGE_COPY[language];
}

export function formatLocalizedMessage(language: AppLanguage, message: LocalizedMessage): string {
  const templates =
    RUNTIME_MESSAGE_TEMPLATES[language] ?? RUNTIME_MESSAGE_TEMPLATES[DEFAULT_APP_LANGUAGE];
  const template =
    templates[message.key] ?? RUNTIME_MESSAGE_TEMPLATES[DEFAULT_APP_LANGUAGE][message.key];
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const value = message.params?.[key];
    return value === null || value === undefined ? "" : String(value);
  });
}
