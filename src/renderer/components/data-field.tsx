// abstract: Compact diagnostic label/value field.
// out_of_scope: Diagnostic field selection and state mutation.

type DataFieldProps = {
  label: string;
  value: string;
};

export function DataField({ label, value }: DataFieldProps) {
  return (
    <div className="rounded-md border border-border bg-muted p-2">
      <span className="block text-xs font-bold uppercase text-muted-foreground">{label}</span>
      <strong className="mt-1 block break-words text-sm">{value}</strong>
    </div>
  );
}
