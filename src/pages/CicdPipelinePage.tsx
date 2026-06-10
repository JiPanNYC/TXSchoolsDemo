import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  GitCommit,
  Play,
  Rocket,
  RotateCcw,
  ShieldCheck,
  ThumbsUp,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { StatusPill } from "../components/RatingBadge";
import { SummaryCard } from "../components/SummaryCard";
import { formatDateTime } from "../lib/format";

type PipelineStatus = "Pending" | "Running" | "Passed" | "Failed" | "Skipped";

interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStatus;
  explanation: string;
  timestamp: string | null;
  duration: string;
}

interface ReleaseSummary {
  productionVersion: string;
  candidateVersion: string;
  commitHash: string;
  buildNumber: string;
  environment: "Development" | "Staging" | "Production";
  lastDeploymentTime: string;
}

const initialStages: PipelineStage[] = [
  {
    id: "commit",
    name: "Code Commit",
    status: "Pending",
    explanation: "Feature branch merged with release notes and reviewer sign-off.",
    timestamp: null,
    duration: "--"
  },
  {
    id: "build",
    name: "Build",
    status: "Pending",
    explanation: "Compile TypeScript, bundle React assets, and package the API.",
    timestamp: null,
    duration: "--"
  },
  {
    id: "unit-tests",
    name: "Unit Tests",
    status: "Pending",
    explanation: "Run frontend and API tests for query logic and analytics behavior.",
    timestamp: null,
    duration: "--"
  },
  {
    id: "data-validation",
    name: "Data Validation",
    status: "Pending",
    explanation:
      "Check missing records, duplicates, outliers, timestamps, and ranking logic.",
    timestamp: null,
    duration: "--"
  },
  {
    id: "security-scan",
    name: "Security Scan",
    status: "Pending",
    explanation: "Run dependency audit, secret scan, and API surface checks.",
    timestamp: null,
    duration: "--"
  },
  {
    id: "staging",
    name: "Staging Deployment",
    status: "Pending",
    explanation:
      "Deploy candidate build to staging with production-like configuration.",
    timestamp: null,
    duration: "--"
  },
  {
    id: "approval",
    name: "Business Approval",
    status: "Pending",
    explanation:
      "Program owner reviews release notes, validation evidence, and preview data.",
    timestamp: null,
    duration: "--"
  },
  {
    id: "production",
    name: "Production Deployment",
    status: "Pending",
    explanation:
      "Promote the approved candidate release to the public production environment.",
    timestamp: null,
    duration: "--"
  },
  {
    id: "health",
    name: "Health Check",
    status: "Pending",
    explanation:
      "Verify API health, search responses, asset delivery, and monitoring signals.",
    timestamp: null,
    duration: "--"
  },
  {
    id: "rollback",
    name: "Rollback Ready",
    status: "Pending",
    explanation:
      "Confirm previous release package and database version can be restored.",
    timestamp: null,
    duration: "--"
  }
];

const durationByStage: Record<string, string> = {
  commit: "12s",
  build: "1m 42s",
  "unit-tests": "58s",
  "data-validation": "1m 18s",
  "security-scan": "2m 04s",
  staging: "1m 36s",
  approval: "Pending",
  production: "Pending",
  health: "Pending",
  rollback: "Pending"
};

const automatedStageIds = [
  "commit",
  "build",
  "unit-tests",
  "data-validation",
  "security-scan",
  "staging"
];

const initialSummary: ReleaseSummary = {
  productionVersion: "2026-05",
  candidateVersion: "2026-06",
  commitHash: "9f4a7c2",
  buildNumber: "build-2026.06.108",
  environment: "Staging",
  lastDeploymentTime: "2026-06-01T16:15:19.000Z"
};

