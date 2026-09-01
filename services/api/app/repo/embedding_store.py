"""Embedding-shard storage: `.npy` shards under `embeddings/<job_id>/`.

Knows only the key layout; the numpy (de)serialization lives in the service
layer, and boto3 lives in `b2_client`. Each shard is one `embeddings/<job_id>/
shard-NNN.npy` object holding a batch of L2-normalized vectors.
"""

from app.config import settings
from app.repo.b2_object_io import delete_prefix, get_bytes, list_prefix, put_bytes


def _job_prefix(job_id: str) -> str:
    return f"{settings.embeddings_prefix}{job_id}/"


def shard_key(job_id: str, index: int) -> str:
    return f"{_job_prefix(job_id)}shard-{index:03d}.npy"


def put_shard(job_id: str, index: int, data: bytes) -> str:
    """Write one `.npy` shard and return its key."""
    key = shard_key(job_id, index)
    put_bytes(key, data, "application/octet-stream")
    return key


def get_shard(key: str) -> bytes | None:
    return get_bytes(key)


def list_shards(job_id: str) -> list[dict]:
    """Every shard object for a job, ordered by key ({'key','size',...})."""
    shards = [
        o for o in list_prefix(_job_prefix(job_id)) if o["key"].endswith(".npy")
    ]
    shards.sort(key=lambda o: o["key"])
    return shards


def delete_job_shards(job_id: str) -> int:
    return delete_prefix(_job_prefix(job_id))
