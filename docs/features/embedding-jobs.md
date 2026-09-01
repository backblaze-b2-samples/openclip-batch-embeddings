<!-- last_verified: 2026-09-01 -->
# Feature: Embedding Jobs

## Purpose
The Embedding Job is the app's primary entity: a batch run that embeds a B2
image prefix with a chosen OpenCLIP model + precision, and owns its shards and
index.

## Used By
- UI: `/jobs` (list), `/jobs/new` (create), `/jobs/[id]` (detail + run), `/jobs/[id]/edit`
- API: `GET/POST /jobs`, `GET/PATCH/DELETE /jobs/{job_id}`, `POST /jobs/{job_id}/run`
- Job: the run pipeline — see [Batch Embedding Pipeline](batch-embedding-pipeline.md)

## Core Functions
- `service/embedding_jobs.py` — create / get / list / update / delete
- `repo/job_store.py` — manifest read/write/list at `jobs/<id>.json`

## Canonical Files
- Pattern exemplar: `services/api/app/service/embedding_jobs.py`

## Inputs
- JobCreate: name, description, model, precision, modality, source_prefix, shard_size (JSON body)
- JobUpdate: any subset; config fields (model/precision/source_prefix/shard_size) only while `draft`

## Outputs
- EmbeddingJob manifest persisted at `jobs/<id>.json` on B2
- Delete tears down `embeddings/<id>/`, `indexes/<id>/`, and the manifest (scoped)

## Flow
- Create → a `draft` job manifest is written; nothing is embedded yet
- Run → status `running` → `complete`/`failed` (see the pipeline doc)
- Edit → name/description always; model/precision/source/shard locked after a run (409)
- Delete → scoped prefix delete; the source corpus is untouched

## Edge Cases
- Missing job id → 404
- Editing config on a non-draft job → 409 with an explanatory message
- Deleting an already-deleted job → 404

## UX States (if applicable)
- Empty: "No embedding jobs yet" with a New job CTA and the seed hint
- Loading: skeleton rows
- Error: inline `ErrorState` with Retry

## Verification
- Test files: `services/api/tests/test_embedding_jobs.py`
- Required cases: create/run/delete happy path + empty-prefix failure + config-lock
- Focused verify command: `cd services/api && .venv/bin/python -m pytest tests/test_embedding_jobs.py -q`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: job CRUD works; a run produces shards + an index; delete is scoped

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/app-workflows.md](../app-workflows.md)
