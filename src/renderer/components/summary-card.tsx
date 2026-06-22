// abstract: Small label/value card for dashboard summary facts.
// out_of_scope: Summary state derivation and command execution.

import { Card } from "./ui/card.js";

type SummaryCardProps = {
  label: string;
  title: string;
};

export function SummaryCard({ label, title }: SummaryCardProps) {
  return (
    <Card>
      <span className="block text-xs font-bold uppercase text-muted-foreground">{label}</span>
      <strong className="mt-2 block break-words text-base">{title}</strong>
    </Card>
  );
}
