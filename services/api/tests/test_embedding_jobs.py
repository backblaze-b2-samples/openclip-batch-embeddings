"""End-to-end embedding-job pipeline test.

Hermetic: an in-memory S3 stands in for B2 and a deterministic stub replaces the
real OpenCLIP encoder, so the whole create → run → shards → index → search →
delete path is exercised with no model download and no network.
"""

from datetime import UTC, datetime

import numpy as np
import pytest
from botocore.exceptions import ClientError

from app.repo import b2_object_io
from app.service import embedding_jobs, embedding_run, pipeline_stats
from app.service import search as search_service
from app.types import JobCreate, JobStatus


class _Body:
    def __init__(self, data: bytes):
        self._data = data

    def read(self) -> bytes:
        return self._data


def _missing(op: str) -> ClientError:
    return ClientError({"Error": {"Code": "NoSuchKey"}}, op)


class InMemoryS3:
    def __init__(self):
        self.store: dict[str, tuple[bytes, str, datetime]] = {}

    def put_object(self, Bucket, Key, Body, ContentType="application/octet-stream", **kw):
        data = Body.read() if hasattr(Body, "read") else Body
        self.store[Key] = (data, ContentType, datetime.now(UTC))
        return {}

    def get_object(self, Bucket, Key, **kw):
        if Key not in self.store:
            raise _missing("GetObject")
        data, ctype, mtime = self.store[Key]
        return {"Body": _Body(data), "ContentType": ctype, "ContentLength": len(data), "LastModified": mtime}

    def head_object(self, Bucket, Key, **kw):
        if Key not in self.store:
            raise _missing("HeadObject")
        data, ctype, mtime = self.store[Key]
        return {"ContentLength": len(data), "ContentType": ctype, "LastModified": mtime}

    def list_objects_v2(self, Bucket, Prefix="", MaxKeys=1000, ContinuationToken=None, **kw):
        items = [
            {"Key": k, "Size": len(v[0]), "LastModified": v[2]}
            for k, v in sorted(self.store.items())
            if k.startswith(Prefix)
        ]
        return {"Contents": items, "IsTruncated": False}

    def delete_object(self, Bucket, Key, **kw):
        self.store.pop(Key, None)
        return {}

    def generate_presigned_url(self, op, Params, ExpiresIn):
        return f"https://signed.example/{Params['Key']}"


def _stub_vector(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    vec = rng.standard_normal(512).astype("float32")
    return vec / np.linalg.norm(vec)


@pytest.fixture
def fake_b2(monkeypatch):
    s3 = InMemoryS3()
    monkeypatch.setattr(b2_object_io, "get_s3_client", lambda: s3)
    # embed_* are imported by name into the run/search modules — patch there.
    monkeypatch.setattr(
        embedding_run, "embed_image", lambda model, data: _stub_vector(len(data))
    )
    monkeypatch.setattr(
        search_service, "embed_text", lambda model, text: _stub_vector(len(text))
    )
    # Seed a small corpus.
    for i in range(5):
        s3.put_object(
            Bucket="b", Key=f"corpus/img-{i}.png", Body=_Body(b"x" * (10 + i)),
            ContentType="image/png",
        )
    return s3


def test_run_embeds_corpus_and_builds_index(fake_b2):
    job = embedding_jobs.create_job(JobCreate(name="demo run"))
    assert job.status == JobStatus.draft

    ran = embedding_run.run_job(job.id)
    assert ran.status == JobStatus.complete
    assert ran.image_count == 5
    assert ran.vector_count == 5
    assert ran.shard_count >= 1
    assert ran.shard_bytes > 0
    assert ran.index_bytes > 0
    assert ran.index_key and ran.index_key.startswith("indexes/")

    # Shards and index landed in B2.
    assert any(k.startswith(f"embeddings/{job.id}/") for k in fake_b2.store)
    assert any(k.startswith(f"indexes/{job.id}/") for k in fake_b2.store)


def test_search_returns_hits_after_run(fake_b2):
    job = embedding_jobs.create_job(JobCreate(name="search run", shard_size=2))
    embedding_run.run_job(job.id)

    resp = search_service.search_text(job.id, "a red shape", k=3)
    assert resp.job_id == job.id
    assert 1 <= resp.count <= 3
    assert all(h.key.startswith("corpus/") for h in resp.hits)
    assert all(h.image_url for h in resp.hits)


def test_dashboard_counts_vectors(fake_b2):
    job = embedding_jobs.create_job(JobCreate(name="stats run"))
    embedding_run.run_job(job.id)

    data = pipeline_stats.get_dashboard()
    assert data.stats.corpus_images == 5
    assert data.stats.vectors_embedded == 5
    assert data.stats.jobs_complete == 1
    assert data.stats.bytes_per_vector > 0
    assert len(data.projection) == 3


def test_delete_job_scopes_to_its_prefixes(fake_b2):
    job = embedding_jobs.create_job(JobCreate(name="del run"))
    embedding_run.run_job(job.id)
    embedding_jobs.delete_job(job.id)

    # Its artifacts are gone; the corpus is untouched.
    assert not any(k.startswith(f"embeddings/{job.id}/") for k in fake_b2.store)
    assert not any(k.startswith(f"indexes/{job.id}/") for k in fake_b2.store)
    assert not any(k.startswith(f"jobs/{job.id}") for k in fake_b2.store)
    assert sum(1 for k in fake_b2.store if k.startswith("corpus/")) == 5


def test_run_with_empty_prefix_fails_gracefully(fake_b2):
    job = embedding_jobs.create_job(
        JobCreate(name="empty", source_prefix="nothing-here/")
    )
    ran = embedding_run.run_job(job.id)
    assert ran.status == JobStatus.failed
    assert ran.error and "No images" in ran.error
