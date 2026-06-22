// abstract: Tests for supported app languages and map locale URLs.
// out_of_scope: Renderer component rendering, Electron IPC, and third-party site availability.

import { describe, expect, it } from "vitest";
import { RENDERER_LANGUAGE_COPY } from "../src/renderer/i18n.js";
import {
  APP_LANGUAGE_REGISTRY,
  DEFAULT_APP_LANGUAGE,
  getMapUrlForLanguage,
  SUPPORTED_APP_LANGUAGES,
} from "../src/shared/language.js";

describe("language registry", () => {
  it("defines supported UI languages and their map locale URLs in one registry", () => {
    expect(DEFAULT_APP_LANGUAGE).toBe("en");
    expect(SUPPORTED_APP_LANGUAGES).toEqual(["en", "zh-CN"]);
    expect(Object.keys(APP_LANGUAGE_REGISTRY)).toEqual([...SUPPORTED_APP_LANGUAGES]);
    expect(APP_LANGUAGE_REGISTRY.en).toMatchObject({
      nativeName: "English",
      mapPath: "/en/interactive-map",
    });
    expect(APP_LANGUAGE_REGISTRY["zh-CN"]).toMatchObject({
      nativeName: "中文",
      mapPath: "/zh/interactive-map",
    });
  });

  it("builds the Satisfactory Calculator map URL for each selected language", () => {
    expect(getMapUrlForLanguage("en")).toBe(
      "https://satisfactory-calculator.com/en/interactive-map",
    );
    expect(getMapUrlForLanguage("zh-CN")).toBe(
      "https://satisfactory-calculator.com/zh/interactive-map",
    );
  });

  it("keeps renderer copy registered for every supported language", () => {
    expect(Object.keys(RENDERER_LANGUAGE_COPY)).toEqual([...SUPPORTED_APP_LANGUAGES]);
    for (const language of SUPPORTED_APP_LANGUAGES) {
      expect(RENDERER_LANGUAGE_COPY[language].documentTitle).toBeTruthy();
      expect(RENDERER_LANGUAGE_COPY[language].language.label).toBeTruthy();
    }
    expect(RENDERER_LANGUAGE_COPY.en.consent.warningDescription).toContain(
      getMapUrlForLanguage("en"),
    );
    expect(RENDERER_LANGUAGE_COPY["zh-CN"].consent.warningDescription).toContain(
      getMapUrlForLanguage("zh-CN"),
    );
  });
});
