"""Embedding-job lifecycle: create / read / list / edit / delete.

The Embedding Job is the app's primary entity. B2 is the sole store: each job is
a manifest at `jobs/<id>.json`, its shards at `embeddings/<id>/`, and its index at
`indexes/<id>/`. The `run` verb lives in `embedding_run.py` to keep this module
under the 300-line ceiling. Nothing here touches boto3 directly — all B2 access
goes through `repo/`.
"""

import logging
import re
import uuid
from datetime import UTC, datetime

from app.repo import job_store
from app.repo.embedding_store import delete_job_shards
from app.repo.index_store import delete_job_index
from app.types import (
    EmbeddingJob,
    JobConfig,
    JobCreate,
    JobStatus,
    JobSummary,
    JobUpdate,
)

logger = logging.getLogger(__name__)

_CONFIG_FIELDS = ("model", "precision", "source_prefix", "shard_size")


class JobError(Exception):
    """Raised on job validation / conflict / not-found failures."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def _now() -> datetime:
    return datetime.now(UTC)


def _slug(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return (base or "job")[:32]


def _persist(job: EmbeddingJob) -> EmbeddingJob:
    job_store.write_job(job.id, job.model_dump(mode="json"))
    return job


def save_job(job: EmbeddingJob) -> EmbeddingJob:
    """Public manifest write, used by the run pipeline to record progress."""
    return _persist(job)


def create_job(data: JobCreate) -> EmbeddingJob:
    now = _now()
    job_id = f"{_slug(data.name)}-{uuid.uuid4().hex[:6]}"
    job = EmbeddingJob(
        id=job_id,
        name=data.name,
        description=data.description,
        status=JobStatus.draft,
        config=JobConfig(
            model=data.model,
            precision=data.precision,
            modality=data.modality,
            source_prefix=data.source_prefix,
            shard_size=data.shard_size,
        ),
        created_at=now,
        updated_at=now,
    )
    logger.info("Job created: id=%s model=%s", job_id, data.model.value)
    return _persist(job)


def get_job(job_id: str) -> EmbeddingJob:
    manifest = job_store.read_job(job_id)
    if manifest is None:
        raise JobError(f"Job '{job_id}' not found", status_code=404)
    return EmbeddingJob.model_validate(manifest)


def list_jobs() -> list[JobSummary]:
    summaries: list[JobSummary] = []
    for job_id in job_store.list_job_ids():
        manifest = job_store.read_job(job_id)
        if manifest is None:
            continue
        job = EmbeddingJob.model_validate(manifest)
        summaries.append(
            JobSummary(
                id=job.id,
                name=job.name,
                status=job.status,
                model=job.config.model,
                precision=job.config.precision,
                image_count=job.image_count,
                vector_count=job.vector_count,
                duration_seconds=job.duration_seconds,
                created_at=job.created_at,
                updated_at=job.updated_at,
            )
        )
    return summaries


def list_full_jobs() -> list[EmbeddingJob]:
    """Every job as a full manifest (used by the dashboard aggregations)."""
    jobs: list[EmbeddingJob] = []
    for job_id in job_store.list_job_ids():
        manifest = job_store.read_job(job_id)
        if manifest is not None:
            jobs.append(EmbeddingJob.model_validate(manifest))
    return jobs


def update_job(job_id: str, data: JobUpdate) -> EmbeddingJob:
    job = get_job(job_id)

    if data.name is not None:
        job.name = data.name
    if data.description is not None:
        job.description = data.description

    wants_config = any(
        getattr(data, f) is not None for f in _CONFIG_FIELDS
    )
    if wants_config:
        if job.status != JobStatus.draft:
            raise JobError(
                "Model, precision, source prefix, and shard size are locked once "
                "a job has run. Create a new job to embed with different settings.",
                status_code=409,
            )
        if data.model is not None:
            job.config.model = data.model
        if data.precision is not None:
            job.config.precision = data.precision
        if data.source_prefix is not None:
            job.config.source_prefix = data.source_prefix
        if data.shard_size is not None:
            job.config.shard_size = data.shard_size

    job.updated_at = _now()
    logger.info("Job updated: id=%s", job_id)
    return _persist(job)


def delete_job(job_id: str) -> None:
    # 404s cleanly if the job is already gone.
    get_job(job_id)
    # Scoped tear-down: only this job's shards, index, and manifest.
    delete_job_shards(job_id)
    delete_job_index(job_id)
    job_store.delete_job(job_id)
    logger.info("Job deleted: id=%s", job_id)
