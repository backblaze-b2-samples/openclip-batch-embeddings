# Build plan — `openclip-batch-embeddings`

Scaffolded from `vibe-coding-starter-kit` (source of truth:
`.claude/scratch/vcsk-769a6b2d-0a57-4200-a975-236298eae8a8/`). Proven structural
analog already shipped in this workspace: `clip-visual-product-search` — its
`service/clip_model.py`, `service/index.py` (FAISS), requirements pins, env-var
scheme, and OMP-contention guards are reused here as-is.

## 1. Purpose

`openclip-batch-embeddings` is a B2 sample for AI platform engineers and ML teams
who embed large image + text corpora into a shared vector space for semantic
search, near-duplicate removal, and dataset clustering. It demonstrates the full
batch-embedding pipeline with **Backblaze B2 as the storage backbone for every
layer**: the source media corpus, the derived `.npy` embedding shards, and the
vector index — all read/written over the S3-compatible API. A user creates an
**Embedding Job** (pick a source prefix + an OpenCLIP model + precision), runs it
(stream images from B2 → encode locally with OpenCLIP → write float32/float16
`.npy` shards to `embeddings/<job>/` → build a FAISS index → upload it to
`indexes/<job>/`), then queries it from a **Semantic Search** page (text → nearest
images, streamed from B2). Inference is 100% local OpenCLIP — **no external API
key, B2 credentials only** — CPU by default with CUDA → MPS → CPU autodetect. The
sample runs at demo scale (dozens of synthetic images) but the dashboard makes the
production write-amplification story concrete (~50 GB of embeddings per 1M items at
float16).

Headline capability is delivered by the vendor's own engine: **OpenCLIP**
(`open_clip_torch`) running an OpenCLIP/LAION checkpoint on-device — never a
substitute embedder.

## 2. Architecture delta from vibe-coding-starter-kit

Principle: the starter kit is the ceiling. Keep the reusable B2-backed scaffold,
strip nothing that CI/contract tests depend on, ADD the embedding surfaces, and
REWRITE only the dashboard + docs. (Deletions break structural/contract/agent-doc
gates, so we default to keep-and-add — the proven low-risk path.)

### KEEP (as-is)
- **UI kit / design system** — `apps/web/src/components/ui/`, tokens in
  `app/globals.css`, `/design` page. Never edit generated `ui/` files.
- **Bucket explorer (NON-NEGOTIABLE keep)** — `/files` route, `app/files/`,
  `components/files/`, Files sidebar entry. Full-bucket browse stays.
- **Upload** — `/upload` route + `components/upload/`. Genuinely used here (ingest
  step 1: get source images into the bucket). Default its target prefix to
  `corpus/` so uploads land where the pipeline reads.
- **Backend layered scaffold** — `types → config → repo → service → runtime`,
  `repo/b2_client.py` (S3 client + user agent), `repo/list_cache.py`, `/health`,
  `/metrics`, rate limiting, magic-byte upload validation, structured JSON logging.
- **Data layer** — TanStack Query hooks in `lib/queries.ts`, `lib/api-client.ts`
  route table, `docs/api/openapi.json` contract, structural + contract tests,
  `pnpm verify` pipeline, `check:agent-docs`.
- **Metadata extraction** — supporting only (image dimensions/checksums for the
  corpus thumbnails). Keep as-is; don't feature it.
- Vercel/Railway delivery contracts, agent-doc scaffold (AGENTS.md + shims).

### ADD (new for openclip-batch-embeddings)
Backend (`services/api/app/`):
- `types/jobs.py` — `EmbeddingJob`, `JobConfig`, `JobStatus` (draft|running|
  complete|failed), `JobSummary`.
- `types/search.py` — `SearchHit`, `SearchResponse`.
- `types/stats.py` — extend with embedding-pipeline stat model.
- `repo/b2_object_io.py` — generic `get_bytes` / `put_bytes` / `list_prefix` /
  `delete_prefix` byte helpers over the shared S3 client (mirrors the helpers
  `clip-visual-product-search` added to `repo/`). boto3 stays inside `repo/`.
- `repo/job_store.py` — read/write job manifest JSON at `jobs/<job_id>.json`.
- `repo/embedding_store.py` — write/read `.npy` shards at
  `embeddings/<job_id>/shard-NNN.npy`; list a job's shards.
- `repo/index_store.py` — serialize/deserialize the FAISS index +
  `id_map.json` to/from `indexes/<job_id>/faiss.index` (+ id map).
