import { describe, expect, it } from "vitest";
import type { School } from "../shared/types";
import { buildAnalyticsResponse } from "../server/lib/analytics";

const schools: School[] = Array.from({ length: 12 }, (_, index) => {
  const score = 65 + index * 3;
  return {
    id: `s-${index}`,
    name: `School ${index}`,
    districtId: index < 6 ? "d-1" : "d-2",
    district: index < 6 ? "North ISD" : "South ISD",
    city: index < 6 ? "Austin" : "Dallas",
    county: "Demo",
    gradeLevel: index % 2 === 0 ? "High" : "Elementary",
    accountabilityRating:
      score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : "D",
    overallScore: score,
    readingScore: score - 1,
    mathScore: score - 2,
    enrollment: 500 + index * 20,
    economicDisadvantaged: 80 - index * 4,
    attendanceRate: 88 + index * 0.7,
    studentTeacherRatio: 10 + index * 0.4,
    expendituresPerStudent: 10000 + index * 500,
    lastUpdated: "2026-06-01T00:00:00.000Z",
    reportVersion: "2024-25",
    trend: []
  };
});

describe("analytics response", () => {
  it("builds aggregate, cluster, and model outputs", () => {
    const analytics = buildAnalyticsResponse(schools);

    expect(analytics.sampleSize).toBe(12);
    expect(
      analytics.ratingDistribution.reduce((sum, bucket) => sum + bucket.count, 0)
    ).toBe(12);
    expect(analytics.districtAnalytics).toHaveLength(2);
    expect(analytics.correlations.length).toBeGreaterThan(3);
    expect(analytics.scatter).toHaveLength(3);
    expect(analytics.clusters.length).toBeGreaterThan(1);
    expect(analytics.model.predictions.length).toBeGreaterThan(0);
    expect(analytics.model.featureImportance[0].importance).toBeGreaterThanOrEqual(0);
  });

  it("keeps model metrics stable when API or database ordering changes", () => {
    const originalModel = buildAnalyticsResponse(schools).model;
    const reversedModel = buildAnalyticsResponse([...schools].reverse()).model;

    expect(reversedModel.mae).toBe(originalModel.mae);
    expect(reversedModel.r2).toBe(originalModel.r2);
    expect(reversedModel.featureImportance).toEqual(originalModel.featureImportance);
    expect(reversedModel.predictions.map((prediction) => prediction.id)).toEqual(
      originalModel.predictions.map((prediction) => prediction.id)
    );
  });
});
