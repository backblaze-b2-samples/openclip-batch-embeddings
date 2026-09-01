import logging

from fastapi import APIRouter

from app.service import pipeline_stats
from app.types import DashboardData

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/pipeline/stats", response_model=DashboardData)
def pipeline_stats_endpoint():
    """Embedding-pipeline metrics, write-amplification projection, and throughput."""
    return pipeline_stats.get_dashboard()
