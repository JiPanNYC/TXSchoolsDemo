# Texas School Performance Explorer

Full-stack interview demo inspired by TXschools.gov for a Lead Web Architect
conversation. The app presents a polished public-facing school performance
explorer, an internal analytics lab, data release governance, and a mock CI/CD
pipeline for safe public-sector releases.

Repository: `https://github.com/JiPanNYC/TXSchoolsDemo.git`

## Why This Demo Exists

Public education reporting systems need more than attractive charts. They need
accurate data handling, clear public UX, predictable API contracts, versioned
release strategy, cache invalidation, validation gates, monitoring, and rollback.

This project demonstrates those ideas in a compact, deployable demo:

- Mobile-first public reporting interface.
- Versioned school accountability data releases.
- Search, filtering, sorting, and API pagination.
- Official-public-data-derived aggregate seed data.
- Internal analytics and lightweight ML-style modeling.
- Monthly data release validation and rollback simulation.
- CI/CD pipeline simulation with quality gates and business approval.
- Backend cache invalidation strategy kept out of the public UI.

## Tech Stack

- React 18, TypeScript, Vite
- Tailwind CSS and lucide-react icons
- Node.js and Express REST API
- Shared TypeScript contracts between frontend and backend
- JSON data layer generated from public aggregate TXschools.gov files
- Vitest unit tests
- ESLint and Prettier
- Render/Railway-ready Node deployment

## Run Locally

```bash
npm install
npm run dev
```

Development URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4174`
- Vite proxies `/api` calls to Express
- If you change the API port, set `PORT` and `API_PROXY_TARGET` in your shell
  or local `.env`

Production-style local run:

```bash
npm run build
npm start
```

Quality checks:

```bash
npm run lint
npm run test
npm run build
```

## Product Pages

### Explorer

The homepage is a public-facing school directory inspired by modern school
search products while keeping a government/public-service tone.

Features:

- Large school/district/city search entry point.
- Quick search chips for common demo paths.
- Summary cards for school count, district count, report month, and data version.
- Responsive filters for rating, district, city, and grade level.
- Desktop paginated data table.
- Mobile school cards.
- Click-through school detail pages.

### School Detail

School profiles show:

- Accountability rating badge.
- Overall, reading, and math score breakdown.
- Three-year trend chart.
- Data freshness indicator.
- Last updated timestamp and report version.
- TEA-style campus/district identifiers when present in the seed data.
- Public aggregate profile fields such as enrollment, attendance, economic need,
  and finance indicators.

### Analytics Lab

The Analytics Lab is intentionally internal-facing. It is not a public
accountability claim and does not use student-level records.

It demonstrates:

- Rating, grade-level, city, and district aggregation.
- Pearson correlation analysis.
- Scatter plots for economic need, attendance, spending, and score.
- Click-to-enlarge charts.
- Hover/click tooltips that identify each school point.
- K-means-style peer clustering.
- Lightweight gradient-boosted decision stump regression with feature
  importance.

This is not production XGBoost. It avoids native ML dependencies so the demo is
easy to deploy. A production version would use the complete public dataset,
historical releases, lagged features, train/test governance, model explainability
artifacts, monitoring, and a formal model review process.

### Release Center

Release Center models monthly data release governance.

It answers: "Is the candidate reporting dataset safe to publish?"

It includes:

- Current production version.
- Candidate release version.
- Validation status.
- Data quality checks for missing records, duplicate records, score outliers,
  ranking consistency, and last updated timestamps.
- Preview release.
- Promote to production.
- Roll back to previous version.

Release Center is separate from CI/CD Pipeline. Release Center is about
publishing versioned data. CI/CD Pipeline is about deploying the application.

### CI/CD Pipeline

CI/CD Pipeline models the code-to-production release path for the public website.
It is mock-only and does not call GitHub, cloud providers, security vendors, or
external CI services.

Stages:

- Code Commit
- Build
- Unit Tests
- Data Validation
- Security Scan
- Staging Deployment
- Business Approval
- Production Deployment
- Health Check
- Rollback Ready

Controls:

- Run Pipeline
- Simulate Unit Test Failure
- Simulate Data Validation Failure
- Approve Release
- Deploy to Production
- Roll Back

This page demonstrates automated checks, manual approval, monitoring, and
rollback readiness for public-sector release risk management.

## Architecture

```text
Browser
  |
  | React + TypeScript + Tailwind
  v
Vite dev server / static production assets
  |
  | /api REST calls
  v
Express API
  |
  | query, pagination, sorting, filtering, analytics
  v
JSON data layer
  |
  | release state + cache state
  v
