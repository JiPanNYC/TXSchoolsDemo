export type Rating = "A" | "B" | "C" | "D" | "F";

export type ValidationStatus = "not_run" | "running" | "passed" | "warning" | "failed";

export interface District {
  id: string;
  name: string;
  city: string;
  region: string;
}

export interface TrendPoint {
  year: number;
  overallScore: number;
  readingScore: number;
  mathScore: number;
}

export interface School {
  id: string;
  officialCampusId?: string;
  name: string;
  districtId: string;
  officialDistrictId?: string;
  district: string;
  city: string;
  county: string;
  region?: string;
  gradeLevel: "Elementary" | "Middle" | "High" | "K-8" | "K-12";
  lowGrade?: string;
  highGrade?: string;
  accountabilityRating: Rating;
  overallScore: number;
  readingScore: number;
  mathScore: number;
  enrollment: number;
  address?: string;
  phone?: string;
  website?: string;
  principal?: string;
  economicDisadvantaged?: number;
  attendanceRate?: number;
  studentTeacherRatio?: number;
  expendituresPerStudent?: number;
  distinctions?: number;
  dataSource?: string;
  lastUpdated: string;
  reportVersion: string;
  trend: TrendPoint[];
}

export interface ReportVersion {
  version: string;
  label: string;
  status: "production" | "previous" | "candidate";
  publishedAt: string | null;
  recordCount: number;
}

export interface ReleaseValidationCheck {
  id: string;
  name: string;
  status: "pass" | "warning" | "fail";
  detail: string;
}

export interface ReleaseState {
  productionVersion: string;
  previousVersion: string;
  candidateVersion: string;
  validationStatus: ValidationStatus;
  checks: ReleaseValidationCheck[];
  lastValidatedAt: string | null;
}

export interface CacheStatus {
  databaseVersion: string;
  cacheVersion: string;
  cacheLastRefreshedAt: string;
  cacheTtlSeconds: number;
  status: "fresh" | "stale";
  sourceOfTruth: "database";
}

export interface ReportSummary {
  totalSchools: number;
  totalDistricts: number;
  latestReportMonth: string;
  dataVersion: string;
  release: ReleaseState;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AnalyticsBucket {
  label: string;
  count: number;
  averageScore: number;
}

export interface DistrictAnalytics {
  district: string;
  city: string;
  schoolCount: number;
  averageScore: number;
  averageReading: number;
  averageMath: number;
  averageAttendance: number;
  averageEconomicDisadvantaged: number;
  averageExpenditure: number;
}

export interface FeatureCorrelation {
  feature: string;
  label: string;
  correlation: number;
  direction: "positive" | "negative" | "neutral";
}

export interface AnalyticsScatterPoint {
  id: string;
  name: string;
  district: string;
  city: string;
  rating: Rating;
  x: number;
  y: number;
}

export interface AnalyticsScatterSeries {
  id: string;
  title: string;
  xLabel: string;
  yLabel: string;
  points: AnalyticsScatterPoint[];
}

export interface ClusterSchoolSummary {
  id: string;
  name: string;
  district: string;
  score: number;
  rating: Rating;
}

export interface ClusterSummary {
  id: string;
  label: string;
  schoolCount: number;
  averageScore: number;
  averageAttendance: number;
  averageEconomicDisadvantaged: number;
  averageExpenditure: number;
  profile: string;
  schools: ClusterSchoolSummary[];
}

export interface FeatureImportance {
  feature: string;
  label: string;
  importance: number;
}

export interface ModelPrediction {
  id: string;
  name: string;
  district: string;
  actualScore: number;
  predictedScore: number;
  residual: number;
  riskTier: "High-performing" | "Stable" | "Watch" | "Intervention";
  topFactors: string[];
}

export interface AnalyticsModelSummary {
  modelName: string;
  target: string;
  trainingRows: number;
  testRows: number;
  mae: number;
  r2: number;
  featureImportance: FeatureImportance[];
  predictions: ModelPrediction[];
}

export interface AnalyticsResponse {
  generatedAt: string;
  sampleSize: number;
  modelNotice: string;
  ratingDistribution: AnalyticsBucket[];
  gradeDistribution: AnalyticsBucket[];
  districtAnalytics: DistrictAnalytics[];
  cityAnalytics: AnalyticsBucket[];
  correlations: FeatureCorrelation[];
  scatter: AnalyticsScatterSeries[];
  clusters: ClusterSummary[];
  model: AnalyticsModelSummary;
}
