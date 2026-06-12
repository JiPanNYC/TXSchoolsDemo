import type {
  AnalyticsBucket,
  AnalyticsResponse,
  AnalyticsScatterSeries,
  ClusterSummary,
  DistrictAnalytics,
  FeatureCorrelation,
  FeatureImportance,
  ModelPrediction,
  Rating,
  School
} from "../../shared/types.js";

type NumericFeatureKey =
  | "readingScore"
  | "mathScore"
  | "attendanceRate"
  | "economicDisadvantaged"
  | "studentTeacherRatio"
  | "expendituresPerStudent"
  | "enrollment";

interface FeatureDefinition {
  key: NumericFeatureKey;
  label: string;
  value: (school: School) => number | undefined;
}

interface TrainingRow {
  school: School;
  y: number;
  features: Record<NumericFeatureKey, number>;
}

interface Stump {
  feature: NumericFeatureKey;
  threshold: number;
  leftValue: number;
  rightValue: number;
  gain: number;
}

const featureDefinitions: FeatureDefinition[] = [
  {
    key: "readingScore",
    label: "Reading score",
    value: (school) => school.readingScore
  },
  { key: "mathScore", label: "Math score", value: (school) => school.mathScore },
  {
    key: "attendanceRate",
    label: "Attendance rate",
    value: (school) => school.attendanceRate
  },
  {
    key: "economicDisadvantaged",
    label: "Economically disadvantaged",
    value: (school) => school.economicDisadvantaged
  },
  {
    key: "studentTeacherRatio",
    label: "Students per staff",
    value: (school) => school.studentTeacherRatio
  },
  {
    key: "expendituresPerStudent",
    label: "Per-student expenditure",
    value: (school) => school.expendituresPerStudent
  },
  { key: "enrollment", label: "Enrollment", value: (school) => school.enrollment }
];

const ratingOrder: Rating[] = ["A", "B", "C", "D", "F"];

export function buildAnalyticsResponse(schools: School[]): AnalyticsResponse {
  const cleanSchools = schools.filter((school) => Number.isFinite(school.overallScore));

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: cleanSchools.length,
    modelNotice:
      "Demo model trained on a 50-school public aggregate seed. Use full historical data before treating predictions as decision support.",
    ratingDistribution: bucketByRating(cleanSchools),
    gradeDistribution: bucketBy(cleanSchools, (school) => school.gradeLevel),
    districtAnalytics: buildDistrictAnalytics(cleanSchools),
    cityAnalytics: bucketBy(cleanSchools, (school) => school.city).sort(
      (left, right) =>
        right.count - left.count || right.averageScore - left.averageScore
    ),
    correlations: buildCorrelations(cleanSchools),
    scatter: buildScatterSeries(cleanSchools),
    clusters: buildClusters(cleanSchools),
    model: trainBoostedStumpModel(cleanSchools)
  };
}

function bucketByRating(schools: School[]): AnalyticsBucket[] {
  return ratingOrder.map((rating) => {
    const rows = schools.filter((school) => school.accountabilityRating === rating);

    return {
      label: rating,
      count: rows.length,
      averageScore: round(mean(rows.map((school) => school.overallScore)))
    };
  });
}

function bucketBy(
  schools: School[],
  getLabel: (school: School) => string
): AnalyticsBucket[] {
  const groups = groupBy(schools, getLabel);

  return Array.from(groups.entries())
    .map(([label, rows]) => ({
      label,
      count: rows.length,
      averageScore: round(mean(rows.map((school) => school.overallScore)))
    }))
    .sort((left, right) => right.averageScore - left.averageScore);
}

