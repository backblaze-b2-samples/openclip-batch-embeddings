<!-- last_verified: 2026-09-01 -->
# Feature: Dashboard

## Purpose
Give an at-a-glance view of the embedding pipeline: what has been embedded, how
much it costs in B2 storage, and how fast runs go — with a write-amplification
projection that makes the production storage story concrete.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /pipeline/stats` (composite), `GET /jobs` (recent-jobs table)

## Core Functions
- `apps/web/src/components/dashboard/pipeline-stats-cards.tsx` — 5 stat cards
- `apps/web/src/components/dashboard/write-amplification-card.tsx` — projection at 1M/10M/100M
- `apps/web/src/components/dashboard/throughput-chart.tsx` — images/sec per job (Recharts)
- `apps/web/src/components/dashboard/recent-jobs-table.tsx` — last 8 jobs
- `services/api/app/service/pipeline_stats.py` — `get_dashboard()` aggregation
- `services/api/app/runtime/pipeline.py` — `GET /pipeline/stats` handler

## Canonical Files
- Aggregation logic: `services/api/app/service/pipeline_stats.py`
- Dashboard layout: `apps/web/src/app/page.tsx`

## Inputs
- None (loads automatically via TanStack Query hooks in `lib/queries.ts`)

## Outputs
- `GET /pipeline/stats` → `DashboardData`:
  - `stats`: corpus_images, vectors_embedded, shard_count, shard_bytes, index_bytes, jobs_total, jobs_complete, bytes_per_vector
  - `projection`: ProjectionPoint[] at 1M/10M/100M using the measured bytes/vector
  - `float32_bytes_per_vector` / `float16_bytes_per_vector` (dim × 4 / dim × 2)
  - `throughput`: ThroughputPoint[] (images/sec per completed job)

## Flow
- Page loads → `useDashboard()` fetches `/pipeline/stats`; `useJobs()` feeds the recent-jobs table
- Stat cards show corpus images, vectors embedded, embedding shards (count + bytes), index size, jobs run
- The write-amplification card projects shard storage at scale from the measured
  bytes/vector (falls back to the float32 theoretical size before the first run)
- The throughput chart plots images/sec per completed job

## Edge Cases
- No jobs yet → cards show zeros; projection uses the theoretical float32 ratio; chart shows an empty state
- API unavailable → inline `ErrorState` with Retry on the cards
- Measured bytes/vector is 0 until at least one job has embedded a vector

## UX States
- Loading: skeleton cards, chart, and projection table
- Empty: zeroed cards + "No runs yet" chart empty state
- Loaded: populated cards, projection, throughput chart, recent-jobs table

## Verification
- Test files: `services/api/tests/test_embedding_jobs.py` (`test_dashboard_counts_vectors`)
- Required cases: stats reflect a completed run; projection has 3 points; bytes/vector > 0 after a run
- Focused verify command: `cd services/api && .venv/bin/python -m pytest tests/test_embedding_jobs.py -q`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when the E2E/live prerequisites in [Verification](../verification.md#non-live-verification) are available
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
