import type {
  AnalyticsResponse,
  CacheStatus,
  District,
  PaginatedResponse,
  ReleaseState,
  ReportSummary,
  ReportVersion,
  School
} from "../../shared/types";

export interface DistrictSummary extends District {
  schoolCount: number;
  averageOverallScore: number;
}

export interface SchoolSearchParams {
  search?: string;
  rating?: string;
  district?: string;
  city?: string;
  gradeLevel?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ReleasePreview {
  version: string;
  recordCount: number;
  validationStatus: string;
  topRatedSchools: Array<{
    id: string;
    name: string;
    district: string;
    overallScore: number;
  }>;
}

export interface ReleaseActionResult {
  release: ReleaseState;
  cache: CacheStatus;
  message: string;
}

export async function fetchSchools(params: SchoolSearchParams) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      query.set(key, String(value));
    }
  });

  return request<PaginatedResponse<School>>(`/api/schools?${query.toString()}`);
}

export function fetchSchool(id: string) {
  return request<School>(`/api/schools/${id}`);
}

export function fetchDistricts() {
  return request<DistrictSummary[]>("/api/districts");
}

export function fetchCurrentReport() {
  return request<ReportSummary>("/api/reports/current");
}

export function fetchReportVersions() {
  return request<ReportVersion[]>("/api/reports/versions");
}

export function fetchAnalytics() {
  return request<AnalyticsResponse>("/api/analytics/ml");
}

export function validateRelease() {
  return request<ReleaseState>("/api/releases/validate", { method: "POST" });
}

export function previewRelease() {
  return request<ReleasePreview>("/api/releases/preview", { method: "POST" });
}

export function promoteRelease() {
  return request<ReleaseActionResult>("/api/releases/promote", { method: "POST" });
}

export function rollbackRelease() {
  return request<ReleaseActionResult>("/api/releases/rollback", { method: "POST" });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(error?.message ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}