function buildDistrictAnalytics(schools: School[]): DistrictAnalytics[] {
  const groups = groupBy(schools, (school) => school.district);

  return Array.from(groups.entries())
    .map(([district, rows]) => ({
      district,
      city: mostCommon(rows.map((school) => school.city)),
      schoolCount: rows.length,
      averageScore: round(mean(rows.map((school) => school.overallScore))),
      averageReading: round(mean(rows.map((school) => school.readingScore))),
      averageMath: round(mean(rows.map((school) => school.mathScore))),
      averageAttendance: round(meanDefined(rows, (school) => school.attendanceRate)),
      averageEconomicDisadvantaged: round(
        meanDefined(rows, (school) => school.economicDisadvantaged)
      ),
      averageExpenditure: Math.round(
        meanDefined(rows, (school) => school.expendituresPerStudent)
      )
    }))
    .sort((left, right) => right.averageScore - left.averageScore);
}

function buildCorrelations(schools: School[]): FeatureCorrelation[] {
  return featureDefinitions
    .map((feature) => {
      const pairs = schools
        .map((school) => ({ x: feature.value(school), y: school.overallScore }))
        .filter((pair): pair is { x: number; y: number } => pair.x !== undefined);
      const correlation = pearson(
        pairs.map((pair) => pair.x),
        pairs.map((pair) => pair.y)
      );
      const direction: FeatureCorrelation["direction"] =
        Math.abs(correlation) < 0.08
          ? "neutral"
          : correlation > 0
            ? "positive"
            : "negative";

      return {
        feature: feature.key,
        label: feature.label,
        correlation: round(correlation, 3),
        direction
      };
    })
    .sort((left, right) => Math.abs(right.correlation) - Math.abs(left.correlation));
}

function buildScatterSeries(schools: School[]): AnalyticsScatterSeries[] {
  return [
    scatter(
      "equity-score",
      "Economic Need vs Overall Score",
      "Economically disadvantaged %",
      "Overall score",
      schools,
      (school) => school.economicDisadvantaged,
      (school) => school.overallScore
    ),
    scatter(
      "attendance-score",
      "Attendance vs Overall Score",
      "Attendance rate %",
      "Overall score",
      schools,
      (school) => school.attendanceRate,
      (school) => school.overallScore
    ),
    scatter(
      "spend-score",
      "Spending vs Overall Score",
      "Per-student expenditure",
      "Overall score",
      schools,
      (school) => school.expendituresPerStudent,
      (school) => school.overallScore
    )
  ];
}

function scatter(
  id: string,
  title: string,
  xLabel: string,
  yLabel: string,
  schools: School[],
  getX: (school: School) => number | undefined,
  getY: (school: School) => number | undefined
): AnalyticsScatterSeries {
  return {
    id,
    title,
    xLabel,
    yLabel,
    points: schools
      .map((school) => ({
        id: school.id,
        name: school.name,
        district: school.district,
        city: school.city,
        rating: school.accountabilityRating,
        x: getX(school),
        y: getY(school)
      }))
      .filter(
        (
          point
        ): point is {
          id: string;
          name: string;
          district: string;
          city: string;
          rating: Rating;
          x: number;
          y: number;
        } => point.x !== undefined && point.y !== undefined
      )
  };
}

