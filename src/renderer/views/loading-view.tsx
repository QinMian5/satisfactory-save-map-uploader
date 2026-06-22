// abstract: Initial renderer loading/error view.
// out_of_scope: Electron IPC subscription and application state routing.

import { Badge } from "../components/ui/badge.js";
import { Card } from "../components/ui/card.js";

type LoadingViewProps = {
  error: string | null;
};

export function LoadingView({ error }: LoadingViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <Badge tone={error ? "error" : "working"}>{error ? "Error" : "Loading"}</Badge>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </Card>
    </main>
  );
}
