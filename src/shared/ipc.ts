// abstract: IPC channel names and renderer API contracts shared across Electron boundaries.
// out_of_scope: IPC handler registration, sender validation, and renderer DOM updates.

import type { AppStateSnapshot, DisclosureSnapshot } from "./state.js";

export const IPC_CHANNELS = {
  getState: "satisfactory:get-state",
  getDisclosure: "satisfactory:get-disclosure",
  acceptThirdPartyUpload: "satisfactory:accept-third-party-upload",
  declineThirdPartyUpload: "satisfactory:decline-third-party-upload",
  revokeThirdPartyUpload: "satisfactory:revoke-third-party-upload",
  startWatcher: "satisfactory:start-watcher",
  stopWatcher: "satisfactory:stop-watcher",
  uploadLatestSave: "satisfactory:upload-latest-save",
  openMap: "satisfactory:open-map",
  stateChanged: "satisfactory:state-changed",
} as const;

export type SatisfactoryRendererApi = {
  getState: () => Promise<AppStateSnapshot>;
  getDisclosure: () => Promise<DisclosureSnapshot>;
  acceptThirdPartyUpload: () => Promise<AppStateSnapshot>;
  declineThirdPartyUpload: () => Promise<AppStateSnapshot>;
  revokeThirdPartyUpload: () => Promise<AppStateSnapshot>;
  startWatcher: () => Promise<AppStateSnapshot>;
  stopWatcher: () => Promise<AppStateSnapshot>;
  uploadLatestSave: () => Promise<AppStateSnapshot>;
  openMap: () => Promise<AppStateSnapshot>;
  onStateChanged: (listener: (state: AppStateSnapshot) => void) => () => void;
};