function buildClusters(schools: School[]): ClusterSummary[] {
  const vectors = schools.map((school) => ({
    school,
    values: [
      school.economicDisadvantaged ?? 0,
      school.attendanceRate ?? 0,
      Math.log((school.expendituresPerStudent ?? 0) + 1),
      Math.log(school.enrollment + 1),
      school.studentTeacherRatio ?? 0
    ]
  }));
  const standardized = standardize(vectors.map((row) => row.values));
  const sortedIndexes = vectors
    .map((row, index) => ({ index, need: row.school.economicDisadvantaged ?? 0 }))
    .sort((left, right) => left.need - right.need);
  let centers = [
    standardized[sortedIndexes[0]?.index ?? 0],
    standardized[sortedIndexes[Math.floor(sortedIndexes.length / 2)]?.index ?? 0],
    standardized[sortedIndexes[sortedIndexes.length - 1]?.index ?? 0]
  ].map((center) => [...center]);
  let assignments = new Array<number>(vectors.length).fill(0);

  for (let iteration = 0; iteration < 16; iteration += 1) {
    assignments = standardized.map((values) => closestCenter(values, centers));
    centers = centers.map((center, clusterIndex) => {
      const members = standardized.filter(
        (_, index) => assignments[index] === clusterIndex
      );
      return members.length ? averageVector(members) : center;
    });
  }

  return centers
    .map((_, clusterIndex) => {
      const rows = vectors
        .filter((_, index) => assignments[index] === clusterIndex)
        .map((row) => row.school);
      const averageScore = round(mean(rows.map((school) => school.overallScore)));
      const averageNeed = round(
        meanDefined(rows, (school) => school.economicDisadvantaged)
      );
      const averageAttendance = round(
        meanDefined(rows, (school) => school.attendanceRate)
      );
      const averageExpenditure = Math.round(
        meanDefined(rows, (school) => school.expendituresPerStudent)
      );

      return {
        id: `cluster-${clusterIndex + 1}`,
        label: clusterLabel(averageScore, averageNeed),
        schoolCount: rows.length,
        averageScore,
        averageAttendance,
        averageEconomicDisadvantaged: averageNeed,
        averageExpenditure,
        profile: clusterProfile(averageScore, averageNeed, averageAttendance),
        schools: rows
          .sort((left, right) => right.overallScore - left.overallScore)
          .slice(0, 4)
          .map((school) => ({
            id: school.id,
            name: school.name,
            district: school.district,
            score: school.overallScore,
            rating: school.accountabilityRating
          }))
      };
    })
    .filter((cluster) => cluster.schoolCount > 0)
    .sort((left, right) => right.averageScore - left.averageScore);
}

function trainBoostedStumpModel(schools: School[]) {
  const rows = buildTrainingRows(schools).sort((left, right) =>
    left.school.id.localeCompare(right.school.id, "en", { numeric: true })
  );
  const trainingRows = rows.filter((_, index) => index % 5 !== 0);
  const testRows = rows.filter((_, index) => index % 5 === 0);
  const learningRate = 0.18;
  const rounds = 32;
  const basePrediction = mean(trainingRows.map((row) => row.y));
  const predictions = new Map(
    trainingRows.map((row) => [row.school.id, basePrediction])
  );
  const stumps: Stump[] = [];
  const featureImportance = new Map<NumericFeatureKey, number>(
    featureDefinitions.map((feature) => [feature.key, 0])
  );

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const residuals = trainingRows.map(
      (row) => row.y - (predictions.get(row.school.id) ?? basePrediction)
    );
    const stump = fitBestStump(trainingRows, residuals);
    stumps.push(stump);
    featureImportance.set(
      stump.feature,
      (featureImportance.get(stump.feature) ?? 0) + Math.max(0, stump.gain)
    );

    for (const row of trainingRows) {
      const currentPrediction = predictions.get(row.school.id) ?? basePrediction;
      predictions.set(
        row.school.id,
        currentPrediction + learningRate * stumpValue(stump, row.features)
      );
    }
  }

  const testPredictions = testRows.map((row) =>
    predictRow(row, basePrediction, stumps, learningRate)
  );
  const actual = testRows.map((row) => row.y);
  const totalImportance = Array.from(featureImportance.values()).reduce(
    (total, value) => total + value,
    0
  );

  return {
    modelName: "Gradient-boosted decision stumps",
    target: "Overall accountability score",
    trainingRows: trainingRows.length,
    testRows: testRows.length,
    mae: round(
      mean(
        testPredictions.map((prediction, index) => Math.abs(prediction - actual[index]))
      ),
      2
    ),
    r2: round(rSquared(actual, testPredictions), 2),
    featureImportance: featureDefinitions
      .map<FeatureImportance>((feature) => ({
        feature: feature.key,
        label: feature.label,
        importance:
          totalImportance === 0
            ? 0
            : round(((featureImportance.get(feature.key) ?? 0) / totalImportance) * 100)
      }))
      .sort((left, right) => right.importance - left.importance),
    predictions: rows
      .map<ModelPrediction>((row) => {
        const predictedScore = round(
          predictRow(row, basePrediction, stumps, learningRate)
        );
        const residual = round(row.y - predictedScore);

        return {
          id: row.school.id,
          name: row.school.name,
          district: row.school.district,
          actualScore: row.y,
          predictedScore,
          residual,
          riskTier: riskTier(predictedScore),
          topFactors: topFactors(row.school)
        };
      })
      .sort((left, right) => left.predictedScore - right.predictedScore)
      .slice(0, 12)
  };
}

