"""Per-job FAISS index + id-map persistence under `indexes/<job_id>/`.

Stores raw serialized bytes only — faiss (de)serialization lives in
`service/index.py`, boto3 in `b2_client`. The id map is a JSON list of image
keys where the list position is the FAISS int64 id.
"""

import json

from app.config import settings
from app.repo.b2_object_io import delete_prefix, get_bytes, put_bytes


def _job_prefix(job_id: str) -> str:
    return f"{settings.indexes_prefix}{job_id}/"


def index_key(job_id: str) -> str:
    return f"{_job_prefix(job_id)}faiss.index"


def id_map_key(job_id: str) -> str:
    return f"{_job_prefix(job_id)}id_map.json"


def put_index(job_id: str, index_bytes: bytes) -> str:
    key = index_key(job_id)
    put_bytes(key, index_bytes, "application/octet-stream")
    return key


def get_index(job_id: str) -> bytes | None:
    return get_bytes(index_key(job_id))


def put_id_map(job_id: str, keys: list[str]) -> None:
    put_bytes(
        id_map_key(job_id),
        json.dumps({"keys": keys}).encode("utf-8"),
        "application/json",
    )


def get_id_map(job_id: str) -> list[str] | None:
    data = get_bytes(id_map_key(job_id))
    if data is None:
        return None
    return json.loads(data.decode("utf-8")).get("keys", [])


def delete_job_index(job_id: str) -> int:
    return delete_prefix(_job_prefix(job_id))
