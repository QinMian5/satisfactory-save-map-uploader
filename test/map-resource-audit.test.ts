// abstract: Tests for development-only map resource request auditing.
// out_of_scope: Real Electron sessions, network requests, and resource blocking policy.

import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS,
  getMapResourcePolicyConfig,
  isAllowedMapResourceRequest,
  type ResourceRequestAuditDetails,
  registerMapResourceRequestAudit,
} from "../src/main/security/map-resource-audit.js";

describe("map resource request audit", () => {
  it("registers a non-blocking request logger with sanitized resource metadata", () => {
    let listener:
      | ((
          details: ResourceRequestAuditDetails,
          callback: (response: { cancel: boolean }) => void,
        ) => void)
      | undefined;
    const writeLine = vi.fn();
    const ensureDirectory = vi.fn();
    const logPath = path.join("C:\\Users\\tester\\AppData\\Roaming\\app", "map.ndjson");

    const registered = registerMapResourceRequestAudit(
      {
        webRequest: {
          onBeforeRequest: (_filter, handler) => {
            listener = handler;
          },
        },
      },
      logPath,
      {
        ensureDirectory,
        mode: "audit",
        now: () => new Date("2026-06-20T12:00:00.000Z"),
        writeLine,
      },
    );

    expect(registered).toBe(true);
    expect(ensureDirectory).toHaveBeenCalledWith(path.dirname(logPath));

    const callback = vi.fn();
    listener?.(
      {
        url: "https://visitor-programmaticx.omnitagjs.com/visitor/bsync?uid=secret#fragment",
        method: "GET",
        resourceType: "image",
        frameId: 12,
        parentFrameId: 1,
        referrer: "https://satisfactory-calculator.com/zh/interactive-map?session=secret",
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ cancel: false });
    const entry = JSON.parse(writeLine.mock.calls[0]?.[0] ?? "{}");
    expect(entry).toMatchObject({
      timestamp: "2026-06-20T12:00:00.000Z",
      mode: "audit",
      decision: "observe",
      wouldAllowByAllowlist: false,
      method: "GET",
      resourceType: "image",
      url: "https://visitor-programmaticx.omnitagjs.com/visitor/bsync",
      origin: "https://visitor-programmaticx.omnitagjs.com",
      hostname: "visitor-programmaticx.omnitagjs.com",
      pathname: "/visitor/bsync",
      hasQuery: true,
      hasHash: true,
      frameId: 12,
      parentFrameId: 1,
      isMainFrame: false,
      referrer: "https://satisfactory-calculator.com/zh/interactive-map",
    });
  });

  it("blocks requests outside the map resource allowlist in allowlist mode", () => {
    let listener:
      | ((
          details: ResourceRequestAuditDetails,
          callback: (response: { cancel: boolean }) => void,
        ) => void)
      | undefined;
    const writeLine = vi.fn();

    registerMapResourceRequestAudit(
      {
        webRequest: {
          onBeforeRequest: (_filter, handler) => {
            listener = handler;
          },
        },
      },
      "C:\\app\\map.ndjson",
      {
        ensureDirectory: vi.fn(),
        mode: "allowlist",
        now: () => new Date("2026-06-20T12:00:00.000Z"),
        writeLine,
      },
    );

    const callback = vi.fn();
    listener?.(
      {
        url: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
        method: "GET",
        resourceType: "script",
        frameId: 4,
        parentFrameId: 1,
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ cancel: true });
    expect(JSON.parse(writeLine.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
      mode: "allowlist",
      decision: "blocked",
      wouldAllowByAllowlist: false,
      hostname: "pagead2.googlesyndication.com",
    });
  });

  it("can enforce allowlist mode without writing a log", () => {
    let listener:
      | ((
          details: ResourceRequestAuditDetails,
          callback: (response: { cancel: boolean }) => void,
        ) => void)
      | undefined;
    const ensureDirectory = vi.fn();

    registerMapResourceRequestAudit(
      {
        webRequest: {
          onBeforeRequest: (_filter, handler) => {
            listener = handler;
          },
        },
      },
      undefined,
      {
        ensureDirectory,
        mode: "allowlist",
      },
    );

    const callback = vi.fn();
    listener?.(
      {
        url: "https://www.googletagmanager.com/gtag/js",
        method: "GET",
        resourceType: "script",
      },
      callback,
    );

    expect(ensureDirectory).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({ cancel: true });
  });

  it("allows exact Satisfactory Calculator resource hosts and rejects deceptive hostnames", () => {
    expect(
      isAllowedMapResourceRequest(
        { url: "https://satisfactory-calculator.com/zh/interactive-map" },
        DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS,
      ),
    ).toBe(true);
    expect(
      isAllowedMapResourceRequest(
        { url: "https://static.satisfactory-calculator.com/js/app.js" },
        DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS,
      ),
    ).toBe(true);
    expect(
      isAllowedMapResourceRequest(
        { url: "https://cdn.jsdelivr.net/npm/js-cookie@2/src/js.cookie.min.js" },
        DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS,
      ),
    ).toBe(true);
    expect(
      isAllowedMapResourceRequest(
        { url: "https://www.googletagmanager.com/gtag/js" },
        DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS,
      ),
    ).toBe(false);
    expect(
      isAllowedMapResourceRequest(
        { url: "https://hb.vntsm.com/v4/live/vms/sites/satisfactory-calculator.com/index.js" },
        DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS,
      ),
    ).toBe(false);
    expect(
      isAllowedMapResourceRequest(
        { url: "https://satisfactory-calculator.com.evil.example/js/app.js" },
        DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS,
      ),
    ).toBe(false);
    expect(
      isAllowedMapResourceRequest(
        { url: "http://satisfactory-calculator.com/zh/interactive-map" },
        DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS,
      ),
    ).toBe(false);
  });

  it("does not register when the session cannot observe web requests", () => {
    const registered = registerMapResourceRequestAudit({}, "C:\\app\\map.ndjson", {
      ensureDirectory: vi.fn(),
      writeLine: vi.fn(),
    });

    expect(registered).toBe(false);
  });

  it("uses allowlist blocking by default and allows explicit development audit logging", () => {
    expect(
      getMapResourcePolicyConfig({
        env: {},
        isPackaged: false,
        userDataPath: "C:\\Users\\tester\\AppData\\Roaming\\Satisfactory Save Map Watcher",
      }),
    ).toEqual({
      logPath:
        "C:\\Users\\tester\\AppData\\Roaming\\Satisfactory Save Map Watcher\\dev-map-resource-requests.ndjson",
      mode: "allowlist",
    });

    expect(
      getMapResourcePolicyConfig({
        env: { SATISFACTORY_MAP_RESOURCE_FILTER: "audit" },
        isPackaged: false,
        userDataPath: "C:\\Users\\tester\\AppData\\Roaming\\Satisfactory Save Map Watcher",
      }),
    ).toEqual({
      logPath:
        "C:\\Users\\tester\\AppData\\Roaming\\Satisfactory Save Map Watcher\\dev-map-resource-requests.ndjson",
      mode: "audit",
    });

    expect(
      getMapResourcePolicyConfig({
        env: { SATISFACTORY_MAP_RESOURCE_FILTER: "allowlist" },
        isPackaged: true,
        userDataPath: "C:\\Users\\tester\\AppData\\Roaming\\Satisfactory Save Map Watcher",
      }),
    ).toEqual({ mode: "allowlist" });
  });
});
