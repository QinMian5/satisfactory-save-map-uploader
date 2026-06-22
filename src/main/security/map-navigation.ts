// abstract: Navigation allow-list rules for the remote Satisfactory Calculator map window.
// out_of_scope: BrowserWindow construction, permission prompts, and external shell handling.

const ALLOWED_MAP_ORIGIN = "https://satisfactory-calculator.com";
const ALLOWED_MAP_HOSTNAME = "satisfactory-calculator.com";

export function isAllowedMapNavigation(targetUrl: string, isMainFrame: boolean): boolean {
  return createMapNavigationPolicy(ALLOWED_MAP_ORIGIN)(targetUrl, isMainFrame);
}

export function createMapNavigationPolicy(
  allowedOrigin: string,
): (targetUrl: string, isMainFrame: boolean) => boolean {
  const allowed = new URL(allowedOrigin);
  return (targetUrl, isMainFrame) => {
    if (!isMainFrame) {
      return true;
    }

    try {
      const url = new URL(targetUrl);
      return (
        url.protocol === allowed.protocol &&
        url.origin === allowed.origin &&
        url.hostname === allowed.hostname &&
        url.username === "" &&
        url.password === "" &&
        isExpectedPort(url, allowed)
      );
    } catch {
      return false;
    }
  };
}

function isExpectedPort(url: URL, allowed: URL): boolean {
  if (allowed.origin === ALLOWED_MAP_ORIGIN) {
    return url.port === "" || url.port === "443";
  }
  return url.port === allowed.port;
}

export function isAllowedProductionMapNavigation(targetUrl: string, isMainFrame: boolean): boolean {
  if (!isMainFrame) {
    return true;
  }

  try {
    const url = new URL(targetUrl);
    return (
      url.protocol === "https:" &&
      url.origin === ALLOWED_MAP_ORIGIN &&
      url.hostname === ALLOWED_MAP_HOSTNAME &&
      url.username === "" &&
      url.password === "" &&
      (url.port === "" || url.port === "443")
    );
  } catch {
    return false;
  }
}