function buildTrainingRows(schools: School[]): TrainingRow[] {
  const featureMeans = new Map<NumericFeatureKey, number>();

  for (const feature of featureDefinitions) {
    featureMeans.set(
      feature.key,
      meanDefined(schools, (school) => feature.value(school))
    );
  }

  return schools.map((school) => ({
    school,
    y: school.overallScore,
    features: Object.fromEntries(
      featureDefinitions.map((feature) => [
        feature.key,
        transformFeature(
          feature.key,
          feature.value(school) ?? featureMeans.get(feature.key) ?? 0
        )
      ])
    ) as Record<NumericFeatureKey, number>
  }));
}

function fitBestStump(rows: TrainingRow[], residuals: number[]): Stump {
  let best: Stump = {
    feature: "readingScore",
    threshold: 0,
    leftValue: 0,
    rightValue: 0,
    gain: Number.NEGATIVE_INFINITY
  };
  const baseSse = residuals.reduce((total, residual) => total + residual ** 2, 0);

  for (const feature of featureDefinitions) {
    const values = rows
      .map((row, index) => ({
        value: row.features[feature.key],
        residual: residuals[index]
      }))
      .sort((left, right) => left.value - right.value);
    const thresholds = uniqueThresholds(values.map((item) => item.value));

    for (const threshold of thresholds) {
      const left = values.filter((item) => item.value <= threshold);
      const right = values.filter((item) => item.value > threshold);

      if (left.length < 3 || right.length < 3) {
        continue;
      }

      const leftValue = mean(left.map((item) => item.residual));
      const rightValue = mean(right.map((item) => item.residual));
      const sse =
        left.reduce((total, item) => total + (item.residual - leftValue) ** 2, 0) +
        right.reduce((total, item) => total + (item.residual - rightValue) ** 2, 0);
      const gain = baseSse - sse;

      if (gain > best.gain) {
        best = {
          feature: feature.key,
          threshold,
          leftValue,
          rightValue,
          gain
        };
      }
    }
  }

  return best;
}

function predictRow(
  row: TrainingRow,
  basePrediction: number,
  stumps: Stump[],
  learningRate: number
) {
  return Math.max(
    60,
    Math.min(
      100,
      stumps.reduce(
        (prediction, stump) =>
          prediction + learningRate * stumpValue(stump, row.features),
        basePrediction
      )
    )
  );
}

function stumpValue(stump: Stump, features: Record<NumericFeatureKey, number>) {
  return features[stump.feature] <= stump.threshold
    ? stump.leftValue
    : stump.rightValue;
}

function topFactors(school: School): string[] {
  const factors = [
    { text: `Reading ${school.readingScore}`, weight: school.readingScore - 75 },
    { text: `Math ${school.mathScore}`, weight: school.mathScore - 75 },
    {
      text: `Attendance ${school.attendanceRate ?? "n/a"}%`,
      weight: (school.attendanceRate ?? 90) - 90
    },
    {
      text: `Economic need ${school.economicDisadvantaged ?? "n/a"}%`,
      weight: 65 - (school.economicDisadvantaged ?? 65)
    }
  ];

  return factors
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight))
    .slice(0, 3)
    .map((factor) => factor.text);
}

