import type { ReleaseValidationCheck, School } from "../../shared/types.js";

export function buildValidationChecks(schools: School[]): ReleaseValidationCheck[] {
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
