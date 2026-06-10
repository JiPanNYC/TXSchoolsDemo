import type { TrendPoint } from "../../shared/types";

const series = [
  { key: "overallScore", label: "Overall", color: "#1d4ed8" },
  { key: "readingScore", label: "Reading", color: "#0f766e" },
  { key: "mathScore", label: "Math", color: "#d97706" }
] as const;

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const width = 640;
  const height = 260;
  const padding = 36;
  const scoreValues = data.flatMap((point) => [
    point.overallScore,
    point.readingScore,
    point.mathScore
  ]);
  const minScore = Math.max(50, Math.min(...scoreValues) - 5);
  const maxScore = 100;
  const xStep = (width - padding * 2) / Math.max(1, data.length - 1);

  function pointToXY(point: TrendPoint, index: number, key: keyof TrendPoint) {
    const rawValue = Number(point[key]);
    const x = padding + index * xStep;
    const y =
      height -
      padding -
      ((rawValue - minScore) / (maxScore - minScore)) * (height - padding * 2);

    return { x, y };
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {series.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Three year score trend chart"
          className="h-auto w-full"
        >
          {[60, 70, 80, 90, 100].map((tick) => {
            const y =
              height -
              padding -
              ((tick - minScore) / (maxScore - minScore)) * (height - padding * 2);
            return (
              <g key={tick}>
                <line
                  x1={padding}
                  x2={width - padding}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[11px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}
          {data.map((point, index) => {
            const x = padding + index * xStep;
            return (
              <g key={point.year}>
                <line
                  x1={x}
                  x2={x}
                  y1={padding}
                  y2={height - padding}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-600 text-[12px] font-semibold"
                >
                  {point.year}
                </text>
              </g>
            );
          })}
          {series.map((item) => {
            const path = data
              .map((point, index) => {
                const { x, y } = pointToXY(point, index, item.key);
                return `${index === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ");

            return (
              <g key={item.key}>
                <path
                  d={path}
                  fill="none"
                  stroke={item.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                />
                {data.map((point, index) => {
                  const { x, y } = pointToXY(point, index, item.key);
                  return (
                    <circle
                      key={`${item.key}-${point.year}`}
                      cx={x}
                      cy={y}
                      r="5"
                      fill="#ffffff"
                      stroke={item.color}
                      strokeWidth="3"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
