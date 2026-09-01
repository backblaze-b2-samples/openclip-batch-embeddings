"""Dashboard aggregations for the embedding pipeline.

Rolls up the per-job manifests and the corpus listing into the metrics, the
write-amplification projection, and the throughput series the dashboard renders.
Everything flows runtime → service → repo; no boto3 here.
"""

from app.config import settings
from app.repo import list_prefix
from app.service import embedding_jobs
from app.types import (
    DashboardData,
    JobStatus,
    PipelineStats,
    ProjectionPoint,
    ThroughputPoint,
)
from app.types.formatting import humanize_bytes

EMBED_DIM = 512
_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")
# Scale points for the write-amplification story.
_SCALE = ((1_000_000, "1M"), (10_000_000, "10M"), (100_000_000, "100M"))


def _corpus_image_count() -> int:
    return sum(
        1
        for obj in list_prefix(settings.corpus_prefix)
        if obj["key"].lower().endswith(_IMAGE_EXTS)
    )


def get_dashboard() -> DashboardData:
    jobs = embedding_jobs.list_full_jobs()
    complete = [j for j in jobs if j.status == JobStatus.complete]

    vectors_embedded = sum(j.vector_count for j in complete)
    shard_count = sum(j.shard_count for j in complete)
    shard_bytes = sum(j.shard_bytes for j in complete)
    index_bytes = sum(j.index_bytes for j in complete)
    bytes_per_vector = (shard_bytes / vectors_embedded) if vectors_embedded else 0.0

    stats = PipelineStats(
        corpus_images=_corpus_image_count(),
        vectors_embedded=vectors_embedded,
        shard_count=shard_count,
        shard_bytes=shard_bytes,
        shard_bytes_human=humanize_bytes(shard_bytes),
        index_bytes=index_bytes,
        index_bytes_human=humanize_bytes(index_bytes),
        jobs_total=len(jobs),
        jobs_complete=len(complete),
        bytes_per_vector=round(bytes_per_vector, 2),
    )

    # Project at scale using the measured ratio, falling back to the float32
    # theoretical size before the first run so the card is never empty.
    ratio = bytes_per_vector if bytes_per_vector > 0 else float(EMBED_DIM * 4)
    projection = [
        ProjectionPoint(
            items=n,
            label=label,
            projected_bytes=int(n * ratio),
            projected_human=humanize_bytes(int(n * ratio)),
        )
        for n, label in _SCALE
    ]

    throughput = [
        ThroughputPoint(
            job_id=j.id,
            name=j.name,
            items_per_second=j.throughput_per_second or 0.0,
            vector_count=j.vector_count,
            created_at=j.created_at.isoformat(),
        )
        for j in complete
        if j.throughput_per_second
    ]

    return DashboardData(
        stats=stats,
        projection=projection,
        float32_bytes_per_vector=EMBED_DIM * 4,
        float16_bytes_per_vector=EMBED_DIM * 2,
        throughput=throughput,
    )
