// abstract: Primary watcher/upload status card for the compact toolbar.
// out_of_scope: State derivation, Electron IPC, and upload automation.

import type { WatcherStatus } from "../../shared/state.js";
import type { PrimaryStatusCopy } from "../view-model.js";
import { Alert, AlertTitle } from "./ui/alert.js";
import { Badge } from "./ui/badge.js";

type StatusCardProps = {
  status: PrimaryStatusCopy;
  watcherStatus: WatcherStatus;
};

export function StatusCard({ status, watcherStatus }: StatusCardProps) {
  return (
    <Alert aria-live="polite" variant={getAlertVariant(status.tone)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase text-muted-foreground">Status</span>
        <Badge tone={status.tone}>{watcherStatus}</Badge>
      </div>
      <AlertTitle className="mt-2 text-lg">{status.title}</AlertTitle>
    </Alert>
  );
}

function getAlertVariant(
  tone: PrimaryStatusCopy["tone"],
): "default" | "warning" | "destructive" | "success" {
  if (tone === "success") {
    return "success";
  }
  if (tone === "warning" || tone === "working") {
    return "warning";
  }
  if (tone === "error") {
    return "destructive";
  }
  return "default";
}
