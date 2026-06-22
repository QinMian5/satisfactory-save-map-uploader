// abstract: Permission-denial setup for Electron sessions used by application windows.
// out_of_scope: Navigation filtering, BrowserWindow construction, and renderer IPC policy.

type PermissionRequestHandler = (
  webContents: unknown,
  permission: string,
  callback: (permissionGranted: boolean) => void,
) => void;

type PermissionCheckHandler = (
  webContents: unknown,
  permission: string,
  requestingOrigin: string,
  details: unknown,
) => boolean;

export type PermissionSession = {
  setPermissionRequestHandler: (handler: PermissionRequestHandler | null) => void;
  setPermissionCheckHandler: (handler: PermissionCheckHandler | null) => void;
  clearStorageData?: () => Promise<void>;
  clearCache?: () => Promise<void>;
};

export function denyAllWebPermissions(session: PermissionSession): void {
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.setPermissionCheckHandler(() => false);
}

export function clearWebPermissionHandlers(session: PermissionSession | undefined): void {
  if (!session) {
    return;
  }
  session.setPermissionRequestHandler(null);
  session.setPermissionCheckHandler(null);
}
