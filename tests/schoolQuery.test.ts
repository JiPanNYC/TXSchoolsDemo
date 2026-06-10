import { describe, expect, it } from "vitest";
import type { School } from "../shared/types";
import { applySchoolQuery, parseSchoolQuery } from "../server/lib/schoolQuery";

const schools: School[] = [
  {
    id: "s-1",
    name: "Austin North High",
    districtId: "d-1",
    district: "Capital Metro ISD",
    city: "Austin",
    county: "Travis",
    gradeLevel: "High",
    accountabilityRating: "A",
    overallScore: 94,
    readingScore: 92,
    mathScore: 96,
    enrollment: 900,
    lastUpdated: "2026-05-31T18:00:00.000Z",
    reportVersion: "2026-05",
    trend: []
  },
  {
    id: "s-2",
    name: "Dallas Central Middle",
    districtId: "d-2",
    district: "Trinity River ISD",
    city: "Dallas",
    county: "Dallas",
    gradeLevel: "Middle",
    accountabilityRating: "C",
    overallScore: 74,
    readingScore: 76,
    mathScore: 72,
    enrollment: 800,
    lastUpdated: "2026-05-28T18:00:00.000Z",
    reportVersion: "2026-05",
    trend: []
  },
  {
    id: "s-3",
    name: "Houston Gateway High",
    districtId: "d-3",
    district: "Gulf Coast ISD",
    city: "Houston",
    county: "Harris",
    gradeLevel: "High",
    accountabilityRating: "B",
    overallScore: 86,
    readingScore: 84,
    mathScore: 88,
    enrollment: 1100,
    lastUpdated: "2026-05-29T18:00:00.000Z",
    reportVersion: "2026-05",
    trend: []
  }
];

describe("school query utilities", () => {
  it("filters by text search and rating", () => {
    const result = applySchoolQuery(schools, {
      search: "high",
      rating: "B",
      page: 1,
      pageSize: 10
    });

    expect(result.pagination.total).toBe(1);
    expect(result.data[0].name).toBe("Houston Gateway High");
  });

  it("sorts and paginates school records", () => {
    const result = applySchoolQuery(schools, {
      sortBy: "overallScore",
      sortDir: "desc",
      page: 2,
      pageSize: 1
    });

    expect(result.pagination.totalPages).toBe(3);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Houston Gateway High");
  });

  it("clamps out-of-range pages to the last available page", () => {
    const result = applySchoolQuery(schools, {
      sortBy: "overallScore",
      sortDir: "desc",
      page: 99,
      pageSize: 1
    });

    expect(result.pagination.page).toBe(3);
    expect(result.pagination.totalPages).toBe(3);
    expect(result.data[0].name).toBe("Dallas Central Middle");
  });

  it("normalizes unsafe query values", () => {
    const query = parseSchoolQuery({
      page: "-20",
      pageSize: "500",
      sortBy: "not-a-column",
      sortDir: "sideways",
      rating: "Z"
    });

    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(50);
    expect(query.sortBy).toBe("overallScore");
    expect(query.sortDir).toBe("desc");
    expect(query.rating).toBe("all");
  });
});