Versioned reports and cache metadata
```

Folder responsibilities:

- `src/` contains the React app, pages, components, API client, and styles.
- `server/` contains Express routes, school query logic, analytics, release
  simulation, and cache simulation.
- `shared/` contains TypeScript contracts used by both client and server.
- `server/data/mockData.json` contains the local 50-school demo seed.
- `scripts/import-txschools-data.mjs` refreshes the demo seed from public
  aggregate TXschools.gov JSON.
- `tests/` contains focused unit tests for API query behavior and analytics.

## API Design

Core endpoints:

- `GET /api/health`
- `GET /api/schools`
- `GET /api/schools/:id`
- `GET /api/districts`
- `GET /api/reports/current`
- `GET /api/reports/versions`
- `GET /api/analytics/ml`
- `POST /api/releases/validate`
- `POST /api/releases/preview`
- `POST /api/releases/promote`
- `POST /api/releases/rollback`
- `GET /api/cache/status`
- `POST /api/cache/invalidate`
- `POST /api/cache/refresh`
- `POST /api/database/simulate-update`

School search supports pagination, search, sorting, and filtering:

```text
GET /api/schools?search=austin&rating=A&page=1&pageSize=20
```

Supported query parameters:

- `search`: school name, district, city, grade level, or rating text
- `rating`: `A`, `B`, `C`, `D`, `F`
- `district`: district name
- `city`: city name
- `gradeLevel`: `Elementary`, `Middle`, `High`, `K-8`, `K-12`
- `sortBy`: supported school table column
- `sortDir`: `asc` or `desc`
- `page`: page number
- `pageSize`: capped to avoid large JSON payloads

## Data Source

The seed dataset is derived from public aggregate files referenced by
TXschools.gov, including:

- `https://txschools.gov/data/schools.json`
- `https://txschools.gov/data/districts.json`
- `https://txschools.gov/data/change_over_time.json`
- `https://txschools.gov/data/student_achievement_tab.json`
- `https://txschools.gov/data/profile_tab.json`
- `https://txschools.gov/data/finance_school.json`

Refresh the seed:

```bash
npm run data:import
```

The importer selects 50 school-level records across 10 districts and maps public
aggregate fields such as accountability rating, score, enrollment, attendance,
economic disadvantage percentage, finance indicators, and multi-year score
history.

Important data note:

- No student-level data is collected.
- No private records are stored.
- The current dataset is a representative interview-demo sample, not an official
  production reporting dataset.

## Cache Invalidation Strategy

The database is modeled as the source of truth. The cache has its own version,
last refreshed timestamp, TTL, and freshness status.

When the database version changes, a report is promoted, or a report is rolled
back, the API marks the cache stale. A cache refresh copies the current database
version into the cache version and updates the refresh timestamp.

These controls are intentionally backend/API concerns rather than public UI
controls. The public site should not expose cache operations to ordinary users.

## Monthly Release Strategy

The monthly data release flow is:

1. Candidate data is staged as a versioned report release.
2. Automated validation runs before promotion.
3. Data quality checks validate missing school records, duplicate records, score
   outliers, ranking consistency, and last updated timestamps.
4. Preview exposes release impact before production promotion.
5. Promotion updates the production version and invalidates cache.
6. Rollback restores the previous production version and marks cache stale until
   refresh.

## CI/CD Release Strategy

The CI/CD Pipeline page demonstrates:

- Code commit and build packaging.
- Unit tests and data validation gates.
- Security scan gate.
- Staging deployment.
- Business approval before publishing.
- Production deployment.
- Post-deployment health checks.
- Rollback package readiness.

This is the story to tell in an interview: public education systems need both
automation and controlled human approval because incorrect data or broken
release behavior can affect families, campuses, districts, and policymakers.

## Deployment

### Render or Railway

This app can run as a single Node service.

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```

Recommended settings:

- Runtime: Node.js 20+
- Port: use the platform-provided `PORT`
- Behind nginx on a single EC2 host, set `HOST=127.0.0.1` so Express is only
  reachable through the reverse proxy
- Health check path: `/api/health`

The included `render.yaml` uses these settings for a Render-style web service.

### Vercel

Vercel can host the Vite frontend directly. The Express API should be deployed
separately to Render/Railway or adapted into Vercel serverless functions.

## Interview Demo Flow

Recommended three-minute path:

1. Open Explorer and search for `Austin`.
2. Show paginated table on desktop and explain mobile cards.
3. Open a school detail page and show trend/freshness/report version.
4. Open Analytics Lab and explain aggregation, clusters, correlations, and
   school-level scatter tooltips.
5. Open Release Center and explain data validation/promotion/rollback.
6. Open CI/CD Pipeline and explain build/test/security/staging/approval/deploy
   gates.

See `DEMO_SCRIPT.md` for a more detailed talk track.

## Quality

- Mobile-first layout with desktop tables and mobile cards.
- Sticky header and accessible focus states.
- Loading, error, and empty states.
- Status badges with high-contrast colors.
- API pagination to avoid large JSON payloads.
- Unit tests for query normalization, filtering, sorting, pagination, and
  analytics output.
- ESLint and Prettier included.
- GitHub Actions workflow runs lint, tests, and production build on push and
  pull requests.

## Future Improvements

- Replace JSON fixtures with PostgreSQL or SQLite and migration workflow.
- Add role-based access for release promotion.
- Extend GitHub Actions with release validation artifacts and deployment
  previews.
- Add end-to-end tests for search, detail, analytics, release, and CI/CD flows.
- Connect CI/CD mock metadata to GitHub Actions or deployment platform APIs.
- Replace the lightweight analytics model with a Python/XGBoost pipeline trained
  on the complete public dataset.
- Add structured logging, tracing, and server-side cache headers.
