// abstract: shadcn-style Collapsible wrappers for compact renderer disclosure panels.
// out_of_scope: Disclosure content selection and application command execution.

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";

export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleContent = CollapsiblePrimitive.Content;

export function CollapsibleTrigger({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger asChild {...props}>
      <Button
        className={cn(
          "h-auto justify-between border-transparent bg-transparent p-0 text-foreground hover:bg-transparent",
          className,
        )}
        variant="ghost"
      >
        <span>{children}</span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </Button>
    </CollapsiblePrimitive.Trigger>
  );
}
