import type { Rating } from "../../shared/types";

const ratingStyles: Record<Rating, string> = {
  A: "border-emerald-200 bg-emerald-50 text-emerald-800",
  B: "border-teal-200 bg-teal-50 text-teal-800",
  C: "border-amber-200 bg-amber-50 text-amber-800",
  D: "border-orange-200 bg-orange-50 text-orange-800",
  F: "border-red-200 bg-red-50 text-red-800"
};

export function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span
      className={`inline-flex min-w-10 items-center justify-center rounded-md border px-2.5 py-1 text-sm font-bold ${ratingStyles[rating]}`}
    >
      {rating}
    </span>
  );
}

export function StatusPill({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
    neutral: "border-slate-200 bg-slate-100 text-slate-700"
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase ${styles[tone]}`}
    >
      {label}
    </span>
  );
}
