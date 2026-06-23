// abstract: Tests for Electron app lifecycle decisions that can run without a real Electron app.
// out_of_scope: Real BrowserWindow instances, renderer behavior, and package installation.

import { describe, expect, it, vi } from "vitest";
import {
  acquireSingleInstanceLock,
  configureBackgroundRenderingSwitches,
  focusExistingStatusWindow,
  hasIntegrationTestArg,
  hasIntegrationTestSwitch,
  hasSmokeTestArg,
  hasSmokeTestSwitch,
} from "../src/main/lifecycle.js";

describe("lifecycle helpers", () => {
  it("detects smoke-test mode from argv without treating other args as smoke tests", () => {
    expect(hasSmokeTestArg(["app.exe", "--smoke-test"])).toBe(true);
    expect(hasSmokeTestArg(["app.exe", "--smoke-test-extra"])).toBe(false);
    expect(hasSmokeTestArg(["app.exe"])).toBe(false);
  });

  it("detects smoke-test mode from Electron command-line switches", () => {
    expect(hasSmokeTestSwitch({ hasSwitch: (name) => name === "smoke-test" })).toBe(true);
    expect(hasSmokeTestSwitch({ hasSwitch: () => false })).toBe(false);
  });

  it("detects integration-test mode without treating related args as the mode switch", () => {
    expect(hasIntegrationTestArg(["app.exe", "--integration-test-upload"])).toBe(true);
    expect(hasIntegrationTestArg(["app.exe", "--integration-url=http://127.0.0.1:49152/"])).toBe(
      false,
    );
    expect(
      hasIntegrationTestSwitch({ hasSwitch: (name) => name === "integration-test-upload" }),
    ).toBe(true);
    expect(hasIntegrationTestSwitch({ hasSwitch: () => false })).toBe(false);
  });

  it("disables Chromium occluded-window backgrounding on Windows", () => {
    const appendSwitch = vi.fn();

    configureBackgroundRenderingSwitches({ appendSwitch }, "win32");

    expect(appendSwitch).toHaveBeenCalledWith("disable-backgrounding-occluded-windows");
  });

  it("does not append Windows-only rendering switches on other platforms", () => {
    const appendSwitch = vi.fn();

    configureBackgroundRenderingSwitches({ appendSwitch }, "linux");

    expect(appendSwitch).not.toHaveBeenCalled();
  });

  it("quits immediately when the single-instance lock is unavailable", () => {
    const quit = vi.fn();

    const acquired = acquireSingleInstanceLock({
      requestSingleInstanceLock: () => false,
      quit,
    });

    expect(acquired).toBe(false);
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("restores and focuses an existing status window for a second instance", () => {
    const restore = vi.fn();
    const show = vi.fn();
    const focus = vi.fn();

    const focused = focusExistingStatusWindow({
      isDestroyed: () => false,
      isMinimized: () => true,
      isVisible: () => false,
      restore,
      show,
      focus,
    });

    expect(focused).toBe(true);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("does not focus a destroyed or missing status window", () => {
    const focus = vi.fn();

    expect(focusExistingStatusWindow(undefined)).toBe(false);
    expect(
      focusExistingStatusWindow({
        isDestroyed: () => true,
        isMinimized: () => false,
        isVisible: () => true,
        restore: vi.fn(),
        show: vi.fn(),
        focus,
      }),
    ).toBe(false);
    expect(focus).not.toHaveBeenCalled();
  });
});
