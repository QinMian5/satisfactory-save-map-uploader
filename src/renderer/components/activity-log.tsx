// abstract: Bounded activity log presentation using the local ScrollArea primitive.
// out_of_scope: Log retention, state mutation, and Electron IPC.

import type { AppLogEntry } from "../../shared/state.js";
import { cn } from "../lib/utils.js";
import { ScrollArea } from "./ui/scroll-area.js";

type ActivityLogProps = {
  logs: AppLogEntry[];
};

export function ActivityLog({ logs }: ActivityLogProps) {
  return (
    <section className="mt-3">
      <h2 className="text-sm font-bold">Activity log</h2>
      <ScrollArea className="mt-2 h-56 rounded-lg bg-log text-log-foreground">
        <ol className="list-none p-3 font-mono text-xs leading-5">
          {logs.map((entry) => (
            <li
              className={cn(
                entry.level === "error" && "text-log-error",
                entry.level === "warn" && "text-log-warning",
              )}
              key={`${entry.timestamp}-${entry.level}-${entry.message}`}
            >
              [{entry.timestamp}] {entry.level.toUpperCase()} {entry.message}
            </li>
          ))}
        </ol>
      </ScrollArea>
    </section>
  );
}
