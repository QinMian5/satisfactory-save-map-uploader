// abstract: Card-framed disclosure panel built from Radix Collapsible.
// out_of_scope: Disclosure content and app command behavior.

import type * as React from "react";
import { Card } from "./ui/card.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible.js";

type PanelDisclosureProps = {
  title: string;
  children: React.ReactNode;
};

export function PanelDisclosure({ children, title }: PanelDisclosureProps) {
  return (
    <Card>
      <Collapsible>
        <CollapsibleTrigger>{title}</CollapsibleTrigger>
        <CollapsibleContent className="mt-3">{children}</CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
