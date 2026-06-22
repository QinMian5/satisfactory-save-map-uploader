// abstract: Revoked permission view.
// out_of_scope: Revocation persistence, watcher lifecycle, and upload cancellation.

import { RotateCcw, X } from "lucide-react";
import { Button } from "../components/ui/button.js";
import { Card, CardDescription } from "../components/ui/card.js";
import type { SatisfactoryAppCommands } from "../hooks/use-satisfactory-app.js";
import type { LockedViewModel } from "../view-model.js";

type LockedViewProps = {
  model: LockedViewModel;
  commands: Pick<SatisfactoryAppCommands, "acceptThirdPartyUpload" | "declineThirdPartyUpload">;
};

export function LockedView({ commands, model }: LockedViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="grid w-full max-w-2xl gap-4">
        <header>
          <span className="block text-xs font-bold uppercase text-muted-foreground">
            Satisfactory Save Map Watcher
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-normal">
            Upload permission is revoked
          </h1>
        </header>

        <Card>
          <CardDescription>{model.privacyNotice}</CardDescription>
          <p className="mt-3 text-sm font-semibold text-foreground">
            Revocation cannot take back a save file that was already provided to the third-party
            page.
          </p>
        </Card>

        <section className="flex gap-2">
          <Button disabled={model.isSaving} onClick={() => void commands.acceptThirdPartyUpload()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Allow uploads again
          </Button>
          <Button onClick={() => void commands.declineThirdPartyUpload()} variant="secondary">
            <X className="h-4 w-4" aria-hidden="true" />
            Exit
          </Button>
        </section>
      </section>
    </main>
  );
}
