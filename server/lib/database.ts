import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  District,
  PaginatedResponse,
  Rating,
  ReleaseState,
  ReleaseValidationCheck,
  ReportVersion,
  School,
  TrendPoint
} from "../../shared/types.js";
import type { SchoolQueryOptions } from "./schoolQuery.js";
import { versionToken } from "./reportVersioning.js";
import { buildValidationChecks } from "./releaseValidation.js";

export interface MockData {
  districts: District[];
  schools: School[];
  reportVersions: ReportVersion[];
}

export interface DistrictSummary extends District {
  schoolCount: number;
  averageOverallScore: number;
}

export interface CacheMetadata {
  databaseRevision: number;
  databaseVersion: string;
  cacheVersion: string;
  cacheLastRefreshedAt: string;
  cacheInvalidated: boolean;
}

interface DataStoreOptions {
  databasePath?: string;
  seedData?: MockData;
  seedDataPath?: string;
}

interface SchoolRow {
  id: string;
  official_campus_id: string | null;
  name: string;
  district_id: string;
  official_district_id: string | null;
  district_name: string;
  city: string;
  county: string;
  region: string | null;
  grade_level: School["gradeLevel"];
  low_grade: string | null;
  high_grade: string | null;
  accountability_rating: Rating;
  overall_score: number;
  reading_score: number;
  math_score: number;
  enrollment: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  principal: string | null;
  economic_disadvantaged: number | null;
  attendance_rate: number | null;
  student_teacher_ratio: number | null;
  expenditures_per_student: number | null;
  distinctions: number | null;
  data_source: string | null;
  last_updated: string;
  report_version: string;
}

interface TrendRow {
  school_id: string;
  year: number;
  overall_score: number;
  reading_score: number;
  math_score: number;
}

interface DistrictSummaryRow {
  id: string;
  name: string;
  city: string;
  region: string;
  school_count: number;
  average_overall_score: number;
}

interface ReportVersionRow {
  version: string;
  label: string;
  status: ReportVersion["status"];
  published_at: string | null;
  record_count: number;
}

interface ReleaseStateRow {
  production_version: string;
  previous_version: string;
  candidate_version: string;
  validation_status: ReleaseState["validationStatus"];
  last_validated_at: string | null;
}

interface ReleaseCheckRow {
  id: string;
  name: string;
  status: ReleaseValidationCheck["status"];
  detail: string;
}

const schemaVersion = "2026-06-sqlite-v1";
const defaultDatabasePath = process.env.DATABASE_PATH
  ? resolve(process.env.DATABASE_PATH)
  : resolve(process.cwd(), "server", "data", "txschools.sqlite");
const defaultSeedDataPath = process.env.SEED_DATA_PATH
  ? resolve(process.env.SEED_DATA_PATH)
  : resolve(process.cwd(), "server", "data", "mockData.json");

const sortColumnByField: Record<
  NonNullable<SchoolQueryOptions["sortBy"]>,
  string
> = {
  name: "name",
  district: "district_name",
  city: "city",
  gradeLevel: "grade_level",
  accountabilityRating: "accountability_rating",
  overallScore: "overall_score",
  readingScore: "reading_score",
  mathScore: "math_score",
  lastUpdated: "last_updated"
};

export function createTxSchoolsDataStore(options: DataStoreOptions = {}) {
  return new TxSchoolsDataStore(options);
}

export function loadSeedData(seedDataPath = defaultSeedDataPath): MockData {
  const raw = readFileSync(seedDataPath, "utf-8");
  return JSON.parse(raw) as MockData;
}

export class TxSchoolsDataStore {
  private readonly db: Database.Database;

  constructor(options: DataStoreOptions = {}) {
    const databasePath = options.databasePath ?? defaultDatabasePath;
    const seedData = options.seedData ?? loadSeedData(options.seedDataPath);

    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.db = new Database(databasePath);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.applySchema();
    this.seedIfNeeded(seedData);
  }

  close() {
    this.db.close();
  }

  countSchools() {
    const row = this.db
      .prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM schools")
      .get();
    return row?.count ?? 0;
  }

  countDistricts() {
    const row = this.db
      .prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM districts")
      .get();
    return row?.count ?? 0;
  }

  getAllSchools() {
    const rows = this.db
      .prepare<[], SchoolRow>("SELECT * FROM schools ORDER BY name")
      .all();
    return this.hydrateSchools(rows);
  }

