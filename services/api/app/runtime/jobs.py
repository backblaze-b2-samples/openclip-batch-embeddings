import logging

# CRUD handlers are sync `def` on purpose: the whole chain is blocking boto3, and
# Starlette runs sync handlers in its threadpool (real concurrency for B2 I/O).
# `run` is heavier still, so it hops to the threadpool explicitly.
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.service import embedding_jobs, embedding_run
from app.service.embedding_jobs import JobError
from app.types import EmbeddingJob, JobCreate, JobSummary, JobUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


def _http_error(e: JobError) -> HTTPException:
    return HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/jobs", response_model=EmbeddingJob, status_code=201)
def create_job_endpoint(data: JobCreate):
    return embedding_jobs.create_job(data)


@router.get("/jobs", response_model=list[JobSummary])
def list_jobs_endpoint():
    return embedding_jobs.list_jobs()


@router.get("/jobs/{job_id}", response_model=EmbeddingJob)
def get_job_endpoint(job_id: str):
    try:
        return embedding_jobs.get_job(job_id)
    except JobError as e:
        raise _http_error(e) from None


@router.patch("/jobs/{job_id}", response_model=EmbeddingJob)
def update_job_endpoint(job_id: str, data: JobUpdate):
    try:
        return embedding_jobs.update_job(job_id, data)
    except JobError as e:
        raise _http_error(e) from None


@router.delete("/jobs/{job_id}")
def delete_job_endpoint(job_id: str):
    try:
        embedding_jobs.delete_job(job_id)
    except JobError as e:
        raise _http_error(e) from None
    return {"deleted": True, "id": job_id}


@router.post("/jobs/{job_id}/run", response_model=EmbeddingJob)
async def run_job_endpoint(job_id: str):
    """Marquee action: stream → encode → write shards → build+upload index.

    Returns the updated job (status `complete` or `failed`); a pipeline error is
    recorded on the manifest rather than 500ing.
    """
    try:
        return await run_in_threadpool(embedding_run.run_job, job_id)
    except JobError as e:
        raise _http_error(e) from None
