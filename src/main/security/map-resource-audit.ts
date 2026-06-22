// abstract: Host allow-list policy and development request metadata logging for the remote map session.
// out_of_scope: Production telemetry, renderer-visible diagnostics, and content-level ad rewriting.

import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

type ResourceRequestAuditFilter = {
  urls: string[];
};

type ResourceRequestAuditCallback = (response: { cancel: boolean }) => void;

export const DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS = [
  "satisfactory-calculator.com",
  "static.satisfactory-calculator.com",
  "cdn.jsdelivr.net",
] as const;

export type MapResourcePolicyMode = "audit" | "allowlist";

export type ResourceRequestAuditDetails = {
  url: string;
  method?: string;
  resourceType?: string;
  frameId?: number;
  parentFrameId?: number;
  referrer?: string;
};

export type ResourceRequestAuditSession = {
  webRequest?: {
    onBeforeRequest: (
      filter: ResourceRequestAuditFilter,
      listener: (
        details: ResourceRequestAuditDetails,
        callback: ResourceRequestAuditCallback,
      ) => void,
    ) => void;
  };
};

type RegisterAuditOptions = {
  allowedHosts?: readonly string[];
  ensureDirectory?: (directoryPath: string) => void;
  mode?: MapResourcePolicyMode;
  now?: () => Date;
  writeLine?: (line: string) => void;
};

export type MapResourcePolicyConfig = {
  logPath?: string;
  mode: MapResourcePolicyMode;
};

export function getMapResourcePolicyConfig(options: {
  env: Partial<Record<string, string | undefined>>;
  isPackaged: boolean;
  userDataPath: string;
}): MapResourcePolicyConfig | undefined {
  if (options.isPackaged) {
    return { mode: "allowlist" };
  }
  return {
    logPath: path.join(options.userDataPath, "dev-map-resource-requests.ndjson"),
    mode: options.env.SATISFACTORY_MAP_RESOURCE_FILTER === "audit" ? "audit" : "allowlist",
  };
}

export function registerMapResourceRequestAudit(
  session: ResourceRequestAuditSession,
  logPath: string | undefined,
  options: RegisterAuditOptions = {},
): boolean {
  if (!session.webRequest) {
    return false;
  }

  const ensureDirectory =
    options.ensureDirectory ??
    ((directoryPath: string) => mkdirSync(directoryPath, { recursive: true }));
  const mode = options.mode ?? "audit";
  const allowedHosts = options.allowedHosts ?? DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS;
  const now = options.now ?? (() => new Date());
  const writeLine =
    options.writeLine ??
    (logPath ? (line: string) => appendFileSync(logPath, `${line}\n`, "utf8") : undefined);

  if (logPath) {
    try {
      ensureDirectory(path.dirname(logPath));
    } catch (error) {
      console.warn(
        "Map resource audit disabled because the log directory could not be created.",
        error,
      );
      return false;
    }
  }

  session.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
    const allowed = isAllowedMapResourceRequest(details, allowedHosts);
    const blocked = mode === "allowlist" && !allowed;
    if (writeLine) {
      try {
        writeLine(JSON.stringify(createAuditEntry(details, now(), mode, allowed, blocked)));
      } catch (error) {
        console.warn("Map resource audit could not write a request entry.", error);
      }
    }
    callback({ cancel: blocked });
  });

  return true;
}

export function isAllowedMapResourceRequest(
  details: ResourceRequestAuditDetails,
  allowedHosts: readonly string[] = DEFAULT_MAP_RESOURCE_ALLOWED_HOSTS,
): boolean {
  try {
    const url = new URL(details.url);
    return url.protocol === "https:" && allowedHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function createAuditEntry(
  details: ResourceRequestAuditDetails,
  timestamp: Date,
  mode: MapResourcePolicyMode,
  allowed: boolean,
  blocked: boolean,
) {
  const requestUrl = parseUrl(details.url);
  const referrerUrl = parseUrl(details.referrer);
  return {
    timestamp: timestamp.toISOString(),
    mode,
    decision: blocked ? "blocked" : mode === "allowlist" ? "allowed" : "observe",
    wouldAllowByAllowlist: allowed,
    method: details.method ?? "GET",
    resourceType: details.resourceType ?? "unknown",
    url: requestUrl.url,
    origin: requestUrl.origin,
    hostname: requestUrl.hostname,
    pathname: requestUrl.pathname,
    hasQuery: requestUrl.hasQuery,
    hasHash: requestUrl.hasHash,
    frameId: details.frameId ?? null,
    parentFrameId: details.parentFrameId ?? null,
    isMainFrame: details.resourceType === "mainFrame" || details.parentFrameId === -1,
    referrer: referrerUrl.url,
  };
}

function parseUrl(rawUrl: string | undefined): {
  url: string | null;
  origin: string | null;
  hostname: string | null;
  pathname: string | null;
  hasQuery: boolean;
  hasHash: boolean;
} {
  if (!rawUrl) {
    return {
      url: null,
      origin: null,
      hostname: null,
      pathname: null,
      hasQuery: false,
      hasHash: false,
    };
  }

  try {
    const url = new URL(rawUrl);
    return {
      url: `${url.protocol}//${url.host}${url.pathname}`,
      origin: url.origin,
      hostname: url.hostname,
      pathname: url.pathname,
      hasQuery: url.search.length > 0,
      hasHash: url.hash.length > 0,
    };
  } catch {
    return {
      url: rawUrl,
      origin: null,
      hostname: null,
      pathname: null,
      hasQuery: false,
      hasHash: false,
    };
  }
}
