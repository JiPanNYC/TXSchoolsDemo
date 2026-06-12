# 3-Minute Interview Demo Script

Use this script when presenting the project as a Lead Web Architect demo.

## 0:00-0:30 - Product Context

Open the Explorer page.

Talk track:

This is a mobile-first public reporting interface inspired by TXschools.gov. It
uses a representative seed generated from public aggregate TXschools.gov JSON
files, not student-level data. On startup, the backend imports that seed into a
lightweight SQLite relational database, so the API reads from tables rather than
serving a flat JSON file directly. The first screen is optimized for families
and public users: large search, quick filters, summary cards, and clear report
version context.

Point out:

- Total schools
- Total districts
- Latest report month
- Data version

## 0:30-1:10 - Search and Responsive UX

Search for `Austin`, filter to rating `A`, and open a school.

Talk track:

The API supports search, sorting, filtering, and pagination so the frontend does
not load a large JSON payload. Those queries are backed by SQLite tables for
schools, districts, report versions, and trend rows. Desktop users get a
paginated table for scanning and comparing records. Mobile users get readable
school cards instead of a wide table.

On the detail page, show:

- School profile
- Rating badge
- Score breakdown
- Three-year trend
- Last updated timestamp
- Report version
- Public aggregate fields such as attendance, economic need, and finance data

## 1:10-1:55 - Analytics Lab

Open Analytics Lab.

Talk track:

This page is internal-facing. It demonstrates how an architecture can support
analysis without turning exploratory ML output into a public accountability
claim. The sample is 50 schools, while a production model would use the complete
public dataset and historical releases.

Show:

- District aggregation
- Correlation analysis
- Scatter charts
- Hover/click tooltip showing the school behind each point
- Enlarged chart modal
- Peer clusters
- Boosted-tree-style model output and feature importance

Production caveat:

This is not production XGBoost. A real version would add feature stores,
train/test governance, explainability artifacts, and model monitoring.

## 1:55-2:30 - Data Release Governance

Open Release Center.

Talk track:

Release Center is about monthly data publishing, not code deployment. It models
how a public agency could validate a candidate reporting dataset before
promotion.

Click:

1. Run validation
2. Preview release
3. Promote or roll back if needed

Emphasize:

- Versioned data release
- Missing/duplicate/outlier/timestamp checks
- Preview before promotion
- Rollback support
- Cache invalidation after source-of-truth changes

## 2:30-3:00 - CI/CD and Architecture Close

Open CI/CD Pipeline.

Talk track:

CI/CD Pipeline is the code-to-production release path for the public website. It
is separate from the data release process. The pipeline demonstrates build,
unit tests, data validation, security scan, staging deployment, business
approval, production deployment, health check, and rollback readiness.

Click:

1. Run Pipeline
2. Approve Release
3. Deploy to Production

Close with:

The architecture separates React frontend, Express REST API, shared TypeScript
contracts, and a SQLite relational data layer. The same schema can move to
PostgreSQL or Aurora PostgreSQL for multi-instance production hosting, scheduled
official-data imports, real CI/CD metadata, and production observability.

## 60-Second CI/CD Explanation

Open CI/CD Pipeline and click Run Pipeline.

Explain:

Public education reporting needs controlled CI/CD because families, schools,
districts, and policymakers rely on accurate information. Automated checks catch
code defects, bad data, accessibility regressions, security issues, and API
failures before users see them. Business Approval keeps a human sign-off step
before publishing. Production deployment is followed by health checks, and the
rollback package is kept ready so the team can recover quickly from an
unexpected production issue.

Optional demo:

- Simulate Unit Test Failure to show the pipeline stopping early.
- Simulate Data Validation Failure to show data quality blocking deployment.
- Roll Back to show production recovery.
