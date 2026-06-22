// abstract: Tests for IPC channel names and status-window sender validation.
// out_of_scope: Electron runtime handlers and renderer DOM behavior.

import { describe, expect, it } from "vitest";
import { assertTrustedSender, isTrustedSender } from "../src/main/ipc/sender-validation.js";
import { IPC_CHANNELS } from "../src/shared/ipc.js";

describe("IPC channels", () => {
  it("centralizes the renderer command and state channels", () => {
    expect(IPC_CHANNELS).toEqual({
      acceptThirdPartyUpload: "satisfactory:accept-third-party-upload",
      declineThirdPartyUpload: "satisfactory:decline-third-party-upload",
      getDisclosure: "satisfactory:get-disclosure",
      getState: "satisfactory:get-state",
      revokeThirdPartyUpload: "satisfactory:revoke-third-party-upload",
      startWatcher: "satisfactory:start-watcher",
      stopWatcher: "satisfactory:stop-watcher",
      uploadLatestSave: "satisfactory:upload-latest-save",
      openMap: "satisfactory:open-map",
      stateChanged: "satisfactory:state-changed",
    });
  });
});

describe("sender validation", () => {
  it("accepts the status window sender", () => {
    const frame = {};
    const sender = { id: 42, mainFrame: frame, isDestroyed: () => false };
    expect(isTrustedSender({ sender, senderFrame: frame }, sender)).toBe(true);
  });

  it("rejects unknown senders", () => {
    const frame = {};
    const trustedSender = { id: 42, mainFrame: frame, isDestroyed: () => false };
    const mapSenderWithSameId = { id: 42, mainFrame: frame, isDestroyed: () => false };
    expect(
      isTrustedSender({ sender: mapSenderWithSameId, senderFrame: frame }, trustedSender),
    ).toBe(false);
    expect(() => assertTrustedSender({ sender: { id: 7 } }, trustedSender)).toThrow(
      "Rejected IPC message from untrusted sender.",
    );
  });

  it("rejects a mismatched sender frame and a destroyed status window", () => {
    const frame = {};
    const sender = { id: 42, mainFrame: frame, isDestroyed: () => false };
    expect(isTrustedSender({ sender, senderFrame: {} }, sender)).toBe(false);

    const destroyedSender = { id: 42, mainFrame: frame, isDestroyed: () => true };
    expect(isTrustedSender({ sender: destroyedSender, senderFrame: frame }, destroyedSender)).toBe(
      false,
    );
  });
});
