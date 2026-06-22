// abstract: Small status badge primitive for the local React renderer.
// out_of_scope: Application state mapping, Electron IPC, and layout containers.

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "border-border bg-card text-muted-foreground",
        working: "border-warning-muted-border bg-warning-background text-warning",
        success: "border-success-border bg-success-background text-success",
        warning: "border-warning-muted-border bg-warning-background text-warning",
        error: "border-destructive-border bg-destructive-background text-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
