from pydantic import BaseModel


class CorpusImage(BaseModel):
    """One source image in the sample-scoped corpus gallery."""

    key: str
    filename: str
    size_bytes: int
    size_human: str
    image_url: str | None = None


class PipelineStats(BaseModel):
    """Headline embedding-pipeline metrics for the dashboard stat cards."""

    corpus_images: int
    vectors_embedded: int
    shard_count: int
    shard_bytes: int
    shard_bytes_human: str
    index_bytes: int
    index_bytes_human: str
    jobs_total: int
    jobs_complete: int
    # Measured write-amplification ratio: shard bytes per stored vector. Drives
    # the projection card; 0 until at least one job has embedded a vector.
    bytes_per_vector: float


class ProjectionPoint(BaseModel):
    """Projected embedding-shard storage at scale, from the measured ratio."""

    items: int
    label: str
    projected_bytes: int
    projected_human: str


class ThroughputPoint(BaseModel):
    """Per-job embedding throughput for the dashboard chart."""

    job_id: str
    name: str
    items_per_second: float
    vector_count: int
    created_at: str


class DashboardData(BaseModel):
    stats: PipelineStats
    # Projections at 1M / 10M / 100M items, using the measured bytes/vector.
    projection: list[ProjectionPoint]
    # Theoretical bytes/vector for the two precisions (dim * 4 / dim * 2), so the
    # card can show that float16 halves shard bytes even before the first run.
    float32_bytes_per_vector: int
    float16_bytes_per_vector: int
    throughput: list[ThroughputPoint]
