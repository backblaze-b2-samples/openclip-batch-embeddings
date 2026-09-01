<!-- last_verified: 2026-09-01 -->
# Feature: Batch Embedding Pipeline

## Purpose
Stream a corpus of images from B2, encode each on-device with OpenCLIP, and write
float32/float16 `.npy` embedding shards back to `embeddings/<job>/`.

## Used By
- UI: the **Run** button on `/jobs/[id]`
- API: `POST /jobs/{job_id}/run`
- Job: `service/embedding_run.py` (runs in Starlette's threadpool)

## Core Functions
- `service/embedding_run.py::run_job` — the orchestration
- `service/openclip_model.py::embed_image` — the ONLY torch/open_clip surface
- `repo/embedding_store.py` — shard `.npy` writes/reads/list

## Canonical Files
- Pattern exemplar: `services/api/app/service/embedding_run.py`

## Inputs
- A job id (path). Config (model, precision, source_prefix, shard_size) is read from the manifest.
- Source images: every image object under `source_prefix` (default `corpus/`)

## Outputs
- `embeddings/<job>/shard-NNN.npy` — batches of L2-normalized vectors at the job's precision
- A FAISS index (see [Vector Index](vector-index.md))
- Manifest updated with image/vector/shard counts, bytes, duration, throughput

## Flow
- Set status `running`; scoped-clean any prior shards/index (idempotent re-run)
- `ListObjectsV2` the source prefix; `GetObject` + `embed_image` each image
- Write shards of `shard_size` rows (float16 halves shard bytes; index stays float32)
- Build + upload the index; record stats; set status `complete`

## Edge Cases
- No images under the prefix → status `failed`, message names corpus/seed (never 500)
- One unreadable image → skipped with a warning; the run continues
- Already `running` → 409

## UX States (if applicable)
- Loading: the Run button shows "Running…" and is disabled
- Error: the failed status + error message render on the detail page

## Verification
- Test files: `services/api/tests/test_embedding_jobs.py`
- Required cases: run embeds N images into shards + index; empty-prefix failure
- Focused verify command: `cd services/api && .venv/bin/python -m pytest tests/test_embedding_jobs.py -q`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: real shards + index land on B2; the manifest reflects the run

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/app-workflows.md](../app-workflows.md)
