// abstract: shadcn-style alert primitives for compact renderer notices.
// out_of_scope: Alert selection logic and Electron command execution.

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

const alertVariants = cva("rounded-lg border border-l-4 bg-card p-3 text-card-foreground", {
  variants: {
    variant: {
      default: "border-border border-l-neutral-border",
      warning: "border-warning-muted-border border-l-warning-border",
      destructive: "border-destructive-border border-l-destructive-border",
      success: "border-success-border border-l-success-border",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-bold", className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />;
}
