// abstract: First-run third-party upload disclosure view.
// out_of_scope: Permission persistence, save scanning, and upload execution.

import { Check, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.js";
import { Button } from "../components/ui/button.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible.js";
import { Separator } from "../components/ui/separator.js";
import type { SatisfactoryAppCommands } from "../hooks/use-satisfactory-app.js";
import type { ConsentViewModel } from "../view-model.js";

type ConsentViewProps = {
  model: ConsentViewModel;
  commands: Pick<SatisfactoryAppCommands, "acceptThirdPartyUpload" | "declineThirdPartyUpload">;
};

export function ConsentView({ commands, model }: ConsentViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="grid w-full max-w-2xl gap-4">
        <header>
          <span className="block text-xs font-bold uppercase text-muted-foreground">
            Satisfactory Save Map Watcher
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-normal">
            Allow Satisfactory save uploads?
          </h1>
        </header>

        <Alert variant="warning">
          <AlertTitle>Uploads go to a third-party website</AlertTitle>
          <AlertDescription className="mt-2">
            This app can watch local Satisfactory .sav files only after you allow it. When the map
            is updated, the selected save file is provided to
            https://satisfactory-calculator.com/zh/interactive-map inside the application.
          </AlertDescription>
          <p className="mt-3 text-sm font-semibold text-foreground">
            Continue only with save files you are comfortable sharing with that third-party page.
          </p>
          <Separator className="my-3 bg-warning-muted-border" />
          <Collapsible>
            <CollapsibleTrigger>What can the site receive?</CollapsibleTrigger>
            <CollapsibleContent>
              <AlertDescription className="mt-2">
                The third-party page may receive the save file contents, file name, file-processing
                metadata, IP address, and normal web request information. This project is not
                affiliated with, authorized by, or endorsed by Satisfactory, Coffee Stain, or
                Satisfactory Calculator. The app developer does not receive or store save files and
                does not include analytics or telemetry. The third-party site's own privacy policy
                and terms apply, and site changes can break uploads.
              </AlertDescription>
            </CollapsibleContent>
          </Collapsible>
        </Alert>

        <section className="flex gap-2">
          <Button disabled={model.isSaving} onClick={() => void commands.acceptThirdPartyUpload()}>
            <Check className="h-4 w-4" aria-hidden="true" />
            Allow uploads
          </Button>
          <Button onClick={() => void commands.declineThirdPartyUpload()} variant="secondary">
            <X className="h-4 w-4" aria-hidden="true" />
            Not now, exit
          </Button>
        </section>
      </section>
    </main>
  );
}
