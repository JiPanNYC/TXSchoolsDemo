import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ExternalLink,
  FileBadge,
  IdCard,
  MapPin,
  Phone,
  School as SchoolIcon,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { School } from "../../shared/types";
import { fetchSchool } from "../api/client";
import { RatingBadge, StatusPill } from "../components/RatingBadge";
import { ScoreBar } from "../components/ScoreBar";
import { ErrorState, LoadingState } from "../components/StateBlocks";
import { TrendChart } from "../components/TrendChart";
import {
  currencyFormatter,
  formatDateTime,
  freshnessLabel,
  numberFormatter,
  percentFormatter
} from "../lib/format";
import { isHttpUrl, normalizeHref } from "../lib/links";

export default function SchoolDetailPage() {
  const { id } = useParams();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchool = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setSchool(await fetchSchool(id));
    } catch (error) {
      setError(error instanceof Error ? error.message : "School detail failed.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSchool();
  }, [loadSchool]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <LoadingState label="Loading school profile" />
      </div>
    );
  }

  if (error || !school) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState message={error ?? "School was not found."} onRetry={loadSchool} />
      </div>
    );
  }

  const freshness = freshnessLabel(school.lastUpdated);
  const freshnessTone =
    freshness.tone === "fresh"
      ? "success"
      : freshness.tone === "watch"
        ? "warning"
        : "danger";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-public-blue-700 hover:text-public-blue-900"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to explorer
      </Link>

      <section className="mt-5 rounded-lg border border-public-blue-100 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="label text-public-blue-700">School Profile</p>
            <h1 className="mt-2 text-3xl font-bold text-ink">{school.name}</h1>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
              <IconLine icon={Building2} text={school.district} />
              <IconLine
                icon={MapPin}
                text={`${school.city}, ${school.county} County`}
              />
              <IconLine icon={SchoolIcon} text={school.gradeLevel} />
              <IconLine
                icon={Users}
                text={`${numberFormatter(school.enrollment)} enrolled`}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 md:flex-col md:items-end">
            <RatingBadge rating={school.accountabilityRating} />
            <div className="text-left md:text-right">
              <p className="label">Overall score</p>
              <p className="text-3xl font-bold text-ink">{school.overallScore}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="surface p-5" aria-labelledby="scores-heading">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="label">Score Breakdown</p>
              <h2 id="scores-heading" className="mt-1 text-xl font-bold text-ink">
                Accountability Measures
              </h2>
            </div>
            <StatusPill label={freshness.label} tone={freshnessTone} />
          </div>
          <div className="mt-6 space-y-5">
            <ScoreBar label="Overall score" value={school.overallScore} />
            <ScoreBar label="Reading score" value={school.readingScore} tone="teal" />
            <ScoreBar label="Math score" value={school.mathScore} tone="amber" />
          </div>
          <dl className="mt-6 grid gap-3 text-sm">
            <DetailRow
              label="Last updated"
              value={formatDateTime(school.lastUpdated)}
            />
            <DetailRow label="Report version" value={school.reportVersion} />
            {school.officialCampusId ? (
              <DetailRow label="TEA campus ID" value={school.officialCampusId} />
            ) : null}
            <DetailRow label="Data freshness" value={freshness.label} />
          </dl>
        </section>

        <section className="surface p-5" aria-labelledby="trend-heading">
          <div className="flex items-center gap-3">
            <CalendarClock
              aria-hidden="true"
              className="h-5 w-5 text-public-blue-700"
            />
            <div>
              <p className="label">Three-Year Trend</p>
              <h2 id="trend-heading" className="mt-1 text-xl font-bold text-ink">
                Performance Over Time
              </h2>
            </div>
          </div>
          <div className="mt-6">
            <TrendChart data={school.trend} />
          </div>
        </section>
      </div>

      <section className="surface mt-6 p-5" aria-labelledby="public-profile-heading">
        <div className="flex items-center gap-3">
          <FileBadge aria-hidden="true" className="h-5 w-5 text-public-blue-700" />
          <div>
            <p className="label">Official Public Aggregate Data</p>
            <h2 id="public-profile-heading" className="mt-1 text-xl font-bold text-ink">
              Profile and Finance Indicators
            </h2>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {school.principal ? (
            <ProfileMetric label="Principal" value={school.principal} />
          ) : null}
          {school.address ? (
            <ProfileMetric label="Address" value={school.address} />
          ) : null}
          {school.phone ? (
            <ProfileMetric
              label="Phone"
              value={school.phone}
              icon={Phone}
              href={`tel:${school.phone}`}
            />
          ) : null}
          {school.website ? (
            <ProfileMetric
              label="Website"
              value="School website"
              icon={ExternalLink}
              href={school.website}
            />
          ) : null}
          {school.economicDisadvantaged !== undefined ? (
            <ProfileMetric
              label="Economically disadvantaged"
              value={percentFormatter(school.economicDisadvantaged)}
            />
          ) : null}
          {school.attendanceRate !== undefined ? (
            <ProfileMetric
              label="Attendance rate"
              value={percentFormatter(school.attendanceRate)}
            />
          ) : null}
          {school.studentTeacherRatio !== undefined ? (
            <ProfileMetric
              label="Students per staff"
              value={school.studentTeacherRatio.toFixed(1)}
            />
          ) : null}
          {school.expendituresPerStudent !== undefined ? (
            <ProfileMetric
              label="Per-student expenditure"
              value={currencyFormatter(school.expendituresPerStudent)}
            />
          ) : null}
          {school.region ? (
            <ProfileMetric label="Region" value={school.region} />
          ) : null}
          {school.lowGrade && school.highGrade ? (
            <ProfileMetric
              label="Grade span"
              value={`${school.lowGrade} through ${school.highGrade}`}
            />
          ) : null}
          {school.distinctions !== undefined ? (
            <ProfileMetric label="Distinctions" value={school.distinctions} />
          ) : null}
          {school.officialDistrictId ? (
            <ProfileMetric
              label="TEA district ID"
              value={school.officialDistrictId}
              icon={IdCard}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function IconLine({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
      <Icon aria-hidden="true" className="h-4 w-4 text-public-blue-700" />
      {text}
    </span>
  );
}

function ProfileMetric({
  label,
  value,
  icon: Icon,
  href
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  href?: string;
}) {
  const normalizedHref = href ? normalizeHref(href) : undefined;
  const content = (
    <span className="mt-1 flex items-center gap-2 text-sm font-bold text-ink">
      {Icon ? (
        <Icon aria-hidden="true" className="h-4 w-4 text-public-blue-700" />
      ) : null}
      {value}
    </span>
  );

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      {normalizedHref ? (
        <a
          href={normalizedHref}
          target={isHttpUrl(normalizedHref) ? "_blank" : undefined}
          rel={isHttpUrl(normalizedHref) ? "noreferrer" : undefined}
          className="text-public-blue-800 hover:text-public-blue-900"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
      <dt className="font-semibold text-slate-600">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  );
}
