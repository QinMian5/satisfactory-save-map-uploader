// abstract: Pure Electron lifecycle helpers for startup, smoke mode, and second-instance behavior.
// out_of_scope: BrowserWindow construction, service wiring, and renderer IPC implementation.

export type SingleInstanceAppPort = {
  requestSingleInstanceLock: () => boolean;
  quit: () => void;
};

export type FocusableStatusWindow = {
  isDestroyed: () => boolean;
  isMinimized: () => boolean;
  isVisible: () => boolean;
  restore: () => void;
  show: () => void;
  focus: () => void;
};

export type CommandLinePort = {
  hasSwitch: (name: string) => boolean;
};

export function hasSmokeTestArg(argv: readonly string[]): boolean {
  return argv.includes("--smoke-test");
}

export function hasSmokeTestSwitch(commandLine: CommandLinePort): boolean {
  return commandLine.hasSwitch("smoke-test");
}

export function hasIntegrationTestArg(argv: readonly string[]): boolean {
  return argv.includes("--integration-test-upload");
}

export function hasIntegrationTestSwitch(commandLine: CommandLinePort): boolean {
  return commandLine.hasSwitch("integration-test-upload");
}

export function acquireSingleInstanceLock(app: SingleInstanceAppPort): boolean {
  const acquired = app.requestSingleInstanceLock();
  if (!acquired) {
    app.quit();
  }
  return acquired;
}

export function focusExistingStatusWindow(window: FocusableStatusWindow | undefined): boolean {
  if (!window || window.isDestroyed()) {
    return false;
  }

  if (window.isMinimized()) {
    window.restore();
  }
  if (!window.isVisible()) {
    window.show();
  }
  window.focus();
  return true;
}
