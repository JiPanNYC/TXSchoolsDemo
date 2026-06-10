import {
  CheckCircle2,
  Eye,
  GitBranch,
  History,
  Rocket,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ReleaseState,
  ReleaseValidationCheck,
  ReportSummary,
  ReportVersion
} from "../../shared/types";
import {
  type ReleasePreview,
  fetchCurrentReport,
  fetchReportVersions,
  previewRelease,
  promoteRelease,
  rollbackRelease,
  validateRelease
} from "../api/client";
import { StatusPill } from "../components/RatingBadge";
import { ErrorState, LoadingState } from "../components/StateBlocks";
import { SummaryCard } from "../components/SummaryCard";
import { formatDate, formatDateTime } from "../lib/format";

export default function ReleaseCenterPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [release, setRelease] = useState<ReleaseState | null>(null);
  const [preview, setPreview] = useState<ReleasePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReleaseCenter() {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, versionsResponse] = await Promise.all([
        fetchCurrentReport(),
        fetchReportVersions()
      ]);
      setSummary(summaryResponse);
      setRelease(summaryResponse.release);
      setVersions(versionsResponse);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Release data failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: string, handler: () => Promise<unknown>) {
    setBusyAction(action);
    setError(null);
    setNotice(null);
    if (action !== "preview") {
      setPreview(null);
    }
    try {
      const result = await handler();

      if (isReleaseState(result)) {
        setRelease(result);
        setNotice("Validation completed successfully.");
      } else if (action === "preview" && isPreview(result)) {
        setPreview(result);
        setNotice(`Preview generated for ${result.version}.`);
      } else {
        const refreshed = await fetchCurrentReport();
        setSummary(refreshed);
        setRelease(refreshed.release);
        setNotice(
          "Release state updated. Backend cache is marked for refresh before serving users."
        );
      }

      setVersions(await fetchReportVersions());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Release action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    void loadReleaseCenter();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <LoadingState label="Loading release center" />
      </div>
    );
  }

  if (error && !release) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState message={error} onRetry={loadReleaseCenter} />
      </div>
    );
  }

  if (!release || !summary) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-public-blue-100 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label text-public-blue-700">Release Center</p>
            <h1 className="mt-2 text-3xl font-bold text-ink">
              Monthly Report Release Simulation
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Validate candidate data, preview release impact, promote production, and
              roll back when needed.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              This page represents data release governance. CI/CD Pipeline represents
              application deployment controls.
            </p>
          </div>
          <StatusPill
            label={release.validationStatus.replace("_", " ")}
            tone={statusTone(release.validationStatus)}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Current production version"
          value={release.productionVersion}
          icon={GitBranch}
          detail={`${summary.totalSchools} production records`}
        />
        <SummaryCard
          label="Candidate release version"
          value={release.candidateVersion}
          icon={Rocket}
          detail="Awaiting validation before promotion"
        />
        <SummaryCard
          label="Validation status"
          value={release.validationStatus.replace("_", " ")}
          icon={ShieldCheck}
          detail={
            release.lastValidatedAt
              ? `Validated ${formatDateTime(release.lastValidatedAt)}`
              : "No validation run yet"
          }
        />
      </section>

      <div className="mt-6 space-y-6">
        <section className="surface p-5" aria-labelledby="checks-heading">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="label">Data Quality Checks</p>
              <h2 id="checks-heading" className="mt-1 text-xl font-bold text-ink">
                Candidate Validation
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:flex">
              <button
                type="button"
                className="btn-primary"
                disabled={busyAction !== null}
                onClick={() => runAction("validate", validateRelease)}
              >
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                {busyAction === "validate" ? "Running" : "Run validation"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busyAction !== null}
                onClick={() => runAction("preview", previewRelease)}
              >
                <Eye aria-hidden="true" className="h-4 w-4" />
                Preview release
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busyAction !== null}
                onClick={() => runAction("promote", promoteRelease)}
              >
                <Rocket aria-hidden="true" className="h-4 w-4" />
                Promote
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={busyAction !== null}
                onClick={() => runAction("rollback", rollbackRelease)}
              >
                <History aria-hidden="true" className="h-4 w-4" />
                Roll back
              </button>
            </div>
          </div>

          {notice ? (
            <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-5 grid gap-3">
            {release.checks.map((check) => (
              <ValidationCheckRow key={check.id} check={check} />
            ))}
          </div>
        </section>

        {preview ? (
          <section className="surface p-5" aria-labelledby="preview-heading">
            <p className="label">Preview Release</p>
            <h2 id="preview-heading" className="mt-1 text-xl font-bold text-ink">
              {preview.version} Candidate Snapshot
            </h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">
                      School
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">
                      District
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {preview.topRatedSchools.map((school) => (
                    <tr key={school.id}>
                      <td className="px-4 py-3 text-sm font-bold text-ink">
                        {school.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {school.district}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-public-blue-800">
                        {school.overallScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="surface p-5" aria-labelledby="versions-heading">
          <p className="label">Report Versions</p>
          <h2 id="versions-heading" className="mt-1 text-xl font-bold text-ink">
            Version History
          </h2>
          <div className="mt-4 grid gap-3">
            {versions.map((version) => (
              <div
                key={version.version}
                className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <p className="font-bold text-ink">{version.label}</p>
                  <p className="text-sm text-slate-600">
                    {version.recordCount} records -{" "}
                    {version.publishedAt
                      ? `published ${formatDate(version.publishedAt)}`
                      : "not yet published"}
                  </p>
                </div>
                <span className="font-bold text-public-blue-800">
                  {version.version}
                </span>
                <StatusPill label={version.status} tone={versionTone(version.status)} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ValidationCheckRow({ check }: { check: ReleaseValidationCheck }) {
  const Icon = check.status === "fail" ? XCircle : CheckCircle2;
  const tone =
    check.status === "pass"
      ? "success"
      : check.status === "warning"
        ? "warning"
        : "danger";
  const iconClass =
    check.status === "pass"
      ? "text-emerald-600"
      : check.status === "warning"
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-ink">{check.name}</p>
          <StatusPill label={check.status} tone={tone} />
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{check.detail}</p>
      </div>
    </div>
  );
}

function statusTone(status: string) {
  if (status === "passed") {
    return "success";
  }
  if (status === "warning" || status === "not_run") {
    return "warning";
  }
  if (status === "failed") {
    return "danger";
  }
  return "info";
}

function versionTone(status: ReportVersion["status"]) {
  if (status === "production") {
    return "success";
  }
  if (status === "candidate") {
    return "info";
  }
  return "neutral";
}

function isReleaseState(value: unknown): value is ReleaseState {
  return (
    typeof value === "object" &&
    value !== null &&
    "productionVersion" in value &&
    "candidateVersion" in value
  );
}

function isPreview(value: unknown): value is ReleasePreview {
  return (
    typeof value === "object" &&
    value !== null &&
    "topRatedSchools" in value &&
    "recordCount" in value
  );
}
