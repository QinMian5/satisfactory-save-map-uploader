// abstract: First-run third-party upload disclosure view.
// out_of_scope: Permission persistence, save scanning, and upload execution.

import { Check, X } from "lucide-react";
import type { AppLanguage } from "../../shared/state.js";
import { LanguageSwitcher } from "../components/language-switcher.js";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.js";
import { Button } from "../components/ui/button.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible.js";
import { Separator } from "../components/ui/separator.js";
import { TooltipProvider } from "../components/ui/tooltip.js";
import type { SatisfactoryAppCommands } from "../hooks/use-satisfactory-app.js";
import type { RendererCopy } from "../i18n.js";
import type { ConsentViewModel } from "../view-model.js";

type ConsentViewProps = {
  model: ConsentViewModel;
  copy: RendererCopy;
  language: AppLanguage;
  commands: Pick<
    SatisfactoryAppCommands,
    "acceptThirdPartyUpload" | "declineThirdPartyUpload" | "setLanguage"
  >;
};

export function ConsentView({ commands, copy, language, model }: ConsentViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="grid w-full max-w-2xl gap-4">
        <TooltipProvider>
          <header className="flex items-start justify-between gap-4">
            <div>
              <span className="block text-xs font-bold uppercase text-muted-foreground">
                {copy.consent.appName}
              </span>
              <h1 className="mt-2 text-2xl font-bold leading-tight tracking-normal">
                {copy.consent.title}
              </h1>
            </div>
            <LanguageSwitcher
              copy={copy.language}
              language={language}
              onLanguageChange={(nextLanguage) => void commands.setLanguage(nextLanguage)}
            />
          </header>
        </TooltipProvider>

        {model.showIssue ? (
          <Alert role="alert" variant="destructive">
            <AlertTitle>{model.issueTitle}</AlertTitle>
            {model.issueDetail ? <AlertDescription>{model.issueDetail}</AlertDescription> : null}
          </Alert>
        ) : null}

        <Alert variant="warning">
          <AlertTitle>{copy.consent.warningTitle}</AlertTitle>
          <AlertDescription className="mt-2">{copy.consent.warningDescription}</AlertDescription>
          <Separator className="my-3 bg-warning-muted-border" />
          <Collapsible>
            <CollapsibleTrigger>{copy.consent.detailsTrigger}</CollapsibleTrigger>
            <CollapsibleContent>
              <AlertDescription className="mt-2">{copy.consent.details}</AlertDescription>
            </CollapsibleContent>
          </Collapsible>
        </Alert>

        <section className="flex gap-2">
          <Button disabled={model.isSaving} onClick={() => void commands.acceptThirdPartyUpload()}>
            <Check className="h-4 w-4" aria-hidden="true" />
            {copy.consent.allow}
          </Button>
          <Button onClick={() => void commands.declineThirdPartyUpload()} variant="secondary">
            <X className="h-4 w-4" aria-hidden="true" />
            {copy.consent.decline}
          </Button>
        </section>
      </section>
    </main>
  );
}
