import { writeFile } from "node:fs/promises";

const sourceBaseUrl = "https://txschools.gov/data";
const sourceFiles = [
  "schools",
  "districts",
  "change_over_time",
  "student_achievement_tab",
  "profile_tab",
  "finance_school"
];

const selectedDistricts = [
  "Austin ISD",
  "Houston ISD",
  "Dallas ISD",
  "Northside ISD",
  "Fort Worth ISD",
  "El Paso ISD",
  "Plano ISD",
  "Round Rock ISD",
  "McAllen ISD",
  "Corpus Christi ISD"
];

const reportPublishedAt = "2026-06-01T16:15:19.000Z";

const data = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (name) => {
      const response = await fetch(`${sourceBaseUrl}/${name}.json`);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${name}.json: ${response.status}`);
      }

      return [name, await response.json()];
    })
  )
);

const districtByName = new Map(
  data.districts.map((district) => [district.district_name, district])
);
const trendById = indexById(data.change_over_time);
const achievementById = indexById(data.student_achievement_tab);
const profileById = indexById(data.profile_tab);
const financeById = indexById(data.finance_school);

const districts = selectedDistricts.map((name) => {
  const district = districtByName.get(name);

  if (!district) {
    throw new Error(`Selected district not found in source data: ${name}`);
  }

  return {
    id: district.id,
    name: district.name,
    city: titleCase(district.city),
    region: district.region
  };
});

const schools = selectedDistricts.flatMap((districtName) => {
  const candidates = data.schools
    .filter(
      (school) =>
        school.entity_cd === "C" &&
        school.district_name === districtName &&
        /^[ABCDF]$/.test(school.rating || "") &&
        toNumber(school.score) !== null
    )
    .sort((left, right) => {
      const ratingOrder = "ABCDF";
      const ratingDelta =
        ratingOrder.indexOf(left.rating) - ratingOrder.indexOf(right.rating);

      if (ratingDelta !== 0) {
        return ratingDelta;
      }

      return toNumber(right.score) - toNumber(left.score);
    });

  return pickRepresentativeSchools(candidates, 5).map(transformSchool);
});

const output = {
  sourceMetadata: {
    name: "TXschools.gov public aggregate data",
    url: "https://txschools.gov/?lng=en",
    files: sourceFiles.map((name) => `${sourceBaseUrl}/${name}.json`),
    importedAt: new Date().toISOString(),
    note: "School-level and district-level public aggregate data only; no student-level records."
  },
  districts,
  schools,
  reportVersions: [
    {
      version: "2026-04",
      label: "April 2026 Accountability Snapshot",
      status: "previous",
      publishedAt: "2026-04-30T18:00:00.000Z",
      recordCount: schools.length
    },
    {
      version: "2026-05",
      label: "May 2026 Accountability Snapshot",
      status: "production",
      publishedAt: reportPublishedAt,
      recordCount: schools.length
    },
    {
      version: "2026-06",
      label: "June 2026 Candidate Release",
      status: "candidate",
      publishedAt: null,
      recordCount: schools.length
    }
  ]
};

await writeFile("server/data/mockData.json", `${JSON.stringify(output, null, 2)}\n`);

console.log(
  `Imported ${schools.length} schools across ${districts.length} districts from TXschools.gov public JSON.`
);

function transformSchool(school) {
  const achievement = achievementById.get(school.id);
  const profile = profileById.get(school.id);
  const finance = financeById.get(school.id);
  const overallScore = clampScore(toNumber(school.score) ?? 60);
  const readingScore = subjectScore(achievement, "Reading", overallScore);
  const mathScore = subjectScore(achievement, "Math", overallScore);

  return {
    id: school.id,
    officialCampusId: school.id,
    name: school.name,
    districtId: school.district_id,
    officialDistrictId: school.district_id,
    district: school.district_name,
    city: titleCase(school.city),
    county: school.county,
    region: school.region,
    gradeLevel: gradeLevel(school),
    lowGrade: school.low_grade,
    highGrade: school.high_grade,
    accountabilityRating: school.rating,
    overallScore,
    readingScore,
    mathScore,
    enrollment: toNumber(school.enrollment) ?? toNumber(profile?.Total) ?? 0,
    address: school.address || school.street_address || undefined,
    phone: school.phone || undefined,
    website: school.website || undefined,
    principal: school.principal || undefined,
    economicDisadvantaged: toNumber(profile?.Eco_Dis),
    attendanceRate: toNumber(profile?.Attendance),
    studentTeacherRatio: toNumber(profile?.Stu_Per_Staff),
    expendituresPerStudent: lastNumber(finance?.expenditure_school),
    distinctions: toNumber(school.distinctions),
    dataSource: "TXschools.gov public aggregate data",
    lastUpdated: reportPublishedAt,
    reportVersion: "2024-25",
    trend: trendPoints(school.id, overallScore, readingScore, mathScore)
  };
}

function pickRepresentativeSchools(schools, count) {
  const byRating = new Map();

  for (const school of schools) {
    const list = byRating.get(school.rating) ?? [];
    list.push(school);
    byRating.set(school.rating, list);
  }

  const selected = [];

  for (const rating of ["A", "B", "C", "D", "F"]) {
    const school = byRating.get(rating)?.shift();

    if (school) {
      selected.push(school);
    }
  }

  for (const school of schools) {
    if (selected.length >= count) {
      break;
    }

    if (!selected.some((item) => item.id === school.id)) {
      selected.push(school);
    }
  }

  return selected.slice(0, count);
}

function trendPoints(id, overallScore, readingScore, mathScore) {
  const source = trendById.get(id);
  const years = source?.academic_year ?? ["2024-25", "2023-24", "2022-23"];
  const scores = source?.score ?? [overallScore, overallScore - 2, overallScore - 4];
  const rows = years
    .map((label, index) => ({
      year: academicYearEnd(label),
      score: clampScore(toNumber(scores[index]) ?? overallScore)
    }))
    .filter((row) => Number.isFinite(row.year))
    .slice(0, 3)
    .sort((left, right) => left.year - right.year);

  return rows.map((row) => {
    const delta = row.score - overallScore;

    return {
      year: row.year,
      overallScore: row.score,
      readingScore: clampScore(readingScore + delta),
      mathScore: clampScore(mathScore + delta)
    };
  });
}

function subjectScore(achievement, subject, fallback) {
  const index = achievement?.subject?.findIndex((item) => item === subject) ?? -1;

  if (index < 0) {
    return fallback;
  }

  return clampScore(toNumber(achievement.approach?.[index]) ?? fallback);
}

function gradeLevel(school) {
  const campusType = String(school.campus_type ?? "").toLowerCase();

  if (campusType.includes("high")) {
    return "High";
  }

  if (campusType.includes("middle")) {
    return "Middle";
  }

  if (campusType.includes("elementary")) {
    return "Elementary";
  }

  const low = gradeNumber(school.low_grade_cd);
  const high = gradeNumber(school.high_grade_cd);

  if (low <= 0 && high >= 12) {
    return "K-12";
  }

  if (high <= 5) {
    return "Elementary";
  }

  if (low >= 6 && high <= 8) {
    return "Middle";
  }

  if (low >= 9) {
    return "High";
  }

  return "K-8";
}

function gradeNumber(value) {
  const code = String(value ?? "").toUpperCase();

  if (["EE", "PK", "KG", "KN"].includes(code)) {
    return 0;
  }

  return Number.parseInt(code, 10) || 0;
}

function academicYearEnd(label) {
  const match = String(label).match(/20(\d{2})-(\d{2})/);

  if (!match) {
    return Number.NaN;
  }

  return 2000 + Number(match[2]);
}

function indexById(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/[%,$]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function lastNumber(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = toNumber(values[index]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function clampScore(value) {
  return Math.max(60, Math.min(100, Math.round(value)));
}

function titleCase(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bMcallen\b/g, "McAllen")
    .replace(/\bMc Allen\b/g, "McAllen");
}
