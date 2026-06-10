import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Filter,
  GitBranch,
  MapPin,
  Search,
  School as SchoolIcon,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { PaginatedResponse, ReportSummary, School } from "../../shared/types";
import {
  type DistrictSummary,
  fetchCurrentReport,
  fetchDistricts,
  fetchSchools
} from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/StateBlocks";
import { SchoolResults } from "../components/SchoolResults";
import { SummaryCard } from "../components/SummaryCard";

const ratings = ["all", "A", "B", "C", "D", "F"];
const gradeLevels = ["all", "Elementary", "Middle", "High", "K-8", "K-12"];

const quickSearches = [
  { label: "Austin", search: "Austin" },
  { label: "Dallas", search: "Dallas" },
  { label: "Houston", search: "Houston" },
  { label: "A-rated", search: "", rating: "A" }
];

const actionTiles = [
  {
    title: "Compare schools",
    detail: "Scan ratings, scores, grade levels, and district context.",
    icon: BarChart3,
    to: "#results"
  },
  {
    title: "Track trends",
    detail: "Open a school profile for three-year performance history.",
    icon: TrendingUp,
    to: "#results"
  },
  {
    title: "Validate releases",
    detail: "Review monthly report checks before production promotion.",
    icon: ShieldCheck,
    to: "/release"
  },
  {
    title: "Inspect delivery",
    detail: "Walk through CI/CD quality gates and rollback readiness.",
    icon: CheckCircle2,
    to: "/pipeline"
  }
];

