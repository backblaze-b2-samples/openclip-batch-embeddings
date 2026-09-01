<!-- last_verified: 2026-09-01 -->
# App Workflows

User journeys inside the application.

## Create and Run an Embedding Job

- User navigates to `/jobs` and clicks **New job**
- The create form uses selectors for finite fields (model, precision, modality) and
  free text for the source prefix and shard size, with safe-default hints
  (`corpus/`, `256`) — never an autofill button
- On save the job is created as a **draft** (nothing embedded yet) and the user lands on `/jobs/[id]`
- Clicking **Run** streams every image under the source prefix from B2, encodes each
  on-device with OpenCLIP (CUDA → MPS → CPU), writes `.npy` shards to `embeddings/<job>/`,
  builds a FAISS index at `indexes/<job>/`, and updates the manifest
- The detail page then shows status, config, images embedded, shard count + bytes,
  index size, throughput, and the shard keys on B2
- A run with no images fails gracefully with a message pointing at the corpus/seed;
  the POST never 500s
- **Edit** changes name/description any time; model/precision/source/shard size are
  locked once the job has run. **Delete** removes the job's shards, index, and manifest
  (scoped) — the corpus is untouched
- See: [Embedding Jobs](features/embedding-jobs.md), [Batch Embedding Pipeline](features/batch-embedding-pipeline.md)

## Search a Job's Index

- User navigates to `/search` (or clicks **Search** on a completed job's detail page)
- Picks a completed job from the selector, types a description, and picks a top-K
- The query is embedded into the same OpenCLIP space, matched against the job's FAISS
  index, and the nearest images render as a grid with a similarity badge, streamed
  from B2 via presigned URLs
- No matches shows an empty state; an incomplete job returns a "run it first" message
- See: [Semantic Search](features/semantic-search.md)

## Browse the Corpus

- User navigates to `/corpus`
- A thumbnail gallery shows the source images under `corpus/` (the sample-scoped view)
- Empty corpus points to Upload or the seed script; the full-bucket `/files` explorer
  still browses every prefix
- See: [Corpus Library](features/corpus-library.md)

## View Dashboard

- User navigates to `/` (home)
- `GET /pipeline/stats` fills five stat cards (corpus images, vectors embedded,
  embedding shards + bytes, index size, jobs run)
- The write-amplification card projects shard storage at 1M/10M/100M items from the
  measured bytes/vector, and notes that float16 halves shard bytes
- The throughput chart plots images/sec per completed job; the recent-jobs table lists
  the latest jobs with status, vectors, and model
- Empty state: zeroed cards + "No runs yet"
- See: [Dashboard](features/dashboard.md)

## Upload Images (ingest)

- User navigates to `/upload`
- Drops or selects images; the API mints keys under `corpus/` so uploads are
  immediately embeddable by the default job
- Files upload **directly from the browser to B2** (a presigned PUT) with a progress
  bar, then a short "Verifying upload..." phase while the API HEADs + magic-byte-sniffs
  the stored object
- On success: a toast and a "View in Files" link; on failure: an error status
- See: [File Upload](features/file-upload.md)

## Browse and Manage Files (full bucket)

- User navigates to `/files` — the full-bucket explorer (every prefix, not just `corpus/`)
- Loads the 100 most recent objects in a tree view with preview / download / delete
- Preview opens image/PDF inline with a metadata panel; delete confirms then reconciles
- See: [File Browser](features/file-browser.md)

## Change Preferences

- User navigates to `/settings`; a banner notes only Theme is wired up for real
- **Theme** persists via `next-themes`; the other fields are labelled demo and persist
  to `localStorage` only
- See: [Settings](features/settings.md)
