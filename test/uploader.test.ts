// abstract: Tests for Playwright browser options used by the map uploader.
// out_of_scope: Live browser automation and third-party map behavior.

import { describe, expect, it } from "vitest";
import { getBrowserContextOptions, getBrowserLaunchOptions } from "../src/uploader.js";

describe("browser options", () => {
  it("uses the real browser window viewport so resizing changes the page", () => {
    expect(getBrowserContextOptions()).toEqual({ viewport: null });
  });

  it("starts Chromium maximized", () => {
    expect(getBrowserLaunchOptions()).toMatchObject({ headless: false });
    expect(getBrowserLaunchOptions().args).toContain("--start-maximized");
  });
});
