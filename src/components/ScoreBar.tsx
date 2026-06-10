export function ScoreBar({
  label,
  value,
  tone = "blue"
}: {
  label: string;
  value: number;
  tone?: "blue" | "teal" | "amber";
}) {
  const color = {
    blue: "bg-public-blue-700",
    teal: "bg-teal-600",
    amber: "bg-amber-500"
  }[tone];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-sm font-bold text-ink">{value}</span>
      </div>
      <div
        className="h-3 rounded-full bg-slate-200"
        role="progressbar"
        aria-label={`${label} score`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div className={`h-3 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