export default function LandingPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [schools, setSchools] = useState<PaginatedResponse<School> | null>(null);
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("all");
  const [district, setDistrict] = useState("all");
  const [city, setCity] = useState("all");
  const [gradeLevel, setGradeLevel] = useState("all");
  const [sortBy, setSortBy] = useState("overallScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(districts.map((item) => item.city))).sort(),
    [districts]
  );

  async function loadSummary() {
    setLoadingSummary(true);
    setError(null);
    try {
      const [summaryResponse, districtResponse] = await Promise.all([
        fetchCurrentReport(),
        fetchDistricts()
      ]);
      setSummary(summaryResponse);
      setDistricts(districtResponse);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Summary failed.");
    } finally {
      setLoadingSummary(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSchools() {
      setLoadingSchools(true);
      setError(null);
      try {
        const response = await fetchSchools({
          search,
          rating,
          district,
          city,
          gradeLevel,
          sortBy,
          sortDir,
          page,
          pageSize: 12
        });

        if (active) {
          setSchools(response);
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : "School search failed.");
        }
      } finally {
        if (active) {
          setLoadingSchools(false);
        }
      }
    }

    void loadSchools();

    return () => {
      active = false;
    };
  }, [search, rating, district, city, gradeLevel, sortBy, sortDir, page]);

  function resetPagingAnd<T>(setter: (value: T) => void, value: T) {
    setPage(1);
    setter(value);
  }

  function handleSortChange(nextSortBy: string) {
    if (nextSortBy === sortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextSortBy);
    setSortDir(
      ["name", "district", "city", "gradeLevel", "accountabilityRating"].includes(
        nextSortBy
      )
        ? "asc"
        : "desc"
    );
  }

  function applyQuickSearch(nextSearch: string, nextRating?: string) {
    setPage(1);
    setSearch(nextSearch);
    if (nextRating) {
      setRating(nextRating);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-lg border border-sky-100 bg-white shadow-soft">
        <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="max-w-3xl">
            <p className="label text-public-blue-700">
              Public school information for Texas families
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-ink sm:text-5xl">
              Texas School Performance Explorer
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Explore school accountability ratings, performance trends, and
              district-level insights.
            </p>
            <form
              className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-sm"
              onSubmit={(event) => event.preventDefault()}
            >
              <label className="sr-only" htmlFor="home-search">
                Search school or district
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <span className="relative block min-w-0 flex-1">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="home-search"
                    className="field h-14 border-white bg-white pl-12 text-base shadow-none"
                    type="search"
                    value={search}
                    onChange={(event) =>
                      resetPagingAnd(setSearch, event.currentTarget.value)
                    }
                    placeholder="Search by school, district, city, or rating"
                  />
                </span>
                <button
                  type="submit"
                  className="btn-primary h-14 px-6 text-base sm:min-w-32"
                >
                  <Search aria-hidden="true" className="h-5 w-5" />
                  Search
                </button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickSearches.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-public-blue-800"
                  onClick={() => applyQuickSearch(item.search, item.rating)}
                >
                  <MapPin aria-hidden="true" className="h-4 w-4 text-sky-600" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-4">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="label text-public-blue-700">Current release</p>
              <p className="mt-2 text-2xl font-bold text-ink">
                {summary?.dataVersion ?? "2026-06"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Versioned public aggregate data with freshness metadata, validation
                checks, and rollback support.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <HeroMetric
                label="Schools"
                value={summary?.totalSchools ?? (loadingSummary ? "--" : 0)}
              />
              <HeroMetric
                label="Districts"
                value={summary?.totalDistricts ?? (loadingSummary ? "--" : 0)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loadingSummary ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : summary ? (
          <>
            <SummaryCard
              label="Total schools"
              value={summary.totalSchools}
              icon={SchoolIcon}
              detail="Official public aggregate seed"
            />
            <SummaryCard
              label="Total districts"
              value={summary.totalDistricts}
              icon={Building2}
              detail="Demo district coverage"
            />
            <SummaryCard
              label="Latest report month"
              value={summary.latestReportMonth}
              icon={CalendarClock}
              detail="Current public release"
            />
            <SummaryCard
              label="Data version"
              value={summary.dataVersion}
              icon={GitBranch}
              detail="Versioned reporting dataset"
            />
          </>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {actionTiles.map((item) => (
          <ActionTile key={item.title} {...item} />
        ))}
      </section>

      <div id="results" className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="surface p-4 sm:p-5" aria-label="School filters">
            <details className="lg:hidden">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-bold text-ink">
                <span className="inline-flex items-center gap-2">
                  <Filter aria-hidden="true" className="h-4 w-4" />
                  Filters
                </span>
                <span className="text-slate-500">Open</span>
              </summary>
              <div className="mt-4 grid gap-3">
                <Filters
                  rating={rating}
                  district={district}
                  city={city}
                  gradeLevel={gradeLevel}
                  districts={districts}
                  cities={cities}
                  onRating={(value) => resetPagingAnd(setRating, value)}
                  onDistrict={(value) => resetPagingAnd(setDistrict, value)}
                  onCity={(value) => resetPagingAnd(setCity, value)}
                  onGradeLevel={(value) => resetPagingAnd(setGradeLevel, value)}
                />
              </div>
            </details>
            <div className="mb-4 hidden items-end justify-between gap-4 lg:flex">
              <div>
                <p className="label">Refine Search</p>
                <h2 className="mt-1 text-lg font-bold text-ink">
                  Filter school results
                </h2>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {schools?.pagination.total ?? 0} matching records
              </p>
            </div>
            <div className="hidden grid-cols-4 gap-3 lg:grid">
              <Filters
                rating={rating}
                district={district}
                city={city}
                gradeLevel={gradeLevel}
                districts={districts}
                cities={cities}
                onRating={(value) => resetPagingAnd(setRating, value)}
                onDistrict={(value) => resetPagingAnd(setDistrict, value)}
                onCity={(value) => resetPagingAnd(setCity, value)}
                onGradeLevel={(value) => resetPagingAnd(setGradeLevel, value)}
              />
            </div>
          </section>

          {error ? <ErrorState message={error} onRetry={loadSummary} /> : null}
          {loadingSchools ? (
            <LoadingState label="Searching schools" />
          ) : schools && schools.data.length > 0 ? (
            <SchoolResults
              result={schools}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              onPageChange={setPage}
            />
          ) : (
            <EmptyState />
          )}
        </div>

        <aside className="space-y-5">
          <section className="surface p-5" aria-labelledby="district-heading">
            <p className="label">District Snapshot</p>
            <h2 id="district-heading" className="mt-1 text-lg font-bold text-ink">
              Highest Average Scores
            </h2>
            <div className="mt-4 space-y-3">
              {[...districts]
                .sort(
                  (left, right) => right.averageOverallScore - left.averageOverallScore
                )
                .slice(0, 5)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-3"
                  >
                    <div>
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-sm text-slate-600">
                        {item.schoolCount} schools in {item.city}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-public-blue-800">
                      {item.averageOverallScore}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-sky-100 bg-white px-3 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

function ActionTile({
  title,
  detail,
  icon: Icon,
  to
}: {
  title: string;
  detail: string;
  icon: LucideIcon;
  to: string;
}) {
  const content = (
    <>
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-sky-50 text-public-blue-700 ring-1 ring-sky-100">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-public-blue-700"
      />
    </>
  );

  const className =
    "surface flex items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:border-public-blue-100 hover:shadow-lg";

  return to.startsWith("#") ? (
    <a href={to} className={className}>
      {content}
    </a>
  ) : (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}

function Filters({
  rating,
  district,
  city,
  gradeLevel,
  districts,
  cities,
  onRating,
  onDistrict,
  onCity,
  onGradeLevel
}: {
  rating: string;
  district: string;
  city: string;
  gradeLevel: string;
  districts: DistrictSummary[];
  cities: string[];
  onRating: (value: string) => void;
  onDistrict: (value: string) => void;
  onCity: (value: string) => void;
  onGradeLevel: (value: string) => void;
}) {
  return (
    <>
      <Select
        label="Rating"
        value={rating}
        onChange={onRating}
        options={ratings.map((value) => ({
          value,
          label: value === "all" ? "All ratings" : value
        }))}
      />
      <Select
        label="District"
        value={district}
        onChange={onDistrict}
        options={[
          { value: "all", label: "All districts" },
          ...districts.map((item) => ({ value: item.name, label: item.name }))
        ]}
      />
      <Select
        label="City"
        value={city}
        onChange={onCity}
        options={[
          { value: "all", label: "All cities" },
          ...cities.map((item) => ({ value: item, label: item }))
        ]}
      />
      <Select
        label="Grade level"
        value={gradeLevel}
        onChange={onGradeLevel}
        options={gradeLevels.map((value) => ({
          value,
          label: value === "all" ? "All grade levels" : value
        }))}
      />
    </>
  );
}

function Select({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select
        className="field mt-2"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SkeletonCard() {
  return (
    <div className="surface p-4">
      <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-3 w-40 animate-pulse rounded bg-slate-200" />
    </div>
  );
}