  getSchoolById(id: string) {
    const row = this.db
      .prepare<[string], SchoolRow>("SELECT * FROM schools WHERE id = ?")
      .get(id);

    if (!row) {
      return undefined;
    }

    return this.hydrateSchools([row])[0];
  }

  querySchools(options: SchoolQueryOptions): PaginatedResponse<School> {
    const requestedPage = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
    const { whereSql, params } = buildSchoolFilter(options);
    const sortBy = options.sortBy ?? "overallScore";
    const sortColumn = sortColumnByField[sortBy];
    const sortDirection = options.sortDir === "asc" ? "ASC" : "DESC";
    const countRow = this.db
      .prepare<Record<string, string | number>, { total: number }>(
        `SELECT COUNT(*) AS total FROM schools ${whereSql}`
      )
      .get(params);
    const total = countRow?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;
    const rows = this.db
      .prepare<Record<string, string | number>, SchoolRow>(
        `
        SELECT *
        FROM schools
        ${whereSql}
        ORDER BY ${sortColumn} ${sortDirection}, name ASC
        LIMIT @pageSize OFFSET @offset
        `
      )
      .all({ ...params, pageSize, offset });

    return {
      data: this.hydrateSchools(rows),
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };
  }

  getDistrictSummaries(): DistrictSummary[] {
    const rows = this.db
      .prepare<[], DistrictSummaryRow>(
        `
        SELECT
          d.id,
          d.name,
          d.city,
          d.region,
          COUNT(s.id) AS school_count,
          ROUND(COALESCE(AVG(s.overall_score), 0), 1) AS average_overall_score
        FROM districts d
        LEFT JOIN schools s ON s.district_id = d.id
        GROUP BY d.id, d.name, d.city, d.region
        ORDER BY d.name
        `
      )
      .all();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      region: row.region,
      schoolCount: row.school_count,
      averageOverallScore: row.average_overall_score
    }));
  }

  getReportVersions(): ReportVersion[] {
    const rows = this.db
      .prepare<[], ReportVersionRow>(
        "SELECT * FROM report_versions ORDER BY version DESC"
      )
      .all();

    return rows.map(toReportVersion);
  }

  saveReportVersions(reportVersions: ReportVersion[]) {
    const saveVersion = this.db.prepare<
      {
        version: string;
        label: string;
        status: ReportVersion["status"];
        publishedAt: string | null;
        recordCount: number;
      },
      unknown
    >(
      `
      INSERT INTO report_versions (
        version,
        label,
        status,
        published_at,
        record_count
      )
      VALUES (
        @version,
        @label,
        @status,
        @publishedAt,
        @recordCount
      )
      ON CONFLICT(version) DO UPDATE SET
        label = excluded.label,
        status = excluded.status,
        published_at = excluded.published_at,
        record_count = excluded.record_count
      `
    );
    const saveAll = this.db.transaction((versions: ReportVersion[]) => {
      for (const version of versions) {
        saveVersion.run({
          version: version.version,
          label: version.label,
          status: version.status,
          publishedAt: version.publishedAt,
          recordCount: version.recordCount
        });
      }
    });

    saveAll(reportVersions);
  }

  ensureReportVersion(reportVersion: ReportVersion) {
    this.saveReportVersions([reportVersion]);
  }

  getReleaseState(): ReleaseState {
    const row = this.db
      .prepare<[], ReleaseStateRow>("SELECT * FROM release_state WHERE id = 1")
      .get();
    const checks = this.getReleaseChecks();

    if (!row) {
      throw new Error("Release state is missing from the SQLite data store.");
    }

    return {
      productionVersion: row.production_version,
      previousVersion: row.previous_version,
      candidateVersion: row.candidate_version,
      validationStatus: row.validation_status,
      checks,
      lastValidatedAt: row.last_validated_at
    };
  }

  saveReleaseState(releaseState: ReleaseState) {
    const saveState = this.db.prepare<
      {
        productionVersion: string;
        previousVersion: string;
        candidateVersion: string;
        validationStatus: ReleaseState["validationStatus"];
        lastValidatedAt: string | null;
      },
      unknown
    >(
      `
      INSERT INTO release_state (
        id,
        production_version,
        previous_version,
        candidate_version,
        validation_status,
        last_validated_at
      )
      VALUES (
        1,
        @productionVersion,
        @previousVersion,
        @candidateVersion,
        @validationStatus,
        @lastValidatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        production_version = excluded.production_version,
        previous_version = excluded.previous_version,
        candidate_version = excluded.candidate_version,
        validation_status = excluded.validation_status,
        last_validated_at = excluded.last_validated_at
      `
    );
    const deleteChecks = this.db.prepare("DELETE FROM release_checks");
    const saveCheck = this.db.prepare<
      ReleaseValidationCheck,
      unknown
    >(
      `
      INSERT INTO release_checks (
        id,
        name,
        status,
        detail
      )
      VALUES (
        @id,
        @name,
        @status,
        @detail
      )
      `
    );
    const save = this.db.transaction((nextState: ReleaseState) => {
      saveState.run({
        productionVersion: nextState.productionVersion,
        previousVersion: nextState.previousVersion,
        candidateVersion: nextState.candidateVersion,
        validationStatus: nextState.validationStatus,
        lastValidatedAt: nextState.lastValidatedAt
      });
      deleteChecks.run();
      for (const check of nextState.checks) {
        saveCheck.run(check);
      }
    });

    save(releaseState);
  }

  getCacheMetadata(): CacheMetadata {
    const metadata = this.getMetadataMap("cache_metadata");

    return {
      databaseRevision: Number(metadata.get("database_revision") ?? 0),
      databaseVersion: metadata.get("database_version") ?? "db-unknown.0",
      cacheVersion: metadata.get("cache_version") ?? "db-unknown.0",
      cacheLastRefreshedAt:
        metadata.get("cache_last_refreshed_at") ?? new Date().toISOString(),
      cacheInvalidated: metadata.get("cache_invalidated") === "true"
    };
  }

  saveCacheMetadata(cacheMetadata: CacheMetadata) {
    const save = this.db.prepare<[string, string], unknown>(
      `
      INSERT INTO cache_metadata (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `
    );
    const saveAll = this.db.transaction((metadata: CacheMetadata) => {
      save.run("database_revision", String(metadata.databaseRevision));
      save.run("database_version", metadata.databaseVersion);
      save.run("cache_version", metadata.cacheVersion);
      save.run("cache_last_refreshed_at", metadata.cacheLastRefreshedAt);
      save.run("cache_invalidated", String(metadata.cacheInvalidated));
    });

    saveAll(cacheMetadata);
  }

  private applySchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS districts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        region TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS report_versions (
        version TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        status TEXT NOT NULL CHECK (
          status IN ('production', 'previous', 'candidate', 'archived')
        ),
        published_at TEXT,
        record_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schools (
        id TEXT PRIMARY KEY,
        official_campus_id TEXT,
        name TEXT NOT NULL,
        district_id TEXT NOT NULL REFERENCES districts(id),
        official_district_id TEXT,
        district_name TEXT NOT NULL,
        city TEXT NOT NULL,
        county TEXT NOT NULL,
        region TEXT,
        grade_level TEXT NOT NULL CHECK (
          grade_level IN ('Elementary', 'Middle', 'High', 'K-8', 'K-12')
        ),
        low_grade TEXT,
        high_grade TEXT,
        accountability_rating TEXT NOT NULL CHECK (
          accountability_rating IN ('A', 'B', 'C', 'D', 'F')
        ),
        overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
        reading_score INTEGER NOT NULL CHECK (reading_score BETWEEN 0 AND 100),
        math_score INTEGER NOT NULL CHECK (math_score BETWEEN 0 AND 100),
        enrollment INTEGER NOT NULL CHECK (enrollment >= 0),
        address TEXT,
        phone TEXT,
        website TEXT,
        principal TEXT,
        economic_disadvantaged REAL,
        attendance_rate REAL,
        student_teacher_ratio REAL,
        expenditures_per_student INTEGER,
        distinctions INTEGER,
        data_source TEXT,
        last_updated TEXT NOT NULL,
        report_version TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS school_trends (
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
        reading_score INTEGER NOT NULL CHECK (reading_score BETWEEN 0 AND 100),
        math_score INTEGER NOT NULL CHECK (math_score BETWEEN 0 AND 100),
        PRIMARY KEY (school_id, year)
      );

      CREATE TABLE IF NOT EXISTS release_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        production_version TEXT NOT NULL,
        previous_version TEXT NOT NULL,
        candidate_version TEXT NOT NULL,
        validation_status TEXT NOT NULL CHECK (
          validation_status IN ('not_run', 'running', 'passed', 'warning', 'failed')
        ),
        last_validated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS release_checks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pass', 'warning', 'fail')),
        detail TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cache_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_schools_search ON schools (
        name,
        district_name,
        city,
        accountability_rating,
        grade_level
      );
      CREATE INDEX IF NOT EXISTS idx_schools_score ON schools (overall_score);
      CREATE INDEX IF NOT EXISTS idx_schools_district ON schools (district_id);
    `);
  }

  private seedIfNeeded(seedData: MockData) {
    const seedHash = hashSeedData(seedData);
    const currentSchemaVersion = this.getSchemaMetadata("schema_version");
    const currentSeedHash = this.getSchemaMetadata("seed_hash");

    if (
      currentSchemaVersion === schemaVersion &&
      currentSeedHash === seedHash &&
      this.countSchools() > 0
    ) {
      return;
    }

    const seed = this.db.transaction((data: MockData) => {
      this.db.prepare("DELETE FROM release_checks").run();
      this.db.prepare("DELETE FROM release_state").run();
      this.db.prepare("DELETE FROM cache_metadata").run();
      this.db.prepare("DELETE FROM school_trends").run();
      this.db.prepare("DELETE FROM schools").run();
      this.db.prepare("DELETE FROM report_versions").run();
      this.db.prepare("DELETE FROM districts").run();
      this.db.prepare("DELETE FROM schema_metadata").run();

      this.insertDistricts(data.districts);
      this.insertReportVersions(data.reportVersions);
      this.insertSchools(data.schools);
      this.insertInitialReleaseState(data);
      this.insertInitialCacheMetadata(data);
      this.setSchemaMetadata("schema_version", schemaVersion);
      this.setSchemaMetadata("seed_hash", seedHash);
    });

    seed(seedData);
  }

  private insertDistricts(districts: District[]) {
    const insertDistrict = this.db.prepare<District, unknown>(
      `
      INSERT INTO districts (
        id,
        name,
        city,
        region
      )
      VALUES (
        @id,
        @name,
        @city,
        @region
      )
      `
    );

    for (const district of districts) {
      insertDistrict.run(district);
    }
  }

  private insertReportVersions(reportVersions: ReportVersion[]) {
    const insertVersion = this.db.prepare<
      {
        version: string;
        label: string;
        status: ReportVersion["status"];
        publishedAt: string | null;
        recordCount: number;
      },
      unknown
    >(
      `
      INSERT INTO report_versions (
        version,
        label,
        status,
        published_at,
        record_count
      )
      VALUES (
        @version,
        @label,
        @status,
        @publishedAt,
        @recordCount
      )
      `
    );

    for (const version of reportVersions) {
      insertVersion.run({
        version: version.version,
        label: version.label,
        status: version.status,
        publishedAt: version.publishedAt,
        recordCount: version.recordCount
      });
    }
  }

  private insertSchools(schools: School[]) {
    const insertSchool = this.db.prepare<
      {
        id: string;
        officialCampusId: string | null;
        name: string;
        districtId: string;
        officialDistrictId: string | null;
        district: string;
        city: string;
        county: string;
        region: string | null;
        gradeLevel: School["gradeLevel"];
        lowGrade: string | null;
        highGrade: string | null;
        accountabilityRating: Rating;
        overallScore: number;
        readingScore: number;
        mathScore: number;
        enrollment: number;
        address: string | null;
        phone: string | null;
        website: string | null;
        principal: string | null;
        economicDisadvantaged: number | null;
        attendanceRate: number | null;
        studentTeacherRatio: number | null;
        expendituresPerStudent: number | null;
        distinctions: number | null;
        dataSource: string | null;
        lastUpdated: string;
        reportVersion: string;
      },
      unknown
    >(
      `
      INSERT INTO schools (
        id,
        official_campus_id,
        name,
        district_id,
        official_district_id,
        district_name,
        city,
        county,
        region,
        grade_level,
        low_grade,
        high_grade,
        accountability_rating,
        overall_score,
        reading_score,
        math_score,
        enrollment,
        address,
        phone,
        website,
        principal,
        economic_disadvantaged,
        attendance_rate,
        student_teacher_ratio,
        expenditures_per_student,
        distinctions,
        data_source,
        last_updated,
        report_version
      )
      VALUES (
        @id,
        @officialCampusId,
        @name,
        @districtId,
        @officialDistrictId,
        @district,
        @city,
        @county,
        @region,
        @gradeLevel,
        @lowGrade,
        @highGrade,
        @accountabilityRating,
        @overallScore,
        @readingScore,
        @mathScore,
        @enrollment,
        @address,
        @phone,
        @website,
        @principal,
        @economicDisadvantaged,
        @attendanceRate,
        @studentTeacherRatio,
        @expendituresPerStudent,
        @distinctions,
        @dataSource,
        @lastUpdated,
        @reportVersion
      )
      `
    );
    const insertTrend = this.db.prepare<
      {
        schoolId: string;
        year: number;
        overallScore: number;
        readingScore: number;
        mathScore: number;
      },
      unknown
    >(
      `
      INSERT INTO school_trends (
        school_id,
        year,
        overall_score,
        reading_score,
        math_score
      )
      VALUES (
        @schoolId,
        @year,
        @overallScore,
        @readingScore,
        @mathScore
      )
      `
    );

    for (const school of schools) {
      insertSchool.run({
        id: school.id,
        officialCampusId: school.officialCampusId ?? null,
        name: school.name,
        districtId: school.districtId,
        officialDistrictId: school.officialDistrictId ?? null,
        district: school.district,
        city: school.city,
        county: school.county,
        region: school.region ?? null,
        gradeLevel: school.gradeLevel,
        lowGrade: school.lowGrade ?? null,
        highGrade: school.highGrade ?? null,
        accountabilityRating: school.accountabilityRating,
        overallScore: school.overallScore,
        readingScore: school.readingScore,
        mathScore: school.mathScore,
        enrollment: school.enrollment,
        address: school.address ?? null,
        phone: school.phone ?? null,
        website: school.website ?? null,
        principal: school.principal ?? null,
        economicDisadvantaged: school.economicDisadvantaged ?? null,
        attendanceRate: school.attendanceRate ?? null,
        studentTeacherRatio: school.studentTeacherRatio ?? null,
        expendituresPerStudent: school.expendituresPerStudent ?? null,
        distinctions: school.distinctions ?? null,
        dataSource: school.dataSource ?? null,
        lastUpdated: school.lastUpdated,
        reportVersion: school.reportVersion
      });

      for (const trendPoint of school.trend) {
        insertTrend.run({
          schoolId: school.id,
          year: trendPoint.year,
          overallScore: trendPoint.overallScore,
          readingScore: trendPoint.readingScore,
          mathScore: trendPoint.mathScore
        });
      }
    }
  }

  private insertInitialReleaseState(data: MockData) {
    const productionVersion =
      data.reportVersions.find((version) => version.status === "production")
        ?.version ?? "2026-05";
    const previousVersion =
      data.reportVersions.find((version) => version.status === "previous")?.version ??
      "2026-04";
    const candidateVersion =
      data.reportVersions.find((version) => version.status === "candidate")
        ?.version ?? "2026-06";

    this.saveReleaseState({
      productionVersion,
      previousVersion,
      candidateVersion,
      validationStatus: "not_run",
      checks: buildValidationChecks(data.schools),
      lastValidatedAt: null
    });
  }

  private insertInitialCacheMetadata(data: MockData) {
    const productionVersion =
      data.reportVersions.find((version) => version.status === "production")
        ?.version ?? "2026-05";
    const databaseVersion = versionToken(productionVersion, 0);

    this.saveCacheMetadata({
      databaseRevision: 0,
      databaseVersion,
      cacheVersion: databaseVersion,
      cacheLastRefreshedAt: new Date().toISOString(),
      cacheInvalidated: false
    });
  }

  private getReleaseChecks() {
    const rows = this.db
      .prepare<[], ReleaseCheckRow>(
        "SELECT * FROM release_checks ORDER BY rowid ASC"
      )
      .all();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      detail: row.detail
    }));
  }

  private hydrateSchools(rows: SchoolRow[]) {
    const trendsBySchool = this.getTrendsBySchoolIds(rows.map((row) => row.id));

    return rows.map((row) => toSchool(row, trendsBySchool.get(row.id) ?? []));
  }

  private getTrendsBySchoolIds(schoolIds: string[]) {
    const trendsBySchool = new Map<string, TrendPoint[]>();

    if (schoolIds.length === 0) {
      return trendsBySchool;
    }

    const placeholders = schoolIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM school_trends
        WHERE school_id IN (${placeholders})
        ORDER BY school_id, year
        `
      )
      .all(...schoolIds) as TrendRow[];

    for (const row of rows) {
      const trend = trendsBySchool.get(row.school_id) ?? [];
      trend.push({
        year: row.year,
        overallScore: row.overall_score,
        readingScore: row.reading_score,
        mathScore: row.math_score
      });
      trendsBySchool.set(row.school_id, trend);
    }

    return trendsBySchool;
  }

  private getSchemaMetadata(key: string) {
    const row = this.db
      .prepare<[string], { value: string }>(
        "SELECT value FROM schema_metadata WHERE key = ?"
      )
      .get(key);
    return row?.value;
  }

  private setSchemaMetadata(key: string, value: string) {
    this.db
      .prepare<[string, string], unknown>(
        `
        INSERT INTO schema_metadata (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `
      )
      .run(key, value);
  }

  private getMetadataMap(tableName: "cache_metadata") {
    const rows = this.db
      .prepare<[], { key: string; value: string }>(
        `SELECT key, value FROM ${tableName}`
      )
      .all();
    return new Map(rows.map((row) => [row.key, row.value]));
  }
}

