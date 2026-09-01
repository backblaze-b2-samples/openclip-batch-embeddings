<!-- last_verified: 2026-09-01 -->
# Feature: Semantic Search

## Purpose
Turn a text query into the nearest corpus images within a completed job's OpenCLIP/
FAISS vector space, ranked by cosine similarity.

## Used By
- UI: `/search` (job selector + query → image grid)
- API: `POST /search` (job_id + query + k)
- Job: `service/search.py`

## Core Functions
- `service/search.py::search_text`
- `service/openclip_model.py::embed_text` (same 512-d space as images)
- `service/index.py::search`

## Canonical Files
- Pattern exemplar: `services/api/app/service/search.py`

## Inputs
- SearchRequest: job_id (str), query (str), k (1–48) — JSON body

## Outputs
- SearchResponse: job_id, query, count, hits[] (key, score, presigned image_url)

## Flow
- Validate query + job is `complete` → embed the text → load the job's index → top-k
- Hydrate each hit with a presigned (or public) image URL for the browser

## Edge Cases
- Empty query → 400
- Job not complete / no index → 409 with a "run it first" message
- No matches → the grid shows an empty state (not an error)

## UX States (if applicable)
- Empty: prompt to pick a job and describe an image; or "no completed jobs yet"
- Loading: skeleton result tiles
- Error: inline `ErrorState` with Retry

## Verification
- Test files: `services/api/tests/test_embedding_jobs.py`
- Required cases: search returns hydrated hits after a run
- Focused verify command: `cd services/api && .venv/bin/python -m pytest tests/test_embedding_jobs.py -q`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: text→image ranking is sensible and scoped to one job

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/app-workflows.md](../app-workflows.md)