export default function CicdPipelinePage() {
  const [stages, setStages] = useState(initialStages);
  const [summary, setSummary] = useState(initialSummary);
  const [notice, setNotice] = useState(
    "Pipeline is ready. Run the mocked release workflow to evaluate gates."
  );
  const timersRef = useRef<number[]>([]);

  const qualityGates = useMemo(() => buildQualityGates(stages), [stages]);
  const hasFailedGate = stages.some((stage) => stage.status === "Failed");
  const isApproved = stageStatus(stages, "approval") === "Passed";
  const isProductionReady =
    !hasFailedGate &&
    isApproved &&
    stageStatus(stages, "staging") === "Passed" &&
    stageStatus(stages, "production") !== "Passed";
  const canApprove =
    !hasFailedGate &&
    stageStatus(stages, "staging") === "Passed" &&
    stageStatus(stages, "approval") !== "Passed";
  const canRollback = stageStatus(stages, "rollback") === "Passed";

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = [];
    };
  }, []);

  function clearPipelineTimers() {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
  }

  function runPipeline() {
    clearPipelineTimers();
    const now = new Date();
    setStages(
      initialStages.map((stage) => ({
        ...stage,
        status: "Pending",
        timestamp: null,
        duration: durationByStage[stage.id] ?? "--"
      }))
    );
    setSummary({
      ...initialSummary,
      environment: "Staging",
      buildNumber: "build-2026.06.109",
      commitHash: "a81c4f0"
    });
    setNotice("Pipeline is running automated gates through staging.");

    automatedStageIds.forEach((stageId, index) => {
      const runTimer = window.setTimeout(() => {
        setStages((current) =>
          current.map((stage) =>
            stage.id === stageId
              ? {
                  ...stage,
                  status: "Running",
                  timestamp: timestampFrom(now, index),
                  duration: "Running"
                }
              : stage
          )
        );
      }, index * 450);

      const passTimer = window.setTimeout(
        () => {
          setStages((current) =>
            current.map((stage) =>
              stage.id === stageId
                ? {
                    ...stage,
                    status: "Passed",
                    timestamp: timestampFrom(now, index),
                    duration: durationByStage[stage.id]
                  }
                : stage
            )
          );

          if (index === automatedStageIds.length - 1) {
            setNotice(
              "Pipeline completed through staging. Business approval is required."
            );
          }
        },
        index * 450 + 280
      );

      timersRef.current.push(runTimer, passTimer);
    });
  }

  function simulateFailure(stageId: "unit-tests" | "data-validation") {
    clearPipelineTimers();
    const now = new Date();
    const failedIndex = initialStages.findIndex((stage) => stage.id === stageId);

    setStages(
      initialStages.map((stage, index) => {
        if (index < failedIndex) {
          return {
            ...stage,
            status: "Passed",
            timestamp: timestampFrom(now, index),
            duration: durationByStage[stage.id]
          };
        }

        if (index === failedIndex) {
          return {
            ...stage,
            status: "Failed",
            timestamp: timestampFrom(now, index),
            duration: stageId === "unit-tests" ? "21s" : "39s"
          };
        }

        return {
          ...stage,
          status: "Skipped",
          timestamp: null,
          duration: "--"
        };
      })
    );
    setSummary({
      ...initialSummary,
      environment: "Development",
      buildNumber: "build-2026.06.109",
      commitHash: stageId === "unit-tests" ? "c17be91" : "d44f10a"
    });
    setNotice(
      stageId === "unit-tests"
        ? "Unit test failure stopped the release before staging."
        : "Data validation failure blocked deployment to protect public reporting data."
    );
  }

  function approveRelease() {
    clearPipelineTimers();
    if (!canApprove) {
      setNotice(
        "Approval requires a clean staging pipeline with no failed quality gates."
      );
      return;
    }

    setStages((current) =>
      current.map((stage) =>
        stage.id === "approval"
          ? {
              ...stage,
              status: "Passed",
              timestamp: new Date().toISOString(),
              duration: "14m 20s"
            }
          : stage
      )
    );
    setNotice("Business approval recorded. Production deployment is now available.");
  }

  function deployToProduction() {
    clearPipelineTimers();
    if (!isProductionReady) {
      setNotice("Production deployment requires passed gates and business approval.");
      return;
    }

    const now = new Date();
    setStages((current) =>
      current.map((stage) => {
        if (stage.id === "production") {
          return {
            ...stage,
            status: "Passed",
            timestamp: timestampFrom(now, 0),
            duration: "1m 28s"
          };
        }

        if (stage.id === "health") {
          return {
            ...stage,
            status: "Passed",
            timestamp: timestampFrom(now, 1),
            duration: "45s"
          };
        }

        if (stage.id === "rollback") {
          return {
            ...stage,
            status: "Passed",
            timestamp: timestampFrom(now, 2),
            duration: "18s"
          };
        }

        return stage;
      })
    );
    setSummary((current) => ({
      ...current,
      productionVersion: current.candidateVersion,
      candidateVersion: "2026-07",
      environment: "Production",
      lastDeploymentTime: now.toISOString()
    }));
    setNotice(
      "Production deployment completed. Health checks passed and rollback is ready."
    );
  }

  function rollBack() {
    clearPipelineTimers();
    if (!canRollback) {
      setNotice("Rollback package is not ready until production deployment completes.");
      return;
    }

    const now = new Date();
    setSummary((current) => ({
      ...current,
      productionVersion: "2026-05",
      candidateVersion: "2026-06",
      environment: "Production",
      lastDeploymentTime: now.toISOString()
    }));
    setStages((current) =>
      current.map((stage) =>
        stage.id === "production" || stage.id === "health"
          ? { ...stage, status: "Skipped", timestamp: null, duration: "--" }
          : stage.id === "rollback"
            ? {
                ...stage,
                status: "Passed",
                timestamp: now.toISOString(),
                duration: "52s"
              }
            : stage
      )
    );
    setNotice("Rollback completed to the previous production version.");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-public-blue-100 bg-white p-5 shadow-soft sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="label text-public-blue-700">Release Operations</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
              CI/CD Pipeline
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Demonstrate controlled delivery for a public-facing school performance
              reporting website with automated checks, manual approval, monitoring, and
              rollback readiness.
            </p>
          </div>
          <StatusPill
            label={hasFailedGate ? "Blocked" : summary.environment}
            tone={
              hasFailedGate
                ? "danger"
                : summary.environment === "Production"
                  ? "success"
                  : "info"
            }
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Production version"
          value={summary.productionVersion}
          icon={Rocket}
          detail="Current public release"
        />
        <SummaryCard
          label="Candidate version"
          value={summary.candidateVersion}
          icon={GitCommit}
          detail={summary.commitHash}
        />
        <SummaryCard
          label="Build number"
          value={summary.buildNumber}
          icon={ShieldCheck}
          detail={summary.environment}
        />
        <SummaryCard
          label="Last deployment"
          value={formatDateTime(summary.lastDeploymentTime)}
          icon={Clock3}
          detail="Mock release metadata"
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="surface p-5" aria-labelledby="actions-heading">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="label">Mock Workflow Controls</p>
                <h2 id="actions-heading" className="mt-1 text-xl font-bold text-ink">
                  Release Actions
                </h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <ActionButton icon={Play} label="Run Pipeline" onClick={runPipeline} />
                <ActionButton
                  icon={XCircle}
                  label="Simulate Unit Test Failure"
                  onClick={() => simulateFailure("unit-tests")}
                  tone="danger"
                />
                <ActionButton
                  icon={AlertTriangle}
                  label="Simulate Data Validation Failure"
                  onClick={() => simulateFailure("data-validation")}
                  tone="danger"
                />
                <ActionButton
                  icon={ThumbsUp}
                  label="Approve Release"
                  onClick={approveRelease}
                />
                <ActionButton
                  icon={Rocket}
                  label="Deploy to Production"
                  onClick={deployToProduction}
                />
                <ActionButton
                  icon={RotateCcw}
                  label="Roll Back"
                  onClick={rollBack}
                  tone="danger"
                />
              </div>
            </div>
            <p className="mt-5 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-900">
              {notice}
            </p>
          </section>

          <section className="surface p-5" aria-labelledby="pipeline-heading">
            <p className="label">Pipeline Timeline</p>
            <h2 id="pipeline-heading" className="mt-1 text-xl font-bold text-ink">
              Release Stages
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {stages.map((stage, index) => (
                <PipelineStageCard key={stage.id} index={index + 1} stage={stage} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <ReleaseSummaryCard summary={summary} />
          <QualityGatesCard gates={qualityGates} />
        </aside>
      </div>

      <section className="surface mt-6 p-5" aria-labelledby="why-heading">
        <p className="label">Why This Matters</p>
        <h2 id="why-heading" className="mt-1 text-xl font-bold text-ink">
          Safe Public Data Releases
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">
          Public education data releases need controlled CI/CD because families,
          schools, districts, and policymakers rely on accurate reporting. Automated
          checks catch code defects, data quality issues, accessibility regressions, and
          security risk before release. Manual approval adds business accountability,
          health checks confirm the public site is behaving correctly, and rollback
          readiness reduces production risk when something unexpected happens.
        </p>
      </section>
    </div>
  );
}

function PipelineStageCard({ stage, index }: { stage: PipelineStage; index: number }) {
  const Icon = {
    Pending: Clock3,
    Running: Play,
    Passed: CheckCircle2,
    Failed: XCircle,
    Skipped: AlertTriangle
  }[stage.status];

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-public-blue-50 text-sm font-bold text-public-blue-800">
            {index}
          </span>
          <Icon
            aria-hidden="true"
            className={`h-5 w-5 ${statusIconClass(stage.status)}`}
          />
        </div>
        <StatusPill label={stage.status} tone={statusTone(stage.status)} />
      </div>
      <h3 className="mt-4 break-words text-base font-bold text-ink">{stage.name}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{stage.explanation}</p>
      <dl className="mt-4 grid gap-2 text-sm">
        <StageMeta
          label="Timestamp"
          value={stage.timestamp ? formatDateTime(stage.timestamp) : "Not started"}
        />
        <StageMeta label="Duration" value={stage.duration} />
      </dl>
    </article>
  );
}

function ReleaseSummaryCard({ summary }: { summary: ReleaseSummary }) {
  return (
    <section className="surface p-5" aria-labelledby="release-summary-heading">
      <p className="label">Release Summary</p>
      <h2 id="release-summary-heading" className="mt-1 text-lg font-bold text-ink">
        Current Candidate
      </h2>
      <div className="mt-5 grid gap-3">
        <InfoRow label="Current production version" value={summary.productionVersion} />
        <InfoRow label="Candidate version" value={summary.candidateVersion} />
        <InfoRow label="Git commit hash" value={summary.commitHash} />
        <InfoRow label="Build number" value={summary.buildNumber} />
        <InfoRow label="Environment" value={summary.environment} />
        <InfoRow
          label="Last deployment time"
          value={formatDateTime(summary.lastDeploymentTime)}
        />
      </div>
    </section>
  );
}

function QualityGatesCard({
  gates
}: {
  gates: Array<{ label: string; value: string; status: PipelineStatus }>;
}) {
  return (
    <section className="surface p-5" aria-labelledby="quality-gates-heading">
      <p className="label">Quality Gates</p>
      <h2 id="quality-gates-heading" className="mt-1 text-lg font-bold text-ink">
        Release Readiness
      </h2>
      <div className="mt-5 space-y-3">
        {gates.map((gate) => (
          <div
            key={gate.label}
            className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-3"
          >
            <div>
              <p className="text-sm font-bold text-ink">{gate.label}</p>
              <p className="mt-0.5 text-sm text-slate-600">{gate.value}</p>
            </div>
            <StatusPill label={gate.status} tone={statusTone(gate.status)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  tone = "primary"
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "primary" | "danger";
}) {
  return (
    <button
      type="button"
      className={tone === "danger" ? "btn-danger" : "btn-primary"}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {label}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

function StageMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <dt className="font-semibold text-slate-600">{label}</dt>
      <dd className="mt-1 break-words font-bold text-ink">{value}</dd>
    </div>
  );
}

function buildQualityGates(stages: PipelineStage[]) {
  return [
    {
      label: "Unit test pass rate",
      value:
        stageStatus(stages, "unit-tests") === "Passed"
          ? "100%"
          : stageStatus(stages, "unit-tests") === "Failed"
            ? "91%"
            : "Awaiting run",
      status: stageStatus(stages, "unit-tests")
    },
    {
      label: "Data validation result",
      value:
        stageStatus(stages, "data-validation") === "Passed"
          ? "All checks passed"
          : stageStatus(stages, "data-validation") === "Failed"
            ? "Outliers require review"
            : "Awaiting run",
      status: stageStatus(stages, "data-validation")
    },
    {
      label: "Accessibility check",
      value:
        stageStatus(stages, "build") === "Passed"
          ? "WCAG smoke checks passed"
          : "Pending",
      status: stageStatus(stages, "build") === "Passed" ? "Passed" : "Pending"
    },
    {
      label: "Security scan result",
      value:
        stageStatus(stages, "security-scan") === "Passed"
          ? "No blocking findings"
          : "Awaiting scan",
      status: stageStatus(stages, "security-scan")
    },
    {
      label: "API health check",
      value:
        stageStatus(stages, "health") === "Passed" ? "Healthy" : "Awaiting deployment",
      status: stageStatus(stages, "health")
    },
    {
      label: "Rollback package available",
      value:
        stageStatus(stages, "rollback") === "Passed" ? "Ready" : "Not yet packaged",
      status: stageStatus(stages, "rollback")
    }
  ];
}

function stageStatus(stages: PipelineStage[], id: string): PipelineStatus {
  return stages.find((stage) => stage.id === id)?.status ?? "Pending";
}

function timestampFrom(date: Date, offsetMinutes: number) {
  return new Date(date.getTime() + offsetMinutes * 60_000).toISOString();
}

function statusTone(status: PipelineStatus) {
  if (status === "Passed") {
    return "success";
  }

  if (status === "Failed") {
    return "danger";
  }

  if (status === "Running") {
    return "info";
  }

  if (status === "Skipped") {
    return "neutral";
  }

  return "warning";
}

function statusIconClass(status: PipelineStatus) {
  if (status === "Passed") {
    return "text-emerald-600";
  }

  if (status === "Failed") {
    return "text-red-600";
  }

  if (status === "Skipped") {
    return "text-slate-500";
  }

  if (status === "Running") {
    return "text-sky-600";
  }

  return "text-amber-600";
}
