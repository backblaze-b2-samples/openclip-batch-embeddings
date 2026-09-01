<!-- last_verified: 2026-08-06 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Jobs (primary entity): list / create / detail / edit / delete / **run**
  - Semantic search (text → nearest corpus images) + corpus gallery
  - Dashboard with embedding-pipeline metrics + write-amplification projection
  - File upload (lands under `corpus/`) and full-bucket file browser
- **services/api/** — FastAPI backend (layered architecture)
  - Embedding-job lifecycle + the run pipeline (stream → encode → shards → index)
  - Local OpenCLIP encoder (torch/open_clip, isolated) + per-job FAISS index
  - B2 S3 integration via boto3, isolated in `repo/`
  - Health check, structured JSON logging, Prometheus-format metrics
- **packages/shared/** — TypeScript type definitions
  - Mirrors Pydantic models from the API
  - Consumed by `apps/web/` as workspace dependency

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer; `torch` / `open_clip` only in `service/openclip_model.py`
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Authored Python files under `services/api/app/` stay under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (jobs, search, pipeline, files, ...)
    config/                Settings loaded from environment
    repo/                  B2 S3 client + byte/job/embedding/index stores
    service/               openclip_model, index, embedding_jobs, embedding_run, search, corpus, pipeline_stats
    runtime/               FastAPI route handlers (jobs, search, corpus, pipeline, files, upload)
  tests/                   pytest tests (structural + integration + pipeline)
```

## Boundary Invariants

- **No external SDK/model leakage**: `boto3` is only imported in `app/repo/`, and `torch` / `open_clip` only in `service/openclip_model.py`. The custom B2 user agent (`user_agent_extra="b2ai-openclip-batch-embeddings"`) rides on the single boto3 S3 client in `repo/b2_client.py`; torch/faiss never touch B2, so there is no UA deviation to reconcile. Device is auto-detected CUDA → Apple MPS → CPU (default CPU); the heavy imports + ~600 MB weight download are lazy (first embed only), so imports and non-live tests stay network-free.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed Pydantic models.
- **No cross-layer mutable state**: Configuration is read-only after init, and no mutable state is shared *between* layers. Intra-layer caches/counters (the listing cache in `repo/list_cache.py`, the B2 connectivity cache in `repo/b2_client.py`, the download counter in `repo/counter.py`, the rate-limit and metrics state in `runtime/`) are module-local and guarded by a `threading.Lock`. The listing cache also owns the only background thread in the app: a stale entry is served immediately while that thread re-scans (stale-while-revalidate), and `main.lifespan` warms it once at startup so no user pays for the cold full-bucket scan.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. File keys reject empty and path-traversal patterns; optional prefix confinement via `ALLOWED_KEY_PREFIX` (off by default).

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — two services from the same repository: `web` builds from the
  repository root because it consumes `packages/shared`; `api` builds from
  `services/api`. Each service's versioned config sits at its own root —
  `railway.json` and `services/api/railway.json` — the default path Railway
  discovers, so a one-click template deploy inherits the same build, start, and
  health behavior with nothing to configure by hand. The human-approved
  staging/production contract lives in [infra/railway/README.md](infra/railway/README.md).
- **Vercel** — one project using [Vercel Services](https://vercel.com/docs/services):
  the `web` (Next.js) and `api` (FastAPI) services build from the same repo and
  share one origin — the web app at `/`, the API under `/api`. The repo-root
  `vercel.json` declares both services and routes `/api/*` to the API service;
  the Vercel-only `services/api/index.py` strips the `/api` prefix so FastAPI
  keeps its native paths (`/health`, `/files`, …). Uploads go directly from the
  browser to B2 via a presigned PUT (see
  [File Upload](docs/features/file-upload.md)), so they bypass the Function's
  4.5 MB payload ceiling entirely — the bucket must allow the deploy origin in
  its CORS. A two-separate-Projects alternative and the full delivery contract
  live in [infra/vercel/README.md](infra/vercel/README.md).
  - **Caveat for this app:** the embedding run depends on native ML libraries
    (torch, faiss) that do **not** fit Vercel's serverless Python functions, so
    the `/jobs/{id}/run` and `/search` paths need a self-hosted API runtime with
    the ML stack (a container or VM), not Vercel serverless. Vercel can still host
    the frontend + the light B2 endpoints.

External provisioning and deployment remain explicit user-approved actions.

## Data Stores

- **Backblaze B2** — object storage (S3-compatible API), the sole data store (no database)
  - `corpus/` — source images the pipeline embeds
  - `embeddings/<job>/shard-NNN.npy` — per-job float32/float16 embedding shards
  - `indexes/<job>/faiss.index` + `id_map.json` — per-job FAISS index + id→key map
  - `jobs/<id>.json` — job manifests (config + status + run stats)

## External Services

- **Backblaze B2 S3 API** — file storage, retrieval, deletion, presigned URLs

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins. `CORSMiddleware` is registered LAST in `main.py` (outermost) so it wraps **every** response, including uncaught-exception 500s — otherwise the browser would block error responses and the UI would only see an opaque "network error". See [docs/RELIABILITY.md](docs/RELIABILITY.md#error-handling). A per-IP rate-limit middleware sits inner to CORS; see [docs/SECURITY.md](docs/SECURITY.md#rate-limiting).
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

- **Create job**: Browser -> `POST /jobs` (JobCreate) -> `service.embedding_jobs.create_job` writes `jobs/<id>.json` -> returns the draft job
- **Run job** (marquee): Browser -> `POST /jobs/{id}/run` -> `service.embedding_run.run_job` lists `corpus/` images (S3 `ListObjectsV2`), `GetObject`s each, encodes on-device with OpenCLIP, writes `.npy` shards to `embeddings/<id>/` (`PutObject`), builds an `IndexIDMap(IndexFlatIP(512))` and uploads it to `indexes/<id>/faiss.index` + `id_map.json`, then updates the manifest. Runs in Starlette's threadpool; records failure on the manifest rather than 500ing.
- **Search**: Browser -> `POST /search` (job_id + query) -> embed the text query -> load the job's index + id map from B2 -> exact cosine top-k -> hydrate hits with presigned image URLs
- **Corpus / dashboard**: `GET /corpus` lists `corpus/` images with presigned thumbnails; `GET /pipeline/stats` rolls the job manifests + corpus listing into metrics, the write-amplification projection, and per-job throughput
- **Upload**: Browser -> `POST /upload/presign` -> Browser PUTs bytes **directly to B2** under `corpus/` -> `POST /upload/verify`
- **List / Download / Delete** (full-bucket explorer): `GET /files`, `GET /files/{key}/download`, `DELETE /files/{key}` via the repo layer

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request; also the catch-all that converts uncaught exceptions to a typed JSON 500)
- `/metrics` endpoint (Prometheus format: request count, latency, upload count)
- `/health` endpoint (B2 connectivity check)

## API Contract

- Checked-in OpenAPI artifact: `docs/api/openapi.json`
- Export/check command: `pnpm contract:export` / `pnpm contract:check`
- FastAPI freshness test: `services/api/tests/test_openapi_contract.py`
- Frontend route drift test: `apps/web/src/lib/api-contract.test.ts`

The frontend client keeps a small `API_CLIENT_ROUTES` registry in
`apps/web/src/lib/api-client.ts`. Tests compare that registry to the checked-in
OpenAPI artifact so route changes fail loudly before the hand-written client can
silently drift from FastAPI. `GET /metrics` is intentionally server-only.

## Canonical Files

- Marquee run pipeline: `services/api/app/service/embedding_run.py`
- OpenCLIP encoder (contained): `services/api/app/service/openclip_model.py`
- Per-job FAISS index: `services/api/app/service/index.py`
- Layered API handler: `services/api/app/runtime/jobs.py`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`, `repo/b2_object_io.py`
- Pydantic models: `services/api/app/types/` (`jobs.py`, `search.py`, `pipeline.py`, `files.py`)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- OpenAPI contract: `docs/api/openapi.json`
- OpenAPI exporter: `services/api/scripts/export_openapi.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [Embedding Jobs](docs/features/embedding-jobs.md)
- [Batch Embedding Pipeline](docs/features/batch-embedding-pipeline.md)
- [Vector Index](docs/features/vector-index.md)
- [Semantic Search](docs/features/semantic-search.md)
- [Corpus Library](docs/features/corpus-library.md)
- [Dashboard](docs/features/dashboard.md)
- [File Upload](docs/features/file-upload.md)
- [File Browser](docs/features/file-browser.md)
- [Metadata Extraction](docs/features/metadata-extraction.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
