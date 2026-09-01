from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class ModelName(StrEnum):
    """Finite set of OpenCLIP checkpoints — a selector in the UI.

    Both are 512-d so a job's index dimension is fixed and search always
    operates within one model's vector space. The value is `<arch>/<pretrained>`;
    the encoder splits it on `/` when loading (see service/openclip_model.py).
    """

    vit_b_32_laion = "ViT-B-32/laion2b_s34b_b79k"
    vit_b_16_laion = "ViT-B-16/laion2b_s34b_b79k"


class Precision(StrEnum):
    """Storage precision for the `.npy` embedding shards. Finite set."""

    float32 = "float32"
    float16 = "float16"


class Modality(StrEnum):
    """What the job embeds. Images today; text-metadata may follow."""

    images = "images"


class JobStatus(StrEnum):
    draft = "draft"
    running = "running"
    complete = "complete"
    failed = "failed"


class JobConfig(BaseModel):
    """The knobs a run reads. Locked once a job has run (see edit rules)."""

    model: ModelName = ModelName.vit_b_32_laion
    precision: Precision = Precision.float32
    modality: Modality = Modality.images
    source_prefix: str = "corpus/"
    shard_size: int = 256


class EmbeddingJob(BaseModel):
    """The primary entity: one batch-embedding run and its B2 artifacts."""

    id: str
    name: str
    description: str = ""
    status: JobStatus
    config: JobConfig
    created_at: datetime
    updated_at: datetime
    # Run outputs (populated by a completed run).
    dim: int = 512
    image_count: int = 0
    vector_count: int = 0
    shard_count: int = 0
    shard_bytes: int = 0
    index_bytes: int = 0
    duration_seconds: float | None = None
    throughput_per_second: float | None = None
    index_key: str | None = None
    shard_keys: list[str] = Field(default_factory=list)
    error: str | None = None


class JobCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    model: ModelName = ModelName.vit_b_32_laion
    precision: Precision = Precision.float32
    modality: Modality = Modality.images
    source_prefix: str = Field(default="corpus/", min_length=1, max_length=256)
    shard_size: int = Field(default=256, ge=1, le=100000)


class JobUpdate(BaseModel):
    """Name/description are always editable; config fields only while `draft`."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    model: ModelName | None = None
    precision: Precision | None = None
    source_prefix: str | None = Field(default=None, min_length=1, max_length=256)
    shard_size: int | None = Field(default=None, ge=1, le=100000)


class JobSummary(BaseModel):
    """Lightweight row for the jobs list and the dashboard's recent-jobs table."""

    id: str
    name: str
    status: JobStatus
    model: ModelName
    precision: Precision
    image_count: int
    vector_count: int
    duration_seconds: float | None = None
    created_at: datetime
    updated_at: datetime
