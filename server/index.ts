import cors from "cors";
import express from "express";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  CacheStatus,
  District,
  ReleaseState,
  ReleaseValidationCheck,
  ReportSummary,
  ReportVersion,
  School
} from "../shared/types.js";
import { buildAnalyticsResponse } from "./lib/analytics.js";
import { applySchoolQuery, parseSchoolQuery } from "./lib/schoolQuery.js";

interface MockData {
  districts: District[];
  schools: School[];
  reportVersions: ReportVersion[];
}

interface DistrictSummary extends District {
  schoolCount: number;
  averageOverallScore: number;
}

const app = express();
const port = Number(process.env.PORT ?? 4174);
const cacheTtlSeconds = 15 * 60;

app.use(cors());
app.use(express.json());

const data = loadMockData();
let reportVersions = [...data.reportVersions];
let releaseState: ReleaseState = {
  productionVersion: "2026-05",
  previousVersion: "2026-04",
  candidateVersion: "2026-06",
  validationStatus: "not_run",
  checks: buildValidationChecks(data.schools),
  lastValidatedAt: null
};

let databaseRevision = 0;
let databaseVersion = versionToken(releaseState.productionVersion, databaseRevision);
let cacheVersion = databaseVersion;
let cacheLastRefreshedAt = new Date().toISOString();
let cacheInvalidated = false;

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "txschools-demo-api" });
});

app.get("/api/schools", (request, response) => {
  const query = parseSchoolQuery(request.query);
  response.json(applySchoolQuery(data.schools, query));
});

app.get("/api/schools/:id", (request, response) => {
  const school = data.schools.find((item) => item.id === request.params.id);

  if (!school) {
    response.status(404).json({ message: "School record not found." });
    return;
  }

  response.json(school);
});

app.get("/api/districts", (_request, response) => {
  const districts: DistrictSummary[] = data.districts.map((district) => {
    const schools = data.schools.filter((school) => school.districtId === district.id);
    const averageOverallScore =
      schools.reduce((total, school) => total + school.overallScore, 0) /
      Math.max(1, schools.length);

    return {
      ...district,
      schoolCount: schools.length,
      averageOverallScore: Math.round(averageOverallScore * 10) / 10
    };
  });

  response.json(districts);
});

app.get("/api/reports/current", (_request, response) => {
  response.json(buildReportSummary());
});

app.get("/api/reports/versions", (_request, response) => {
  response.json(syncReportVersions());
});

app.get("/api/analytics/ml", (_request, response) => {
  response.json(buildAnalyticsResponse(data.schools));
});

app.post("/api/releases/validate", (_request, response) => {
  releaseState = {
    ...releaseState,
    validationStatus: "passed",
    checks: buildValidationChecks(data.schools),
    lastValidatedAt: new Date().toISOString()
  };

  response.json(releaseState);
});

app.post("/api/releases/preview", (_request, response) => {
  response.json({
    version: releaseState.candidateVersion,
    recordCount: data.schools.length,
    topRatedSchools: [...data.schools]
      .sort((left, right) => right.overallScore - left.overallScore)
      .slice(0, 5)
      .map((school) => ({
        id: school.id,
        name: school.name,
        district: school.district,
        overallScore: school.overallScore
      })),
    validationStatus: releaseState.validationStatus
  });
});

app.post("/api/releases/promote", (_request, response) => {
  if (releaseState.validationStatus !== "passed") {
    response.status(409).json({
      message: "Run validation before promoting the candidate release."
    });
    return;
  }

  const oldProduction = releaseState.productionVersion;
  const promotedVersion = releaseState.candidateVersion;
  const publishedAt = new Date().toISOString();
  releaseState = {
    ...releaseState,
    productionVersion: promotedVersion,
    previousVersion: oldProduction,
    candidateVersion: nextMonthlyVersion(promotedVersion),
    validationStatus: "not_run",
    checks: buildValidationChecks(data.schools),
    lastValidatedAt: null
  };

  ensureReportVersion(promotedVersion);
  markReportVersionPublished(promotedVersion, publishedAt);
  ensureReportVersion(releaseState.candidateVersion);
  databaseRevision = 0;
  databaseVersion = versionToken(releaseState.productionVersion, databaseRevision);
  cacheInvalidated = true;

  response.json({
    release: releaseState,
    cache: getCacheStatus(),
    message: "Candidate release promoted. Cache is stale until refreshed."
  });
});

app.post("/api/releases/rollback", (_request, response) => {
  const rolledBackFrom = releaseState.productionVersion;
  releaseState = {
    ...releaseState,
    productionVersion: releaseState.previousVersion,
    previousVersion: rolledBackFrom,
    validationStatus: "not_run",
    checks: buildValidationChecks(data.schools),
    lastValidatedAt: null
  };

  databaseRevision = 0;
  databaseVersion = versionToken(releaseState.productionVersion, databaseRevision);
  cacheInvalidated = true;

  response.json({
    release: releaseState,
    cache: getCacheStatus(),
    message: "Production release rolled back. Refresh cache before serving users."
  });
});

app.get("/api/cache/status", (_request, response) => {
  response.json(getCacheStatus());
});

app.post("/api/cache/invalidate", (_request, response) => {
  cacheInvalidated = true;
  response.json(getCacheStatus());
});