- `service/openclip_model.py` — **the only place `torch`/`open_clip` are
  imported.** Lazy singleton load, device autodetect (CUDA → MPS → CPU, default
  CPU), `torch.set_num_threads(1)`, 512-d L2-normalized `embed_image` /
  `embed_text`. Model/precision are parameters resolved per job. Copy the shape of
  `clip-visual-product-search/services/api/app/service/clip_model.py`.
- `service/index.py` — per-job `IndexIDMap(IndexFlatIP(512))`, exact cosine over
  normalized vectors, `faiss.omp_set_num_threads(1)`, build-from-shards + persist
  to B2 (copy `clip-visual-product-search`'s `service/index.py`).
- `service/embedding_jobs.py` — orchestrates the entity lifecycle: create / get /
  list / edit / delete (scoped prefix delete) / **run** (stream images → encode →
  write shards → build+upload index → update manifest, updating throughput/counts).
- `service/search.py` — embed text query, load a job's index, top-k, hydrate hits
  with presigned image URLs.
- `runtime/jobs.py` — CRUD+run routes for jobs.
- `runtime/search.py` — `POST /search` (job_id + query → hits).
- `runtime/corpus.py` — `GET /corpus` (scoped list of `corpus/` images + presigned
  thumbnails).
- `scripts/seed-corpus.py` — generate a small **synthetic** labeled image set with
  Pillow (solid colors / simple shapes / rendered words — no network, no committed
  binaries, reproducible), upload to `corpus/`, and optionally run one job so
  verify/screenshot has real artifacts. Model it on
  `clip-visual-product-search/scripts/seed-catalog.py`.

Frontend (`apps/web/src/`):
- `app/jobs/page.tsx` + `app/jobs/[id]/page.tsx` — **primary-entity lifecycle
  surface**: list, create (dialog/form), detail (status, config, shards, vectors,
  index key, throughput), edit (dialog/form), delete, run.
- `app/search/page.tsx` — semantic search (job selector + text query → image grid).
- `app/corpus/page.tsx` — **scoped asset explorer (MANDATORY add)**: thumbnail
  gallery of the sample's own `corpus/` images (distinct from `/files`
  full-bucket browse).
- `components/jobs/*`, `components/search/*`, `components/corpus/*`.
- Rewrite `components/dashboard/*` (see below).
- New TanStack Query hooks in `lib/queries.ts`; register routes in
  `lib/api-client.ts` (`API_CLIENT_ROUTES`); re-export `docs/api/openapi.json`;
  add backend-only routes to `SERVER_ONLY_OPERATIONS` if any.
- Add **Jobs**, **Search**, **Corpus** sidebar nav entries in
  `components/layout/app-sidebar.tsx` (keep Dashboard, Upload, Files, Settings,
  Design).

