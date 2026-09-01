import logging

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.service import search as search_service
from app.service.embedding_jobs import JobError
from app.types import SearchRequest, SearchResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def search_endpoint(req: SearchRequest):
    """Text → nearest corpus images within one job's OpenCLIP/FAISS vector space."""
    try:
        return await run_in_threadpool(
            search_service.search_text, req.job_id, req.query, req.k
        )
    except JobError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None
