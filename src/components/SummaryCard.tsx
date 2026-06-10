import type { LucideIcon } from "lucide-react";

export function SummaryCard({
  label,
  value,
  icon: Icon,
  detail
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  detail?: string;
}) {
  return (
    <div className="surface p-5 transition hover:-translate-y-0.5 hover:border-public-blue-100 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">{label}</p>
          <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
          {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-sky-50 text-public-blue-700 ring-1 ring-sky-100">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
