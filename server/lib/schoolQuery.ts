import type { PaginatedResponse, Rating, School } from "../../shared/types.js";

export type SortDirection = "asc" | "desc";

export interface SchoolQueryOptions {
  search?: string;
  rating?: Rating | "all";
  district?: string;
  city?: string;
  gradeLevel?: string;
  sortBy?: keyof Pick<
    School,
    | "name"
    | "district"
    | "city"
    | "gradeLevel"
    | "accountabilityRating"
    | "overallScore"
    | "readingScore"
    | "mathScore"
    | "lastUpdated"
  >;
  sortDir?: SortDirection;
  page?: number;
  pageSize?: number;
}

type SchoolSortField = NonNullable<SchoolQueryOptions["sortBy"]>;

const allowedSortFields = new Set<SchoolSortField>([
  "name",
  "district",
  "city",
  "gradeLevel",
  "accountabilityRating",
  "overallScore",
  "readingScore",
  "mathScore",
  "lastUpdated"
]);

const allowedRatings = new Set(["A", "B", "C", "D", "F"]);

export function parseSchoolQuery(
  query: Record<string, unknown>
): Required<Pick<SchoolQueryOptions, "page" | "pageSize" | "sortDir">> &
  Omit<SchoolQueryOptions, "page" | "pageSize" | "sortDir"> {
  const page = clampInteger(valueAsString(query.page), 1, 1, 9999);
  const pageSize = clampInteger(valueAsString(query.pageSize), 20, 1, 50);
  const sortBy = valueAsString(query.sortBy);
  const sortDir = valueAsString(query.sortDir) === "asc" ? "asc" : "desc";
  const rating = valueAsString(query.rating);

  return {
    search: valueAsString(query.search),
    rating: allowedRatings.has(rating) ? (rating as Rating) : "all",
    district: valueAsString(query.district),
    city: valueAsString(query.city),
    gradeLevel: valueAsString(query.gradeLevel),
    sortBy: allowedSortFields.has(sortBy as SchoolSortField)
      ? (sortBy as SchoolSortField)
      : "overallScore",
    sortDir,
    page,
    pageSize
  };
}

export function applySchoolQuery(
  schools: School[],
  options: SchoolQueryOptions
): PaginatedResponse<School> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const search = normalize(options.search);
  const rating = options.rating && options.rating !== "all" ? options.rating : "";
  const district = normalize(options.district);
  const city = normalize(options.city);
  const gradeLevel = normalize(options.gradeLevel);

  const filtered = schools.filter((school) => {
    const searchableText = normalize(
      [
        school.name,
        school.district,
        school.city,
        school.accountabilityRating,
        school.gradeLevel
      ].join(" ")
    );

    return (
      (!search || searchableText.includes(search)) &&
      (!rating || school.accountabilityRating === rating) &&
      (!district || normalize(school.district) === district) &&
      (!city || normalize(school.city) === city) &&
      (!gradeLevel || normalize(school.gradeLevel) === gradeLevel)
    );
  });

  const sortBy = options.sortBy ?? "overallScore";
  const sortDir = options.sortDir ?? "desc";
  const sorted = [...filtered].sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];
    const result = compareValues(leftValue, rightValue);
    return sortDir === "asc" ? result : result * -1;
  });

  const start = (page - 1) * pageSize;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  return {
    data: sorted.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total: sorted.length,
      totalPages
    }
  };
}

function compareValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "en", {
    sensitivity: "base",
    numeric: true
  });
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function valueAsString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim();
  }

  return String(value ?? "").trim();
}

function clampInteger(
  value: string,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}
