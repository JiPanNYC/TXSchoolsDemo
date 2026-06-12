import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  CacheStatus,
  ReportSummary,
  ReportVersion
} from "../shared/types.js";
import { buildAnalyticsResponse } from "./lib/analytics.js";
import {
  createTxSchoolsDataStore,
  type CacheMetadata
} from "./lib/database.js";
import {
  formatVersionMonth,
  nextMonthlyVersion,
  versionToken
} from "./lib/reportVersioning.js";
import { buildValidationChecks } from "./lib/releaseValidation.js";
import { parseSchoolQuery } from "./lib/schoolQuery.js";

const app = express();
const port = Number(process.env.PORT ?? 4174);
const host = process.env.HOST;
const cacheTtlSeconds = 15 * 60;
const store = createTxSchoolsDataStore();

let releaseState = store.getReleaseState();
let cacheMetadata = store.getCacheMetadata();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "txschools-demo-api" });
});

app.get("/api/schools", (request, response) => {
  const query = parseSchoolQuery(request.query);
  response.json(store.querySchools(query));
});

app.get("/api/schools/:id", (request, response) => {
  const school = store.getSchoolById(request.params.id);

  if (!school) {
    response.status(404).json({ message: "School record not found." });
    return;
  }

  response.json(school);
});

app.get("/api/districts", (_request, response) => {
  response.json(store.getDistrictSummaries());
});

app.get("/api/reports/current", (_request, response) => {
  response.json(buildReportSummary());
});

app.get("/api/reports/versions", (_request, response) => {
  response.json(syncReportVersions());
});

app.get("/api/analytics/ml", (_request, response) => {
  response.json(buildAnalyticsResponse(store.getAllSchools()));
});

app.post("/api/releases/validate", (_request, response) => {
  releaseState = {
    ...releaseState,
    validationStatus: "passed",
    checks: buildValidationChecks(store.getAllSchools()),
    lastValidatedAt: new Date().toISOString()
  };
  store.saveReleaseState(releaseState);

  response.json(releaseState);
});

app.post("/api/releases/preview", (_request, response) => {
  response.json({
    version: releaseState.candidateVersion,
    recordCount: store.countSchools(),
    topRatedSchools: store
      .querySchools({
        sortBy: "overallScore",
        sortDir: "desc",
        page: 1,
        pageSize: 5
      })
      .data.map((school) => ({
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
    checks: buildValidationChecks(store.getAllSchools()),
    lastValidatedAt: null
  };

  ensureReportVersion(promotedVersion);
  markReportVersionPublished(promotedVersion, publishedAt);
  ensureReportVersion(releaseState.candidateVersion);
  store.saveReleaseState(releaseState);
  syncReportVersions();
  markSourceOfTruthChanged(releaseState.productionVersion);

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
    checks: buildValidationChecks(store.getAllSchools()),
    lastValidatedAt: null
  };
  store.saveReleaseState(releaseState);
  syncReportVersions();
  markSourceOfTruthChanged(releaseState.productionVersion);

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
  saveCacheMetadata({
    ...cacheMetadata,
    cacheInvalidated: true
  });
  response.json(getCacheStatus());
});

app.post("/api/cache/refresh", (_request, response) => {
  saveCacheMetadata({
    ...cacheMetadata,
    cacheVersion: cacheMetadata.databaseVersion,
    cacheLastRefreshedAt: new Date().toISOString(),
    cacheInvalidated: false
  });
  response.json(getCacheStatus());
});

app.post("/api/database/simulate-update", (_request, response) => {
  const nextRevision = cacheMetadata.databaseRevision + 1;
  saveCacheMetadata({
    ...cacheMetadata,
    databaseRevision: nextRevision,
    databaseVersion: versionToken(releaseState.productionVersion, nextRevision),
    cacheInvalidated: true
  });

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

const logStartup = () => {
  const address = host ?? "0.0.0.0";
  console.log(`TXSchools demo API listening on http://${address}:${port}`);
};

if (host) {
  app.listen(port, host, logStartup);
} else {
  app.listen(port, logStartup);
}

function buildReportSummary(): ReportSummary {
  const production = syncReportVersions().find(
    (version) => version.version === releaseState.productionVersion
  );

  return {
    totalSchools: store.countSchools(),
    totalDistricts: store.countDistricts(),
    latestReportMonth:
      production?.label.replace(" Accountability Snapshot", "") ?? "May 2026",
    dataVersion: releaseState.productionVersion,
    release: releaseState
  };
}

function getCacheStatus(): CacheStatus {
  const ageMs = Date.now() - new Date(cacheMetadata.cacheLastRefreshedAt).getTime();
  const isExpired = ageMs > cacheTtlSeconds * 1000;
  const isFresh =
    !cacheMetadata.cacheInvalidated &&
    !isExpired &&
    cacheMetadata.cacheVersion === cacheMetadata.databaseVersion;

  return {
    databaseVersion: cacheMetadata.databaseVersion,
    cacheVersion: cacheMetadata.cacheVersion,
    cacheLastRefreshedAt: cacheMetadata.cacheLastRefreshedAt,
    cacheTtlSeconds,
    status: isFresh ? "fresh" : "stale",
    sourceOfTruth: "database"
  };
}

function syncReportVersions() {
  const versions = store.getReportVersions().map((version) => ({
    ...version,
    status: reportStatus(version.version)
  }));
  store.saveReportVersions(versions);

  return versions;
}

function reportStatus(version: string): ReportVersion["status"] {
  if (version === releaseState.productionVersion) {
    return "production";
  }

  if (version === releaseState.previousVersion) {
    return "previous";
  }

  if (version === releaseState.candidateVersion) {
    return "candidate";
  }

  return "archived";
}

function ensureReportVersion(version: string) {
  if (store.getReportVersions().some((item) => item.version === version)) {
    return;
  }

  store.ensureReportVersion({
    version,
    label: `${formatVersionMonth(version)} Candidate Release`,
    status: "candidate",
    publishedAt: null,
    recordCount: store.countSchools()
  });
}

function markReportVersionPublished(version: string, publishedAt: string) {
  const versions = store.getReportVersions().map((item) =>
    item.version === version
      ? {
          ...item,
          label: `${formatVersionMonth(version)} Accountability Snapshot`,
          publishedAt,
          recordCount: store.countSchools()
        }
      : item
  );
  store.saveReportVersions(versions);
}

function markSourceOfTruthChanged(productionVersion: string) {
  saveCacheMetadata({
    ...cacheMetadata,
    databaseRevision: 0,
    databaseVersion: versionToken(productionVersion, 0),
    cacheInvalidated: true
  });
}

function saveCacheMetadata(nextMetadata: CacheMetadata) {
  cacheMetadata = nextMetadata;
  store.saveCacheMetadata(cacheMetadata);
}
