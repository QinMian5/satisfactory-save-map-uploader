// abstract: Supported application languages and Satisfactory Calculator locale URLs.
// out_of_scope: Renderer copy, preference persistence, and Electron window loading.

const SATISFACTORY_CALCULATOR_ORIGIN = "https://satisfactory-calculator.com";

export type AppLanguageDefinition = {
  code: string;
  nativeName: string;
  mapPath: `/${string}/interactive-map`;
};

export const APP_LANGUAGE_REGISTRY = {
  en: {
    code: "en",
    nativeName: "English",
    mapPath: "/en/interactive-map",
  },
  "zh-CN": {
    code: "zh-CN",
    nativeName: "中文",
    mapPath: "/zh/interactive-map",
  },
} as const satisfies Record<string, AppLanguageDefinition>;

export type AppLanguage = keyof typeof APP_LANGUAGE_REGISTRY;

export const DEFAULT_APP_LANGUAGE: AppLanguage = "en";

export const SUPPORTED_APP_LANGUAGES = Object.keys(APP_LANGUAGE_REGISTRY) as AppLanguage[];

export function getMapUrlForLanguage(language: AppLanguage): string {
  return new URL(
    APP_LANGUAGE_REGISTRY[language].mapPath,
    SATISFACTORY_CALCULATOR_ORIGIN,
  ).toString();
}

export function isSupportedAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && SUPPORTED_APP_LANGUAGES.includes(value as AppLanguage);
}
