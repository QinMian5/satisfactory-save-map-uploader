// abstract: Compact uploader dashboard toolbar.
// out_of_scope: Electron IPC, save scanning, and upload implementation.

import { Pause, Play, ShieldOff, Upload } from "lucide-react";
import type * as React from "react";
import type { AppLanguage } from "../../shared/state.js";
import { LanguageSwitcher } from "../components/language-switcher.js";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip.js";
import type { SatisfactoryAppCommands } from "../hooks/use-satisfactory-app.js";
import type { RendererCopy } from "../i18n.js";
import type { DashboardViewModel } from "../view-model.js";

type DashboardViewProps = {
  model: DashboardViewModel;
  copy: RendererCopy;
  language: AppLanguage;
  commands: Pick<
    SatisfactoryAppCommands,
    "disableUploadsAndExit" | "setLanguage" | "startWatcher" | "stopWatcher" | "uploadLatestSave"
  >;
};

export function DashboardView({ commands, copy, language, model }: DashboardViewProps) {
  return (
    <main className="min-h-screen w-[var(--layout-sidebar-width)] border-r border-border bg-background p-4 text-foreground">
      <section className="flex min-h-[calc(100vh-32px)] flex-col gap-3">
        <TooltipProvider>
          <header className="flex items-center justify-between gap-3">
            <h1 className="text-[22px] font-bold leading-tight tracking-normal">
              {copy.dashboard.title}
            </h1>
            <LanguageSwitcher
              copy={copy.language}
              language={language}
              onLanguageChange={(nextLanguage) => void commands.setLanguage(nextLanguage)}
            />
          </header>

          <section aria-label={copy.dashboard.commandsLabel} className="flex flex-col gap-2">
            {model.showStartButton ? (
              <CommandTooltip description={copy.dashboard.startTooltip}>
                <Button disabled={model.startDisabled} onClick={() => void commands.startWatcher()}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {copy.dashboard.start}
                </Button>
              </CommandTooltip>
            ) : null}
            {model.showStopButton ? (
              <CommandTooltip description={copy.dashboard.stopTooltip}>
                <Button disabled={model.stopDisabled} onClick={() => void commands.stopWatcher()}>
                  <Pause className="h-4 w-4" aria-hidden="true" />
                  {copy.dashboard.stop}
                </Button>
              </CommandTooltip>
            ) : null}
            <CommandTooltip description={copy.dashboard.uploadTooltip}>
              <Button
                disabled={model.uploadDisabled}
                onClick={() => void commands.uploadLatestSave()}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {copy.dashboard.upload}
              </Button>
            </CommandTooltip>
          </section>

          <SummaryCard label={copy.dashboard.currentSaveLabel} title={model.latestSaveTitle} />

          <AlertDialog>
            <CommandTooltip description={copy.dashboard.disableTooltip}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <ShieldOff className="h-4 w-4" aria-hidden="true" />
                  {copy.dashboard.disable}
                </Button>
              </AlertDialogTrigger>
            </CommandTooltip>
            <AlertDialogContent className="left-4 w-[calc(var(--layout-sidebar-width)_-_32px)] translate-x-0">
              <AlertDialogHeader>
                <AlertDialogTitle>{copy.dashboard.disableDialogTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {copy.dashboard.disableDialogDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{copy.dashboard.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void commands.disableUploadsAndExit()}>
                  {copy.dashboard.confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TooltipProvider>

        {model.showIssue ? (
          <Alert role="alert" variant="destructive">
            <span className="block text-xs font-bold uppercase text-destructive">
              {copy.dashboard.needsAttention}
            </span>
            <AlertTitle className="mt-2">{model.issueTitle}</AlertTitle>
            {model.issueDetail ? <AlertDescription>{model.issueDetail}</AlertDescription> : null}
          </Alert>
        ) : null}
      </section>
    </main>
  );
}

type CommandTooltipProps = {
  children: React.ReactNode;
  description: string;
};

function CommandTooltip({ children, description }: CommandTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}