function riskTier(score: number): ModelPrediction["riskTier"] {
  if (score >= 90) {
    return "High-performing";
  }

  if (score >= 80) {
    return "Stable";
  }

  if (score >= 70) {
    return "Watch";
  }

  return "Intervention";
}

function transformFeature(feature: NumericFeatureKey, value: number) {
  if (feature === "expendituresPerStudent" || feature === "enrollment") {
    return Math.log(value + 1);
  }

  return value;
}

function uniqueThresholds(values: number[]) {
  const uniqueValues = Array.from(new Set(values)).sort((left, right) => left - right);
  const thresholds = [];

  for (let index = 1; index < uniqueValues.length; index += 1) {
    thresholds.push((uniqueValues[index - 1] + uniqueValues[index]) / 2);
  }

  return thresholds;
}

function standardize(matrix: number[][]) {
  const columns = matrix[0]?.length ?? 0;
  const means = Array.from({ length: columns }, (_, index) =>
    mean(matrix.map((row) => row[index]))
  );
  const stds = Array.from({ length: columns }, (_, index) => {
    const values = matrix.map((row) => row[index]);
    return Math.sqrt(mean(values.map((value) => (value - means[index]) ** 2))) || 1;
  });

  return matrix.map((row) =>
    row.map((value, index) => (value - means[index]) / stds[index])
  );
}

function closestCenter(values: number[], centers: number[][]) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  centers.forEach((center, index) => {
    const distance = euclidean(values, center);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function averageVector(vectors: number[][]) {
  return vectors[0].map((_, index) => mean(vectors.map((vector) => vector[index])));
}

function euclidean(left: number[], right: number[]) {
  return Math.sqrt(
    left.reduce((total, value, index) => total + (value - right[index]) ** 2, 0)
  );
}

function clusterLabel(score: number, need: number) {
  if (score >= 88 && need < 45) {
    return "High-performing, lower-need peers";
  }

  if (score >= 82) {
    return "Stable performance peers";
  }

  if (need >= 70) {
    return "High-need support peers";
  }

  return "Improvement opportunity peers";
}

function clusterProfile(score: number, need: number, attendance: number) {
  if (score >= 88) {
    return "Strong outcomes with relatively favorable leading indicators.";
  }

  if (attendance < 90) {
    return "Attendance appears to be a leading operational pressure.";
  }

  if (need >= 70) {
    return "Higher economic need cluster where supports may shape outcomes.";
  }

  return "Mixed indicators; compare instructional and finance patterns.";
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return groups;
}

function mean(values: number[]) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  return cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length;
}

function meanDefined<T>(items: T[], getValue: (item: T) => number | undefined) {
  return mean(
    items
      .map((item) => getValue(item))
      .filter((value): value is number => value !== undefined && Number.isFinite(value))
  );
}

function pearson(left: number[], right: number[]) {
  if (left.length < 2 || right.length < 2) {
    return 0;
  }

  const leftMean = mean(left);
  const rightMean = mean(right);
  const numerator = left.reduce(
    (total, value, index) => total + (value - leftMean) * (right[index] - rightMean),
    0
  );
  const leftVariance = left.reduce(
    (total, value) => total + (value - leftMean) ** 2,
    0
  );
  const rightVariance = right.reduce(
    (total, value) => total + (value - rightMean) ** 2,
    0
  );
  const denominator = Math.sqrt(leftVariance * rightVariance);

  return denominator === 0 ? 0 : numerator / denominator;
}

function rSquared(actual: number[], predicted: number[]) {
  const actualMean = mean(actual);
  const totalSumSquares = actual.reduce(
    (total, value) => total + (value - actualMean) ** 2,
    0
  );
  const residualSumSquares = actual.reduce(
    (total, value, index) => total + (value - predicted[index]) ** 2,
    0
  );

  if (totalSumSquares === 0) {
    return 0;
  }

  return 1 - residualSumSquares / totalSumSquares;
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0][0];
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
