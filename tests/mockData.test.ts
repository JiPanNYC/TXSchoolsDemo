import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { District, School } from "../shared/types";

interface MockData {
  districts: District[];
  schools: School[];
}

const mockData = JSON.parse(
  readFileSync(resolve(process.cwd(), "server/data/mockData.json"), "utf-8")
) as MockData;

describe("mock data integrity", () => {
  it("contains the expected demo coverage", () => {
    expect(mockData.schools).toHaveLength(50);
    expect(mockData.districts).toHaveLength(10);
  });

  it("keeps school and district identifiers consistent", () => {
    const districtIds = new Set(mockData.districts.map((district) => district.id));
    const schoolIds = mockData.schools.map((school) => school.id);
    const invalidDistrictIds = mockData.schools
      .map((school) => school.districtId)
      .filter((districtId) => !districtIds.has(districtId));

    expect(new Set(schoolIds).size).toBe(schoolIds.length);
    expect(invalidDistrictIds).toEqual([]);
  });

  it("keeps accountability scores inside the public reporting range", () => {
    for (const school of mockData.schools) {
      expect(school.overallScore).toBeGreaterThanOrEqual(60);
      expect(school.overallScore).toBeLessThanOrEqual(100);
      expect(school.readingScore).toBeGreaterThanOrEqual(60);
      expect(school.readingScore).toBeLessThanOrEqual(100);
      expect(school.mathScore).toBeGreaterThanOrEqual(60);
      expect(school.mathScore).toBeLessThanOrEqual(100);
    }
  });
});
