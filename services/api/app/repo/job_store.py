"""Job-manifest persistence: each Embedding Job is a JSON object on B2.

B2 is the sole store — there is no database. A job lives at
`jobs/<id>.json`; listing the `jobs/` prefix enumerates every job. Thin JSON
layer over `b2_object_io` so boto3 stays in `b2_client`.
"""

import json

from app.config import settings
from app.repo.b2_object_io import delete_key, get_bytes, list_prefix, put_bytes


def _manifest_key(job_id: str) -> str:
    return f"{settings.jobs_prefix}{job_id}.json"


def read_job(job_id: str) -> dict | None:
    """Return the stored manifest dict, or None if the job does not exist."""
    data = get_bytes(_manifest_key(job_id))
    if data is None:
        return None
    return json.loads(data.decode("utf-8"))


def write_job(job_id: str, manifest: dict) -> None:
    """Write (create or overwrite) a job's manifest JSON."""
    put_bytes(
        _manifest_key(job_id),
        json.dumps(manifest, default=str).encode("utf-8"),
        "application/json",
    )


def delete_job(job_id: str) -> None:
    """Delete only the job manifest (callers scope the artifact prefixes)."""
    delete_key(_manifest_key(job_id))


def list_job_ids() -> list[str]:
    """Every job id, newest-manifest-first by last-modified."""
    objs = [o for o in list_prefix(settings.jobs_prefix) if o["key"].endswith(".json")]
    objs.sort(key=lambda o: o["last_modified"], reverse=True)
    prefix_len = len(settings.jobs_prefix)
    return [o["key"][prefix_len:-len(".json")] for o in objs]
