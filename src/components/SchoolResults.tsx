import { ArrowUpDown, CalendarClock, ChevronRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { PaginatedResponse, School } from "../../shared/types";
import { formatDate } from "../lib/format";
import { RatingBadge } from "./RatingBadge";

interface SchoolResultsProps {
  result: PaginatedResponse<School>;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSortChange: (sortBy: string) => void;
  onPageChange: (page: number) => void;
}

const columns = [
  { key: "name", label: "School name" },
  { key: "district", label: "District" },
  { key: "city", label: "City" },
  { key: "gradeLevel", label: "Grade level" },
  { key: "accountabilityRating", label: "Rating" },
  { key: "overallScore", label: "Overall" },
  { key: "readingScore", label: "Reading" },
  { key: "mathScore", label: "Math" },
  { key: "lastUpdated", label: "Last updated" }
];

export function SchoolResults({
  result,
  sortBy,
  sortDir,
  onSortChange,
  onPageChange
}: SchoolResultsProps) {
  return (
    <section className="space-y-4" aria-labelledby="results-heading">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="label">School Directory</p>
          <h2 id="results-heading" className="mt-1 text-2xl font-bold text-ink">
            Search results
          </h2>
          <p className="text-sm text-slate-600">
            {result.pagination.total} records across Texas demo districts
          </p>
        </div>
        <div className="inline-flex w-fit items-center rounded-md bg-sky-50 px-3 py-2 text-sm font-semibold text-public-blue-800">
          Page {result.pagination.page} of {result.pagination.totalPages}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-sky-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="whitespace-nowrap px-4 py-4 text-left text-xs font-bold uppercase text-slate-600"
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-sm hover:text-public-blue-800"
                      onClick={() => onSortChange(column.key)}
                      title={`Sort by ${column.label}`}
                    >
                      {column.label}
                      <ArrowUpDown
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 ${
                          sortBy === column.key
                            ? "text-public-blue-700"
                            : "text-slate-400"
                        }`}
                      />
                      <span className="sr-only">
                        {sortBy === column.key ? `sorted ${sortDir}` : ""}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Open school</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {result.data.map((school) => (
                <tr key={school.id} className="transition hover:bg-sky-50/60">
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold text-public-blue-800">
                    <Link
                      to={`/schools/${school.id}`}
                      className="hover:text-public-blue-900 hover:underline"
                    >
                      {school.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                    {school.district}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                    {school.city}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                    {school.gradeLevel}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <RatingBadge rating={school.accountabilityRating} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold text-ink">
                    {school.overallScore}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                    {school.readingScore}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                    {school.mathScore}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                    {formatDate(school.lastUpdated)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    <Link
                      to={`/schools/${school.id}`}
                      className="inline-flex items-center text-sm font-bold text-public-blue-700 hover:text-public-blue-900"
                    >
                      View
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 lg:hidden">
        {result.data.map((school) => (
          <Link
            key={school.id}
            to={`/schools/${school.id}`}
            className="surface block p-4 transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-public-blue-800">
                  {school.name}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-600">
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                  {school.district} - {school.city}
                </p>
              </div>
              <RatingBadge rating={school.accountabilityRating} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Grade" value={school.gradeLevel} />
              <Metric label="Overall" value={school.overallScore} />
              <Metric label="Reading" value={school.readingScore} />
              <Metric label="Math" value={school.mathScore} />
            </div>
            <p className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
              Updated {formatDate(school.lastUpdated)}
            </p>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="btn-secondary"
          disabled={result.pagination.page <= 1}
          onClick={() => onPageChange(result.pagination.page - 1)}
        >
          Previous
        </button>
        <p className="text-center text-sm text-slate-600">
          Showing {result.data.length} of {result.pagination.total} records
        </p>
        <button
          type="button"
          className="btn-secondary"
          disabled={result.pagination.page >= result.pagination.totalPages}
          onClick={() => onPageChange(result.pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-ink">{value}</p>
    </div>
  );
}
