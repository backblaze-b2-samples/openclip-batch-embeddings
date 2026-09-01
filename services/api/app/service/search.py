"""Semantic search: text query → nearest corpus images in a job's vector space.

Embed the query into the same 512-d OpenCLIP space the job's shards live in, run
an exact cosine-similarity search over the job's FAISS index, then hydrate each
hit with a presigned image URL. Search is always scoped to one job, so results
never mix vector spaces from different models.
"""

import logging

from app.repo import get_inline_url
from app.service import embedding_jobs, index
from app.service.embedding_jobs import JobError
from app.service.index import IndexUnavailableError
from app.service.openclip_model import embed_text
from app.types import JobStatus, SearchHit, SearchResponse

logger = logging.getLogger(__name__)


def search_text(job_id: str, query: str, k: int = 12) -> SearchResponse:
    q = (query or "").strip()
    if not q:
        raise JobError("Enter a text query to search", status_code=400)

    job = embedding_jobs.get_job(job_id)  # 404s cleanly if missing
    if job.status != JobStatus.complete:
        raise JobError(
            f"Job '{job_id}' has no index yet — run it before searching.",
            status_code=409,
        )

    vec = embed_text(job.config.model.value, q)
    try:
        hits = index.search(job_id, vec, k)
    except IndexUnavailableError as e:
        raise JobError(str(e), status_code=409) from None

    results = [
        SearchHit(key=key, score=score, image_url=get_inline_url(key))
        for key, score in hits
    ]
    return SearchResponse(
        job_id=job_id, query=q, count=len(results), hits=results
    )