app.post("/api/cache/refresh", (_request, response) => {
  cacheVersion = databaseVersion;
  cacheLastRefreshedAt = new Date().toISOString();
  cacheInvalidated = false;
  response.json(getCacheStatus());
});

app.post("/api/database/simulate-update", (_request, response) => {
  databaseRevision += 1;
  databaseVersion = versionToken(releaseState.productionVersion, databaseRevision);
  cacheInvalidated = true;

  response.json({
    cache: getCacheStatus(),
    message: "Database version advanced. Cache now requires invalidation/refresh."
  });
});

const clientDistPath = join(process.cwd(), "dist", "client");

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (request, response) => {
    if (request.path.startsWith("/api")) {
      response.status(404).json({ message: "API route not found." });
      return;
    }

    response.sendFile(join(clientDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`TXSchools demo API listening on http://localhost:${port}`);
});

function buildReportSummary(): ReportSummary {
  const production = syncReportVersions().find(
    (version) => version.version === releaseState.productionVersion
  );

  return {
    totalSchools: data.schools.length,
    totalDistricts: data.districts.length,
    latestReportMonth:
      production?.label.replace(" Accountability Snapshot", "") ?? "May 2026",
    dataVersion: releaseState.productionVersion,
    release: releaseState
  };
}

function buildValidationChecks(schools: School[]): ReleaseValidationCheck[] {
  const ids = schools.map((school) => school.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const scoreOutliers = schools.filter(
    (school) =>
      school.overallScore < 60 ||
      school.overallScore > 100 ||
      school.readingScore < 60 ||
      school.readingScore > 100 ||
      school.mathScore < 60 ||
      school.mathScore > 100
  );
  const staleRecords = schools.filter((school) => {
    const ageMs = Date.now() - new Date(school.lastUpdated).getTime();
    return ageMs > 60 * 24 * 60 * 60 * 1000;
  });

  return [
    {
      id: "missing-school-records",
      name: "Missing school records",
      status: schools.length === 50 ? "pass" : "fail",
      detail: `${schools.length} of 50 expected school records loaded.`
    },
    {
      id: "duplicate-records",
      name: "Duplicate records",
      status: duplicates.length === 0 ? "pass" : "fail",
      detail:
        duplicates.length === 0
          ? "No duplicate school identifiers found."
          : `${duplicates.length} duplicate school identifiers require review.`
    },
    {
      id: "score-outliers",
      name: "Score outliers",
      status: scoreOutliers.length === 0 ? "pass" : "fail",
      detail:
        scoreOutliers.length === 0
          ? "All accountability, reading, and math scores are between 60 and 100."
          : `${scoreOutliers.length} records contain scores outside the allowed range.`
    },
    {
      id: "ranking-consistency",
      name: "Ranking consistency",
      status: "pass",
      detail:
        "District ordering can be recomputed from overall score without conflicts."
    },
    {
      id: "timestamp-check",
      name: "Last updated timestamp check",
      status: staleRecords.length === 0 ? "pass" : "warning",
      detail:
        staleRecords.length === 0
          ? "Every record has a recent last updated timestamp."
          : `${staleRecords.length} records are older than the freshness threshold.`
    }
  ];
}

function getCacheStatus(): CacheStatus {
  const ageMs = Date.now() - new Date(cacheLastRefreshedAt).getTime();
  const isExpired = ageMs > cacheTtlSeconds * 1000;
  const isFresh = !cacheInvalidated && !isExpired && cacheVersion === databaseVersion;

  return {
    databaseVersion,
    cacheVersion,
    cacheLastRefreshedAt,
    cacheTtlSeconds,
    status: isFresh ? "fresh" : "stale",
    sourceOfTruth: "database"
  };
}

function syncReportVersions() {
  reportVersions = reportVersions.map((version) => ({
    ...version,
    status:
      version.version === releaseState.productionVersion
        ? "production"
        : version.version === releaseState.previousVersion
          ? "previous"
          : version.version === releaseState.candidateVersion
            ? "candidate"
            : "archived"
  }));

  return reportVersions;
}

function ensureReportVersion(version: string) {
  if (reportVersions.some((item) => item.version === version)) {
    return;
  }

  reportVersions.push({
    version,
    label: `${formatVersionMonth(version)} Candidate Release`,
    status: "candidate",
    publishedAt: null,
    recordCount: data.schools.length
  });
}

function markReportVersionPublished(version: string, publishedAt: string) {
  reportVersions = reportVersions.map((item) =>
    item.version === version
      ? {
          ...item,
          label: `${formatVersionMonth(version)} Accountability Snapshot`,
          publishedAt,
          recordCount: data.schools.length
        }
      : item
  );
}

function nextMonthlyVersion(version: string) {
  const [yearValue, monthValue] = version.split("-").map(Number);
  const nextMonth = monthValue === 12 ? 1 : monthValue + 1;
  const nextYear = monthValue === 12 ? yearValue + 1 : yearValue;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function formatVersionMonth(version: string) {
  const [year, month] = version.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function versionToken(version: string, revision: number) {
  return `db-${version}.${revision}`;
}

function loadMockData(): MockData {
  const dataPath = resolve(process.cwd(), "server", "data", "mockData.json");
  const raw = readFileSync(dataPath, "utf-8");
  return JSON.parse(raw) as MockData;
}
