<!-- last_verified: 2026-09-01 -->
# Feature: Corpus Library

## Purpose
A sample-scoped gallery of the source images the pipeline embeds, under the
`corpus/` prefix — distinct from the full-bucket `/files` explorer.

## Used By
- UI: `/corpus`
- API: `GET /corpus`
- Job: `service/corpus.py`

## Core Functions
- `service/corpus.py::list_corpus`
- `repo/b2_object_io.py::list_prefix` + `get_inline_url`

## Canonical Files
- Pattern exemplar: `services/api/app/service/corpus.py`

## Inputs
- None (lists image objects under `settings.corpus_prefix`)

## Outputs
- CorpusImage[]: key, filename, size_bytes, size_human, presigned image_url

## Flow
- `ListObjectsV2` on `corpus/`, filter to image extensions, hydrate thumbnails

## Edge Cases
- Empty corpus → empty state pointing to Upload / the seed script
- Non-image objects under `corpus/` → skipped

## UX States (if applicable)
- Empty: "No corpus images yet" with an Upload CTA
- Loading: skeleton tiles
- Error: inline `ErrorState` with Retry

## Verification
- Test files: `services/api/tests/test_embedding_jobs.py` (corpus counts in dashboard)
- Required cases: gallery lists seeded images; full-bucket `/files` still browses everything
- Focused verify command: `cd services/api && .venv/bin/python -m pytest tests/test_embedding_jobs.py -q`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: the scoped gallery shows only `corpus/` images

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/app-workflows.md](../app-workflows.md)
