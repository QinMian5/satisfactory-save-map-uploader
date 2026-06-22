// abstract: Compact watcher dashboard toolbar.
// out_of_scope: Electron IPC, save scanning, and upload implementation.

import { Pause, Play, ShieldOff, Upload } from "lucide-react";
import { ActivityLog } from "../components/activity-log.js";
import { DataField } from "../components/data-field.js";
import { PanelDisclosure } from "../components/panel-disclosure.js";
import { StatusCard } from "../components/status-card.js";
import { SummaryCard } from "../components/summary-card.js";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog.js";
import { Button } from "../components/ui/button.js";
import type { SatisfactoryAppCommands } from "../hooks/use-satisfactory-app.js";
import type { DashboardViewModel } from "../view-model.js";

type DashboardViewProps = {
  model: DashboardViewModel;
  commands: Pick<
    SatisfactoryAppCommands,
    "revokeThirdPartyUpload" | "startWatcher" | "stopWatcher" | "uploadLatestSave"
  >;
};

export function DashboardView({ commands, model }: DashboardViewProps) {
  return (
    <main className="min-h-screen w-[300px] border-r border-border bg-background p-4 text-foreground">
      <section className="flex min-h-[calc(100vh-32px)] flex-col gap-3">
        <header>
          <h1 className="text-[22px] font-bold leading-tight tracking-normal">Map watcher</h1>
        </header>

        <StatusCard status={model.primaryStatus} watcherStatus={model.watcherStatus} />

        <section aria-label="Watcher commands" className="flex flex-col gap-2">
          {model.showStartButton ? (
            <Button disabled={model.startDisabled} onClick={() => void commands.startWatcher()}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Start watching
            </Button>
          ) : null}
          {model.showStopButton ? (
            <Button
              disabled={model.stopDisabled}
              onClick={() => void commands.stopWatcher()}
              variant="secondary"
            >
              <Pause className="h-4 w-4" aria-hidden="true" />
              Pause watching
            </Button>
          ) : null}
          <Button disabled={model.uploadDisabled} onClick={() => void commands.uploadLatestSave()}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload now
          </Button>
        </section>

        <SummaryCard label="Latest save" title={model.latestSaveTitle} />
        <SummaryCard label="Last map update" title={model.lastUpdateTitle} />

        {model.showIssue ? (
          <Alert role="alert" variant="destructive">
            <span className="block text-xs font-bold uppercase text-destructive">
              Needs attention
            </span>
            <AlertTitle className="mt-2">{model.issueTitle}</AlertTitle>
            {model.issueDetail ? <AlertDescription>{model.issueDetail}</AlertDescription> : null}
          </Alert>
        ) : null}

        <PanelDisclosure title="Permission">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <ShieldOff className="h-4 w-4" aria-hidden="true" />
                Disable uploads
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable third-party uploads?</AlertDialogTitle>
                <AlertDialogDescription>
                  This stops future uploads, but cannot take back a save file already provided to
                  the third-party page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void commands.revokeThirdPartyUpload()}>
                  Disable uploads
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </PanelDisclosure>

        <PanelDisclosure title="Troubleshooting details">
          <section className="grid gap-2">
            {model.diagnostics.map((field) => (
              <DataField key={field.label} label={field.label} value={field.value} />
            ))}
          </section>
          <ActivityLog logs={model.logs} />
        </PanelDisclosure>
      </section>
    </main>
  );
}
