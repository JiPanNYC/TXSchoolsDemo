import {
  Activity,
  BarChart3,
  BrainCircuit,
  ChartScatter,
  Maximize2,
  Network,
  Sigma,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AnalyticsBucket,
  AnalyticsResponse,
  AnalyticsScatterPoint,
  AnalyticsScatterSeries,
  ClusterSummary,
  DistrictAnalytics,
  FeatureCorrelation,
  FeatureImportance,
  ModelPrediction,
  Rating
} from "../../shared/types";
import { fetchAnalytics } from "../api/client";
import { RatingBadge, StatusPill } from "../components/RatingBadge";
import { ErrorState, LoadingState } from "../components/StateBlocks";
import { SummaryCard } from "../components/SummaryCard";
import { currencyFormatter, formatDateTime } from "../lib/format";

const ratingColors: Record<Rating, string> = {
  A: "#047857",
  B: "#0f766e",
  C: "#d97706",
  D: "#ea580c",
  F: "#dc2626"
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [expandedScatter, setExpandedScatter] = useState<AnalyticsScatterSeries | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalytics() {
    setLoading(true);
    setError(null);
    try {
      setAnalytics(await fetchAnalytics());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Analytics failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <LoadingState label="Running analytics model" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          message={error ?? "Analytics response was empty."}
          onRetry={loadAnalytics}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-public-blue-100 bg-white p-5 shadow-soft sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="label text-public-blue-700">Internal Analytics Lab</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
              Machine Learning and Data Analysis
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Explore public aggregate school data with district aggregation,
              correlation analysis, peer clustering, and a boosted-tree-style score
              model.
            </p>
          </div>
          <StatusPill label={`${analytics.sampleSize} records`} tone="info" />
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Model"
          value={analytics.model.modelName}
          icon={BrainCircuit}
          detail={analytics.model.target}
        />
        <SummaryCard
          label="Holdout MAE"
          value={analytics.model.mae}
          icon={Activity}
          detail={`${analytics.model.testRows} test records`}
        />
        <SummaryCard
          label="Holdout R2"
          value={analytics.model.r2}
          icon={Sigma}
          detail={`${analytics.model.trainingRows} training records`}
        />
        <SummaryCard
          label="Generated"
          value={formatDateTime(analytics.generatedAt)}
          icon={BarChart3}
          detail="Server-side analytics API"
        />
      </section>

      <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        {analytics.modelNotice} For a production ML story, use the full public school
        dataset, historical releases, lagged features, and formal model monitoring.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="surface p-5" aria-labelledby="importance-heading">
          <p className="label">Model Explainability</p>
          <h2 id="importance-heading" className="mt-1 text-xl font-bold text-ink">
            Feature Importance
          </h2>
          <div className="mt-5 space-y-4">
            {analytics.model.featureImportance.map((feature) => (
              <FeatureBar key={feature.feature} feature={feature} />
            ))}
          </div>
        </section>

        <section className="surface p-5" aria-labelledby="correlation-heading">
          <p className="label">Correlation Analysis</p>
          <h2 id="correlation-heading" className="mt-1 text-xl font-bold text-ink">
            Relationship to Overall Score
          </h2>
          <div className="mt-5 space-y-4">
            {analytics.correlations.map((item) => (
              <CorrelationRow key={item.feature} item={item} />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-3" aria-label="Scatter plots">
        {analytics.scatter.map((series) => (
          <ScatterPlot
            key={series.id}
            series={series}
            onExpand={() => setExpandedScatter(series)}
          />
        ))}
      </section>

      {expandedScatter ? (
        <ScatterPlotModal
          series={expandedScatter}
          onClose={() => setExpandedScatter(null)}
        />
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="surface p-5" aria-labelledby="rating-heading">
          <p className="label">Aggregate Distribution</p>
          <h2 id="rating-heading" className="mt-1 text-xl font-bold text-ink">
            Ratings and Grade Levels
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-1">
            <BucketChart
              title="Accountability Ratings"
              data={analytics.ratingDistribution}
            />
            <BucketChart title="Grade Levels" data={analytics.gradeDistribution} />
          </div>
        </section>

        <section className="surface p-5" aria-labelledby="district-model-heading">
          <p className="label">District Aggregation</p>
          <h2 id="district-model-heading" className="mt-1 text-xl font-bold text-ink">
            District Performance Snapshot
          </h2>
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-100">
                <tr>
                  <HeaderCell>District</HeaderCell>
                  <HeaderCell>Avg score</HeaderCell>
                  <HeaderCell>Attendance</HeaderCell>
                  <HeaderCell>Need</HeaderCell>
                  <HeaderCell>Spend</HeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {analytics.districtAnalytics.map((district) => (
                  <DistrictRow key={district.district} district={district} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-6" aria-labelledby="cluster-heading">
        <div className="mb-4 flex items-center gap-3">
          <Network aria-hidden="true" className="h-5 w-5 text-public-blue-700" />
          <div>
            <p className="label">Unsupervised Learning</p>
            <h2 id="cluster-heading" className="text-xl font-bold text-ink">
              Peer Clusters
            </h2>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {analytics.clusters.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} />
          ))}
        </div>
      </section>

      <section className="surface mt-6 p-5" aria-labelledby="prediction-heading">
        <div className="flex items-center gap-3">
          <ChartScatter aria-hidden="true" className="h-5 w-5 text-public-blue-700" />
          <div>
            <p className="label">Model Output</p>
            <h2 id="prediction-heading" className="text-xl font-bold text-ink">
              Lowest Predicted Scores
            </h2>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:hidden">
          {analytics.model.predictions.map((prediction) => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))}
        </div>
        <div className="mt-5 hidden overflow-hidden rounded-lg border border-slate-200 lg:block">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100">
              <tr>
                <HeaderCell>School</HeaderCell>
                <HeaderCell>Actual</HeaderCell>
                <HeaderCell>Predicted</HeaderCell>
                <HeaderCell>Residual</HeaderCell>
                <HeaderCell>Tier</HeaderCell>
                <HeaderCell>Top factors</HeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {analytics.model.predictions.map((prediction) => (
                <PredictionRow key={prediction.id} prediction={prediction} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FeatureBar({ feature }: { feature: FeatureImportance }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{feature.label}</span>
        <span className="text-sm font-bold text-ink">{feature.importance}%</span>
      </div>
      <div className="h-3 rounded-full bg-slate-200">
        <div
          className="h-3 rounded-full bg-public-blue-700"
          style={{ width: `${feature.importance}%` }}
        />
      </div>
    </div>
  );
}

function CorrelationRow({ item }: { item: FeatureCorrelation }) {
  const width = Math.min(100, Math.abs(item.correlation) * 100);
  const color =
    item.direction === "positive"
      ? "bg-emerald-600"
      : item.direction === "negative"
        ? "bg-red-600"
        : "bg-slate-500";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{item.label}</span>
        <span className="text-sm font-bold text-ink">{item.correlation}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-200">
        <div className={`h-3 rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ScatterPlot({
  series,
  onExpand
}: {
  series: AnalyticsScatterSeries;
  onExpand: () => void;
}) {
  return (
    <section className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">{series.xLabel}</p>
          <h3 className="mt-1 text-lg font-bold text-ink">{series.title}</h3>
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-public-blue-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50"
          onClick={onExpand}
          aria-label={`Enlarge ${series.title}`}
          title="Enlarge chart"
        >
          <Maximize2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 rounded-md border border-transparent p-1 transition hover:border-sky-200 hover:bg-sky-50">
        <ScatterSvg series={series} width={520} height={300} pointRadius={5} />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">
        Hover a point for school details. Use the expand button for a larger view.
      </p>
    </section>
  );
}

function ScatterPlotModal({
  series,
  onClose
}: {
  series: AnalyticsScatterSeries;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scatter-modal-heading"
      onClick={onClose}
    >
      <section
        className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-lg bg-white p-4 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label text-public-blue-700">{series.xLabel}</p>
            <h2 id="scatter-modal-heading" className="mt-1 text-2xl font-bold text-ink">
              {series.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Larger view of public aggregate school-level points by accountability
              rating.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            onClick={onClose}
            aria-label="Close enlarged chart"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <ScatterSvg series={series} width={1040} height={560} pointRadius={8} />
        </div>
      </section>
    </div>
  );
}

function ScatterSvg({
  series,
  width,
  height,
  pointRadius
}: {
  series: AnalyticsScatterSeries;
  width: number;
  height: number;
  pointRadius: number;
}) {
  const [activePoint, setActivePoint] = useState<{
    point: AnalyticsScatterPoint;
    x: number;
    y: number;
  } | null>(null);
  const padding = 42;
  const xs = series.points.map((point) => point.x);
  const ys = series.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.max(50, Math.min(...ys) - 5);
  const maxY = 100;

  function scaleX(value: number) {
    return (
      padding + ((value - minX) / Math.max(1, maxX - minX)) * (width - padding * 2)
    );
  }

  function scaleY(value: number) {
    return (
      height -
      padding -
      ((value - minY) / Math.max(1, maxY - minY)) * (height - padding * 2)
    );
  }

  const tooltipWidth = Math.min(width - padding * 2, width >= 800 ? 360 : 270);
  const tooltipHeight = 108;
  const tooltipX = activePoint
    ? Math.min(
        Math.max(activePoint.x + 14, padding / 2),
        width - tooltipWidth - padding / 2
      )
    : 0;
  const preferredTooltipY =
    activePoint && activePoint.y - tooltipHeight - 12 >= padding
      ? activePoint.y - tooltipHeight - 12
      : (activePoint?.y ?? 0) + 18;
  const tooltipY = activePoint
    ? Math.min(
        Math.max(preferredTooltipY, padding / 2),
        height - tooltipHeight - padding / 2
      )
    : 0;
  const tooltipNameLimit = width >= 800 ? 52 : 32;
  const tooltipDistrictLimit = width >= 800 ? 58 : 34;

  return (
    <svg
      className="h-auto w-full"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={series.title}
    >
      {[60, 70, 80, 90, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={padding}
            x2={width - padding}
            y1={scaleY(tick)}
            y2={scaleY(tick)}
            stroke="#e2e8f0"
          />
          <text
            x={padding - 8}
            y={scaleY(tick) + 4}
            textAnchor="end"
            className="fill-slate-500 text-[11px]"
          >
            {tick}
          </text>
        </g>
      ))}
      <line
        x1={padding}
        x2={padding}
        y1={padding}
        y2={height - padding}
        stroke="#cbd5e1"
      />
      <line
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
        stroke="#cbd5e1"
      />
      {series.points.map((point) => {
        const cx = scaleX(point.x);
        const cy = scaleY(point.y);
        const isActive = activePoint?.point.id === point.id;

        return (
          <circle
            key={point.id}
            cx={cx}
            cy={cy}
            r={isActive ? pointRadius + 2 : pointRadius}
            fill={ratingColors[point.rating]}
            opacity={isActive ? "1" : "0.82"}
            stroke={isActive ? "#0f172a" : "#ffffff"}
            strokeWidth={isActive ? 2.5 : 1}
            className="cursor-pointer outline-none transition"
            tabIndex={0}
            aria-label={`${point.name}, ${point.district}, rating ${point.rating}, ${series.yLabel} ${point.y}`}
            onMouseEnter={() => setActivePoint({ point, x: cx, y: cy })}
            onMouseOver={() => setActivePoint({ point, x: cx, y: cy })}
            onMouseLeave={() => setActivePoint(null)}
            onPointerEnter={() => setActivePoint({ point, x: cx, y: cy })}
            onPointerLeave={() => setActivePoint(null)}
            onFocus={() => setActivePoint({ point, x: cx, y: cy })}
            onBlur={() => setActivePoint(null)}
            onClick={(event) => {
              event.stopPropagation();
              setActivePoint({ point, x: cx, y: cy });
            }}
          >
            <title>{`${point.name} - ${point.district}: ${point.y}`}</title>
          </circle>
        );
      })}
      {activePoint ? (
        <g pointerEvents="none">
          <rect
            x={tooltipX}
            y={tooltipY}
            width={tooltipWidth}
            height={tooltipHeight}
            rx="8"
            fill="#ffffff"
            stroke="#bfdbfe"
            strokeWidth="1.5"
            filter="drop-shadow(0 10px 18px rgba(15, 23, 42, 0.18))"
          />
          <text
            x={tooltipX + 14}
            y={tooltipY + 24}
            className="fill-slate-950 text-[13px] font-bold"
          >
            {shorten(activePoint.point.name, tooltipNameLimit)}
          </text>
          <text
            x={tooltipX + 14}
            y={tooltipY + 45}
            className="fill-slate-600 text-[11px] font-semibold"
          >
            {shorten(
              `${activePoint.point.district} - ${activePoint.point.city}`,
              tooltipDistrictLimit
            )}
          </text>
          <text
            x={tooltipX + 14}
            y={tooltipY + 70}
            className="fill-slate-700 text-[11px] font-semibold"
          >
            Rating {activePoint.point.rating} · {series.yLabel}: {activePoint.point.y}
          </text>
          <text
            x={tooltipX + 14}
            y={tooltipY + 91}
            className="fill-public-blue-800 text-[11px] font-bold"
          >
            {series.xLabel}: {formatScatterValue(activePoint.point.x, series.xLabel)}
          </text>
        </g>
      ) : null}
      <text
        x={width / 2}
        y={height - 8}
        textAnchor="middle"
        className="fill-slate-600 text-[11px] font-semibold"
      >
        {series.xLabel}
      </text>
      <text
        x={14}
        y={height / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${height / 2})`}
        className="fill-slate-600 text-[11px] font-semibold"
      >
        {series.yLabel}
      </text>
    </svg>
  );
}

function shorten(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}...`;
}

function formatScatterValue(value: number, label: string) {
  if (label.toLowerCase().includes("expenditure")) {
    return currencyFormatter(value);
  }

  if (label.includes("%")) {
    return `${value}%`;
  }

  return value.toLocaleString("en-US");
}

function BucketChart({ title, data }: { title: string; data: AnalyticsBucket[] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <div className="mt-3 space-y-3">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">{item.label}</span>
              <span className="text-slate-600">
                {item.count} records · avg {item.averageScore}
              </span>
            </div>
            <div className="h-3 rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-teal-600"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistrictRow({ district }: { district: DistrictAnalytics }) {
  return (
    <tr>
      <td className="px-4 py-3 text-sm font-bold text-ink">
        {district.district}
        <span className="block text-xs font-semibold text-slate-500">
          {district.schoolCount} schools · {district.city}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-bold text-public-blue-800">
        {district.averageScore}
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        {district.averageAttendance}%
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        {district.averageEconomicDisadvantaged}%
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        {currencyFormatter(district.averageExpenditure)}
      </td>
    </tr>
  );
}

function ClusterCard({ cluster }: { cluster: ClusterSummary }) {
  return (
    <article className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">{cluster.schoolCount} schools</p>
          <h3 className="mt-1 text-lg font-bold text-ink">{cluster.label}</h3>
        </div>
        <span className="text-2xl font-bold text-public-blue-800">
          {cluster.averageScore}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{cluster.profile}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Metric label="Need" value={`${cluster.averageEconomicDisadvantaged}%`} />
        <Metric label="Attend" value={`${cluster.averageAttendance}%`} />
        <Metric label="Spend" value={currencyFormatter(cluster.averageExpenditure)} />
      </div>
      <div className="mt-4 space-y-2">
        {cluster.schools.map((school) => (
          <div
            key={school.id}
            className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{school.name}</p>
              <p className="truncate text-xs text-slate-500">{school.district}</p>
            </div>
            <RatingBadge rating={school.rating} />
          </div>
        ))}
      </div>
    </article>
  );
}

function PredictionRow({ prediction }: { prediction: ModelPrediction }) {
  return (
    <tr>
      <td className="px-4 py-3 text-sm font-bold text-ink">
        {prediction.name}
        <span className="block text-xs font-semibold text-slate-500">
          {prediction.district}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{prediction.actualScore}</td>
      <td className="px-4 py-3 text-sm font-bold text-public-blue-800">
        {prediction.predictedScore}
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{prediction.residual}</td>
      <td className="px-4 py-3">
        <StatusPill label={prediction.riskTier} tone={tierTone(prediction.riskTier)} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {prediction.topFactors.join(", ")}
      </td>
    </tr>
  );
}

function PredictionCard({ prediction }: { prediction: ModelPrediction }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-ink">{prediction.name}</p>
          <p className="text-sm text-slate-600">{prediction.district}</p>
        </div>
        <StatusPill label={prediction.riskTier} tone={tierTone(prediction.riskTier)} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Actual" value={prediction.actualScore} />
        <Metric label="Predicted" value={prediction.predictedScore} />
        <Metric label="Residual" value={prediction.residual} />
      </div>
      <p className="mt-3 text-sm text-slate-600">{prediction.topFactors.join(", ")}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
      <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-ink">{value}</p>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">
      {children}
    </th>
  );
}

function tierTone(tier: ModelPrediction["riskTier"]) {
  if (tier === "High-performing") {
    return "success";
  }

  if (tier === "Stable") {
    return "info";
  }

  if (tier === "Watch") {
    return "warning";
  }

  return "danger";
}
