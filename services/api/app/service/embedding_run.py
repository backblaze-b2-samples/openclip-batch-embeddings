"""The marquee run: stream corpus images from B2 → encode with OpenCLIP →
write `.npy` shards → build + upload a per-job FAISS index → update the manifest.

Kept separate from `embedding_jobs.py` (CRUD) so both stay under the 300-line
ceiling. Real end-to-end: real GetObject reads, a real on-device OpenCLIP forward
pass, and real PutObject writes of shards + index — no simulation.
"""

import io
import logging
import time
from datetime import UTC, datetime

import numpy as np

from app.repo import get_bytes, list_prefix
from app.repo.embedding_store import delete_job_shards, put_shard
from app.repo.index_store import delete_job_index, index_key
from app.service import embedding_jobs, index
from app.service.embedding_jobs import JobError
from app.service.openclip_model import EMBED_DIM, embed_image
from app.types import EmbeddingJob, JobStatus, Precision

logger = logging.getLogger(__name__)

_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")


def _shard_dtype(precision: Precision) -> str:
    # float16 halves shard bytes; the FAISS index still uses float32.
    return "float16" if precision == Precision.float16 else "float32"


def _source_image_keys(prefix: str) -> list[str]:
    keys = [
        obj["key"]
        for obj in list_prefix(prefix)
        if obj["key"].lower().endswith(_IMAGE_EXTS)
    ]
    keys.sort()
    return keys


def _write_shards(
    job_id: str, matrix: np.ndarray, shard_size: int, dtype: str
) -> tuple[int, int, list[str]]:
    """Write the vectors as `.npy` shards of `shard_size` rows. Returns
    (shard_count, total_bytes, shard_keys)."""
    total = matrix.shape[0]
    shard_count = 0
    shard_bytes = 0
    shard_keys: list[str] = []
    for start in range(0, total, shard_size):
        chunk = matrix[start : start + shard_size].astype(dtype)
        buf = io.BytesIO()
        np.save(buf, chunk)
        data = buf.getvalue()
        shard_keys.append(put_shard(job_id, shard_count, data))
        shard_bytes += len(data)
        shard_count += 1
    return shard_count, shard_bytes, shard_keys


def _fail(job: EmbeddingJob, message: str) -> EmbeddingJob:
    job.status = JobStatus.failed
    job.error = message
    job.updated_at = datetime.now(UTC)
    logger.warning("Job failed: id=%s error=%s", job.id, message)
    return embedding_jobs.save_job(job)


def run_job(job_id: str) -> EmbeddingJob:
    """Run (or re-run) a job end-to-end.

    Returns the updated job (status `complete` or `failed`) — it never 500s on a
    pipeline error; the failure is recorded on the manifest. A missing job 404s
    (via `get_job`); an already-running job 409s.
    """
    job = embedding_jobs.get_job(job_id)
    if job.status == JobStatus.running:
        raise JobError("Job is already running", status_code=409)

    # Scoped clean of any prior artifacts so a re-run is idempotent.
    delete_job_shards(job_id)
    delete_job_index(job_id)
    job.status = JobStatus.running
    job.error = None
    job.updated_at = datetime.now(UTC)
    embedding_jobs.save_job(job)

    try:
        keys = _source_image_keys(job.config.source_prefix)
        if not keys:
            return _fail(
                job,
                f"No images found under '{job.config.source_prefix}'. Upload images "
                "on the Upload page (they land in corpus/) or run the seed script.",
            )

        # Publish the total up front so pollers can render a determinate bar.
        job.image_count = len(keys)
        job.updated_at = datetime.now(UTC)
        embedding_jobs.save_job(job)

        started = time.monotonic()
        vectors: list[np.ndarray] = []
        embedded_keys: list[str] = []
        # Throttled progress writes: let pollers watch vector_count climb
        # without a B2 PutObject per image. Save at most every ~1.5s and every
        # ~10% of the corpus, capping the run to ~10-12 manifest writes.
        last_saved = started
        save_every = max(1, len(keys) // 10)
        for key in keys:
            data = get_bytes(key)
            if data is None:
                continue
            try:
                vectors.append(embed_image(job.config.model.value, data))
                embedded_keys.append(key)
            except Exception as exc:
                logger.warning("Skipping unreadable image %s: %s", key, exc)
            now = time.monotonic()
            if len(embedded_keys) % save_every == 0 and now - last_saved >= 1.5:
                job.vector_count = len(embedded_keys)
                job.updated_at = datetime.now(UTC)
                embedding_jobs.save_job(job)
                last_saved = now

        if not vectors:
            return _fail(job, "No readable images to embed under the source prefix.")

        matrix = np.vstack(vectors).astype("float32")
        shard_count, shard_bytes, shard_keys = _write_shards(
            job_id, matrix, job.config.shard_size, _shard_dtype(job.config.precision)
        )
        index_bytes = index.build_and_persist(job_id, matrix, embedded_keys)
        elapsed = time.monotonic() - started

        job.status = JobStatus.complete
        job.dim = EMBED_DIM
        job.image_count = len(keys)
        job.vector_count = len(embedded_keys)
        job.shard_count = shard_count
        job.shard_bytes = shard_bytes
        job.index_bytes = index_bytes
        job.duration_seconds = round(elapsed, 3)
        job.throughput_per_second = (
            round(len(embedded_keys) / elapsed, 2) if elapsed > 0 else None
        )
        job.index_key = index_key(job_id)
        job.shard_keys = shard_keys
        job.error = None
        job.updated_at = datetime.now(UTC)
        logger.info(
            "Job complete: id=%s vectors=%d shards=%d",
            job_id,
            job.vector_count,
            shard_count,
        )
        return embedding_jobs.save_job(job)
    except Exception as exc:
        return _fail(job, f"Run failed: {exc}")
