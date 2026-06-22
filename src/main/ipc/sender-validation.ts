// abstract: Sender validation helpers for status-window-only IPC calls.
// out_of_scope: IPC channel registration, renderer APIs, and Electron window construction.

type SenderLike = {
  id: number;
  isDestroyed?: () => boolean;
  mainFrame?: unknown;
};

type IpcEventLike = {
  sender: SenderLike;
  senderFrame?: unknown;
};

export function isTrustedSender(event: IpcEventLike, statusWindowWebContents: SenderLike): boolean {
  if (event.sender !== statusWindowWebContents) {
    return false;
  }
  if (statusWindowWebContents.isDestroyed?.()) {
    return false;
  }
  if (
    statusWindowWebContents.mainFrame &&
    event.senderFrame &&
    event.senderFrame !== statusWindowWebContents.mainFrame
  ) {
    return false;
  }
  return true;
}

export function assertTrustedSender(
  event: IpcEventLike,
  statusWindowWebContents: SenderLike,
): void {
  if (!isTrustedSender(event, statusWindowWebContents)) {
    throw new Error("Rejected IPC message from untrusted sender.");
  }
}
