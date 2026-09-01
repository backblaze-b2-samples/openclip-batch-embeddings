<!-- last_verified: 2026-09-01 -->
# Feature: Vector Index

## Purpose
Build one FAISS index per job over its embedding shards and store it on B2, so it
can be reused across workers without re-embedding.

## Used By
- UI: index size + key shown on `/jobs/[id]`
- API: written by `POST /jobs/{job_id}/run`; read by `POST /search`
- Job: `service/index.py`

## Core Functions
- `service/index.py::build_and_persist` / `search`
- `repo/index_store.py` — index + id-map bytes at `indexes/<job>/`

## Canonical Files
- Pattern exemplar: `services/api/app/service/index.py`

## Inputs
- A float32 matrix (N, 512) of L2-normalized vectors + the parallel image keys

## Outputs
- `indexes/<job>/faiss.index` — serialized `IndexIDMap(IndexFlatIP(512))`
- `indexes/<job>/id_map.json` — `{"keys": [...]}` where list position is the FAISS id

## Flow
- Add all vectors with row-index ids → serialize → `PutObject`
- Search: `GetObject` the index + id map → exact inner-product top-k → map ids → keys

## Edge Cases
- Search before a build → `IndexUnavailableError` → 409 "no index yet"
- Empty index → returns no hits (not an error)
- Both models are 512-d, so a job's index dimension is fixed; search never mixes spaces

## UX States (if applicable)
- Not applicable directly; surfaced via job detail + search

## Verification
- Test files: `services/api/tests/test_embedding_jobs.py`
- Required cases: build persists an index; search returns hydrated hits
- Focused verify command: `cd services/api && .venv/bin/python -m pytest tests/test_embedding_jobs.py -q`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: exact cosine ranking; index round-trips through B2

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/app-workflows.md](../app-workflows.md)
