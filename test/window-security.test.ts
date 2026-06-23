// abstract: Tests for Electron window security options and map navigation rules.
// out_of_scope: Real Electron BrowserWindow construction and network requests.

import { describe, expect, it } from "vitest";
import {
  createMapNavigationPolicy,
  isAllowedMapNavigation,
} from "../src/main/security/map-navigation.js";
import { denyAllWebPermissions } from "../src/main/security/permissions.js";
import {
  createMapViewOptions,
  createMapWindowOptions,
  createStatusWindowOptions,
} from "../src/main/security/window-options.js";

describe("window security options", () => {
  it("locks down the status window", () => {
    expect(createStatusWindowOptions("C:\\app\\preload.js").autoHideMenuBar).toBe(true);
    expect(createStatusWindowOptions("C:\\app\\preload.js").webPreferences).toMatchObject({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      preload: "C:\\app\\preload.js",
    });
  });

  it("locks down the map window without preload", () => {
    expect(createMapWindowOptions().webPreferences).toMatchObject({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      backgroundThrottling: false,
      partition: "map",
    });
    expect(createMapWindowOptions().webPreferences).not.toHaveProperty("preload");
  });

  it("locks down the embedded map view without preload", () => {
    expect(createMapViewOptions().webPreferences).toMatchObject({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      backgroundThrottling: false,
      partition: "map",
    });
    expect(createMapViewOptions().webPreferences).not.toHaveProperty("preload");
  });
});

describe("map navigation", () => {
  it("allows only Satisfactory Calculator HTTPS main-frame navigation", () => {
    expect(
      isAllowedMapNavigation("https://satisfactory-calculator.com/zh/interactive-map", true),
    ).toBe(true);
    expect(
      isAllowedMapNavigation("https://satisfactory-calculator.com/en/interactive-map", true),
    ).toBe(true);
    expect(
      isAllowedMapNavigation("http://satisfactory-calculator.com/zh/interactive-map", true),
    ).toBe(false);
    expect(isAllowedMapNavigation("https://satisfactory-calculator.com.evil.example", true)).toBe(
      false,
    );
    expect(
      isAllowedMapNavigation(
        "https://user:pass@satisfactory-calculator.com/zh/interactive-map",
        true,
      ),
    ).toBe(false);
    expect(
      isAllowedMapNavigation("https://satisfactory-calculator.com:443/zh/interactive-map", true),
    ).toBe(true);
    expect(
      isAllowedMapNavigation("https://satisfactory-calculator.com:444/zh/interactive-map", true),
    ).toBe(false);
    expect(isAllowedMapNavigation("https://example.com", true)).toBe(false);
  });

  it("does not block subframe ad navigation through the main-frame gate", () => {
    expect(isAllowedMapNavigation("https://ads.example.com/frame", false)).toBe(true);
  });

  it("allows loopback navigation only through an explicit integration navigation policy", () => {
    const policy = createMapNavigationPolicy("http://127.0.0.1:49152");

    expect(policy("http://127.0.0.1:49152/fixture?token=abc", true)).toBe(true);
    expect(policy("http://127.0.0.1:49153/fixture?token=abc", true)).toBe(false);
    expect(policy("https://satisfactory-calculator.com/zh/interactive-map", true)).toBe(false);
    expect(isAllowedMapNavigation("http://127.0.0.1:49152/fixture?token=abc", true)).toBe(false);
  });
});

describe("permission handlers", () => {
  it("denies permission requests and checks by default", () => {
    let requestHandler:
      | ((_webContents: unknown, permission: string, callback: (allowed: boolean) => void) => void)
      | undefined;
    let checkHandler:
      | ((
          _webContents: unknown,
          permission: string,
          requestingOrigin: string,
          details: unknown,
        ) => boolean)
      | undefined;

    denyAllWebPermissions({
      setPermissionRequestHandler: (handler) => {
        requestHandler = handler;
      },
      setPermissionCheckHandler: (handler) => {
        checkHandler = handler;
      },
    });

    let callbackCount = 0;
    let granted = true;
    requestHandler?.({}, "media", (allowed) => {
      callbackCount += 1;
      granted = allowed;
    });

    expect(callbackCount).toBe(1);
    expect(granted).toBe(false);
    expect(checkHandler?.({}, "media", "https://satisfactory-calculator.com", {})).toBe(false);
  });
});
