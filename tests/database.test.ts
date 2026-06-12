import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTxSchoolsDataStore,
  type TxSchoolsDataStore
} from "../server/lib/database";

let stores: TxSchoolsDataStore[] = [];
let tempDirs: string[] = [];

afterEach(() => {
  for (const store of stores) {
    store.close();
  }

  for (const tempDir of tempDirs) {
    rmSync(tempDir, { recursive: true, force: true });
  }

  stores = [];
  tempDirs = [];
});

describe("SQLite data store", () => {
  it("seeds relational tables from the mock JSON artifact", () => {
    const store = createTestStore();

    expect(store.countSchools()).toBe(50);
    expect(store.countDistricts()).toBe(10);
    expect(store.getReportVersions()).toHaveLength(3);
    expect(store.getReleaseState().productionVersion).toBe("2026-05");
  });

  it("queries, sorts, and paginates school records from SQLite", () => {
    const store = createTestStore();
    const result = store.querySchools({
      search: "austin",
      rating: "A",
      sortBy: "overallScore",
      sortDir: "desc",
      page: 1,
      pageSize: 5
    });

    expect(result.pagination.total).toBeGreaterThan(0);
    expect(result.pagination.pageSize).toBe(5);
    expect(result.data.every((school) => school.city === "Austin")).toBe(true);
    expect(
      result.data.every((school) => school.accountabilityRating === "A")
    ).toBe(true);
  });

  it("hydrates school detail records with normalized trend rows", () => {
    const store = createTestStore();
    const school = store.getSchoolById("227901018");

    expect(school?.name).toBe("Lasa HS");
    expect(school?.trend).toHaveLength(3);
    expect(school?.trend[0].year).toBe(2023);
  });

  it("persists cache metadata updates", () => {
    const store = createTestStore();
    const metadata = store.getCacheMetadata();

    store.saveCacheMetadata({
      ...metadata,
      databaseRevision: metadata.databaseRevision + 1,
      databaseVersion: "db-test.1",
      cacheInvalidated: true
    });

    expect(store.getCacheMetadata()).toMatchObject({
      databaseRevision: 1,
      databaseVersion: "db-test.1",
      cacheInvalidated: true
    });
  });
});

function createTestStore() {
  const tempDir = mkdtempSync(join(tmpdir(), "txschools-db-"));
  const store = createTxSchoolsDataStore({
    databasePath: join(tempDir, "txschools.sqlite")
  });

  stores.push(store);
  tempDirs.push(tempDir);

  return store;
}
