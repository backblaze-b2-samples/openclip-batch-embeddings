import logging

from fastapi import APIRouter

from app.service import corpus as corpus_service
from app.types import CorpusImage

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/corpus", response_model=list[CorpusImage])
def list_corpus_endpoint():
    """Scoped gallery of the source images under corpus/ (not the full bucket)."""
    return corpus_service.list_corpus()