### TRIM (rewrite, not delete)
- **Dashboard** (`/` + `components/dashboard/*` + `docs/features/dashboard.md`) —
  replace generic upload stats with embedding-pipeline metrics:
  - Stat cards: Corpus images, Vectors embedded, Embedding shards (count + bytes),
    Index size, Jobs run.
  - **Write-amplification projection card** — from the current bytes/vector ratio,
    project embedding storage for 1M / 10M / 100M items at the selected precision
    (this is the sample's distinctive story; float16 ≈ 50 GB/1M items).
  - Growth/throughput chart (vectors over time or items/sec per job) via Recharts.
  - Recent **jobs** table (replaces recent uploads) — status, model, vectors,
    duration. New aggregations flow `runtime → service → repo` and surface via
    `lib/queries.ts` (no bare `useEffect + fetch`).

## 3. B2 surface (S3-compatible only — no b2-native)

All via `repo/` over the S3 client in `repo/b2_client.py`:
- `PutObject` — source images (`corpus/`, via Upload/seed), `.npy` shards
  (`embeddings/<job>/`), FAISS index + id map (`indexes/<job>/`), job manifests
  (`jobs/<job>.json`).
- `GetObject` — stream source images for encoding; download shards to rebuild an
  index; download index + id map on search.
- `ListObjectsV2` — list corpus images, a job's shards, all jobs.
- `DeleteObject` / prefix delete — delete a job scoped to `embeddings/<job>/`,
  `indexes/<job>/`, `jobs/<job>.json` only (never wipe shared prefixes).
- `HeadObject` — object metadata/sizes.
- Presigned `GetObject` — browser image thumbnails/preview (starter kit pattern).

**No b2-native APIs.** No `b2_authorize_account` / `b2_upload_file` / native
client anywhere — b2-doctor check #1 must pass clean.

## 4. Key features (seed README + `docs/features/*.md` stubs)

1. **Batch CLIP embedding pipeline** — stream images from B2, encode locally with
   OpenCLIP, write `.npy` embedding shards back to `embeddings/`.
2. **Vector index build & share** — build a FAISS index per job over the shards
   and upload it to `indexes/` for reuse across workers.
3. **Semantic search** — text query → top-k nearest images, streamed from B2.
4. **Corpus library** — scoped gallery of the source images the pipeline embeds.
5. **Embedding jobs (primary entity)** — create / read / edit / delete / run batch
   jobs with per-job model + precision config.
6. **Local, GPU-optional OpenCLIP inference** — CPU by default, auto-detects
   CUDA → MPS → CPU; no external API key, B2 credentials only.

### External API provider
**None.** The headline workload (OpenCLIP embedding) is fully on-device.
Per-feature deployment field:
- Feature 1 Batch embedding — `deployment: local` (OpenCLIP `open_clip_torch`,
  default checkpoint `ViT-B-32 / laion2b_s34b_b79k`, 512-d). Cost/run: **$0** (no
  API). CPU-default, autodetect CUDA → MPS → CPU. Note: OpenCLIP ViT forward pass
  runs on Apple **MPS**; if an MPS op is unsupported it falls back CUDA → CPU.
  First run downloads ~600 MB of open LAION weights from the HF hub (no token —
  these checkpoints are ungated). Env var for key: **none**.
- Feature 2 Index build — `deployment: local` (faiss-cpu). $0.
- Feature 3 Semantic search — `deployment: local` (OpenCLIP text encoder + FAISS).
  $0.
- Features 4–6 — `deployment: local`. $0.

No provider orchestration via Genblaze: the description names no Genblaze /
`genblaze-*` / `genblaze-s3` stack, and there is no external provider to route.

### Primary entity lifecycle — **Embedding Job**
The single primary entity is the **Embedding Job** (a batch run). All lifecycle
verbs are user-accessible and built in the UI — **no omitted verbs**:
- **create** — `/jobs` create form: name, source prefix, model, precision, shard
  size. Immediately listed as `draft`.
- **read** — `/jobs/[id]` detail: status, config, shard keys under
  `embeddings/<job>/`, vector count, index key, throughput.
- **edit** — edit form: name/description always editable; model/precision/source
  editable only while `draft` (locked after a run, with a note) — a normal
  pre-filled edit form.
- **delete** — deletes the job manifest + its `embeddings/<job>/` and
  `indexes/<job>/` objects (scoped prefix delete). Confirm dialog.
- **run** — the marquee action: stream → encode → write shards → build+upload
  index → mark `complete`. Progress surfaced on the detail page.

### Form UX conventions
Exemplar: `apps/web/src/components/settings/settings-form.tsx` (does both rules).
- **Selector (finite value set) — create AND edit:**
  - `model` → `Select`: `ViT-B-32 / laion2b_s34b_b79k` (default),
    `ViT-B-16 / laion2b_s34b_b79k`. (Both 512-d, so a job's index dim is fixed;
    do not offer a 768-d checkpoint, which would break the shared index dim.)
  - `precision` → `RadioGroup`/`Select`: `float32` (default — most compatible on
    CPU/MPS), `float16` (halves shard bytes; best on CUDA). Finite set.
  - `modality` → `Select`/`RadioGroup`: `images` (default) — (text-metadata
    embedding may be added later; keep the control even if single-value-for-now is
    documented).
- **Create-form safe-default hints (placeholder / `FormDescription`, guidance
  only — never an autofill button):**
  - `name` placeholder e.g. `demo-corpus-run`.
  - `source prefix` free-text input (not finite), default hint `corpus/` —
    "the folder the seed script populates; point at your own prefix to embed a
    real corpus."
  - `shard size` number input, default hint `256` — "items per `.npy` shard."
  - Model/precision defaults are the pre-selected selector values.
- The edit form opens pre-filled from the real job (no default hints there).

## 5. Doc transforms
- **Rewrite:** `docs/features/dashboard.md` (embedding metrics + write-amplification
  card). `README.md` (new purpose, features, quick start incl. seed step + model
  download note, When to use / When not to use, FAQ, Why B2). `AGENTS.md` §2
  dashboard-adaptation note + repo map for new routes. `ARCHITECTURE.md` data-flow
  for the embed→shard→index→search pipeline.
- **Keep:** `docs/features/file-upload.md`, `file-browser.md`,
  `metadata-extraction.md`, `settings.md`, `design-system.md`, verification /
  security / reliability docs (adjust references as touched).
- **New stubs:** `docs/features/embedding-jobs.md`, `batch-embedding-pipeline.md`,
  `vector-index.md`, `semantic-search.md`, `corpus-library.md` (from `_template.md`).
- Update `docs/api/openapi.json` (re-export) and the doc-update mapping targets in
  the same change; move this plan to `docs/exec-plans/completed/` on PASS.

## 6. Rename table

| From (`vibe-coding-starter-kit`) | To |
|---|---|
| repo / root dir | `openclip-batch-embeddings` |
| root `package.json` name | `openclip-batch-embeddings` |
| web `package.json` name `@vibe-coding-starter-kit/web` | `@openclip-batch-embeddings/web` |
| shared `package.json` name | `@openclip-batch-embeddings/shared` |
| `APP_NAME` (app-config.ts) | `OpenCLIP Batch Embeddings` |
| `APP_DESCRIPTION` | "Batch image/text embedding pipeline on Backblaze B2 with OpenCLIP — shards + FAISS index in object storage." |
| FastAPI `API_TITLE` | derived from `APP_NAME` (do not hardcode) |
| `user_agent_extra` | `b2ai-openclip-batch-embeddings` |
| `utm_content` (all backblaze.com links) | `b2ai-openclip-batch-embeddings` |
| Vercel/Railway project + demo title/slug | `openclip-batch-embeddings` |
| CI workflow name/slug references | `openclip-batch-embeddings` |
| Title Case display strings | `OpenCLIP Batch Embeddings` |

Single B2 attribution token across `user_agent_extra` and `utm_content`:
**`b2ai-openclip-batch-embeddings`** (check:agent-docs + b2-doctor #2/#5).

## 7. B2 standards (apply via /b2-doctor before finishing)

1. **S3 default** — S3-compatible API only; no b2-native calls. ✅ by design.
2. **Custom user agent** — `user_agent_extra="b2ai-openclip-batch-embeddings"` on
   the single `boto3.client("s3", …)` in `repo/b2_client.py`.
3. **Standardized env names** — adopt the proven scheme (as in
   `clip-visual-product-search`): `.env.example` has real
   `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_REGION`;
   commented optional `B2_ENDPOINT` override and `B2_PUBLIC_URL_BASE`. `settings.py`
   fields `b2_application_key_id/b2_application_key/b2_bucket_name/b2_region/
   b2_endpoint/b2_public_url_base` with an `endpoint_url` property deriving
   `https://s3.<region>.backblazeb2.com` — **no hardcoded region in source**
   (b2-doctor #4). Update README/Quick Start, Vercel button env list, and
   `check:agent-docs` expectations to match. This replaces the starter kit's
   `B2_KEY_ID`/`B2_ENDPOINT`/`B2_PUBLIC_URL` names.

## 8. Build / ML constraints (proven-good — reuse verbatim)
- `services/api/requirements.txt` ML pins: `numpy<2`, `torch>=2.2,<3`,
  `open_clip_torch>=2.24,<3`, `faiss-cpu>=1.8,<2` (+ existing fastapi/boto3/Pillow/
  pydantic stack). Regenerate `requirements.lock` from this.
- **OMP contention guard** (avoids the known verify-kill under ML contention):
  `OMP_NUM_THREADS` env cap in `main.py`, `torch.set_num_threads(1)` in the model
  loader, `faiss.omp_set_num_threads(1)` in the index module. Never run two heavy
  ML paths concurrently.
- Heavy imports + weight download are **lazy** (first embed call only) so import,
  unit tests, and `pnpm verify` stay network-free and cheap; unit tests inject a
  stub embedder rather than loading the real model (the "unpinned-ML false-green"
  caveat: the real model path is exercised only by the seed/verify step).
- Keep every authored `services/api/app/**` Python file **< 300 lines** (split
  services if needed) — structural test enforces it.

## Notes / tensions
- The starter's `/upload` is kept (not stripped) because ingest genuinely needs it;
  the bucket explorer `/files` is kept per the non-negotiable rule; the scoped asset
  explorer is added as `/corpus`.
- Cross-model index mixing is avoided by making embeddings + FAISS index **per
  job** (each job owns `embeddings/<job>/` and `indexes/<job>/`), so search always
  operates within one model's vector space.