function buildSchoolFilter(options: SchoolQueryOptions) {
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  const search = normalize(options.search);
  const rating = options.rating && options.rating !== "all" ? options.rating : "";
  const district = normalize(options.district);
  const city = normalize(options.city);
  const gradeLevel = normalize(options.gradeLevel);

  if (search) {
    params.search = `%${escapeLike(search)}%`;
    where.push(`
      (
        lower(name) LIKE @search ESCAPE '\\' OR
        lower(district_name) LIKE @search ESCAPE '\\' OR
        lower(city) LIKE @search ESCAPE '\\' OR
        lower(accountability_rating) LIKE @search ESCAPE '\\' OR
        lower(grade_level) LIKE @search ESCAPE '\\'
      )
    `);
  }

  if (rating) {
    params.rating = rating;
    where.push("accountability_rating = @rating");
  }

  if (district) {
    params.district = district;
    where.push("lower(district_name) = @district");
  }

  if (city) {
    params.city = city;
    where.push("lower(city) = @city");
  }

  if (gradeLevel) {
    params.gradeLevel = gradeLevel;
    where.push("lower(grade_level) = @gradeLevel");
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params
  };
}

function toSchool(row: SchoolRow, trend: TrendPoint[]): School {
  return {
    id: row.id,
    officialCampusId: optionalString(row.official_campus_id),
    name: row.name,
    districtId: row.district_id,
    officialDistrictId: optionalString(row.official_district_id),
    district: row.district_name,
    city: row.city,
    county: row.county,
    region: optionalString(row.region),
    gradeLevel: row.grade_level,
    lowGrade: optionalString(row.low_grade),
    highGrade: optionalString(row.high_grade),
    accountabilityRating: row.accountability_rating,
    overallScore: row.overall_score,
    readingScore: row.reading_score,
    mathScore: row.math_score,
    enrollment: row.enrollment,
    address: optionalString(row.address),
    phone: optionalString(row.phone),
    website: optionalString(row.website),
    principal: optionalString(row.principal),
    economicDisadvantaged: optionalNumber(row.economic_disadvantaged),
    attendanceRate: optionalNumber(row.attendance_rate),
    studentTeacherRatio: optionalNumber(row.student_teacher_ratio),
    expendituresPerStudent: optionalNumber(row.expenditures_per_student),
    distinctions: optionalNumber(row.distinctions),
    dataSource: optionalString(row.data_source),
    lastUpdated: row.last_updated,
    reportVersion: row.report_version,
    trend
  };
}

function toReportVersion(row: ReportVersionRow): ReportVersion {
  return {
    version: row.version,
    label: row.label,
    status: row.status,
    publishedAt: row.published_at,
    recordCount: row.record_count
  };
}

function hashSeedData(seedData: MockData) {
  return createHash("sha256").update(JSON.stringify(seedData)).digest("hex");
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function optionalString(value: string | null) {
  return value ?? undefined;
}

function optionalNumber(value: number | null) {
  return value ?? undefined;
}
