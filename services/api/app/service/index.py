"""Per-job FAISS index over one job's embedding shards, persisted to B2.

Each job owns an `IndexIDMap(IndexFlatIP(512))`: exact inner-product search over
L2-normalized vectors == exact cosine similarity. The FAISS int64 id is the row
position, and a parallel JSON list of image keys (id_map) rides alongside it.
Both live on B2 (`indexes/<job_id>/faiss.index` + `id_map.json`). Building and
searching are stateless — the durable source of truth is the bucket, not memory,
so any worker can rebuild an index from another worker's shards.
"""

import logging

import faiss
import numpy as np

from app.repo import index_store

logger = logging.getLogger(__name__)

# faiss-cpu bundles its own libomp; pin its OpenMP pool to one thread so it never
# contends with torch's OpenMP runtime in the same process (see main.py's OMP
# guard). Belt-and-suspenders alongside the OMP_NUM_THREADS env cap.
faiss.omp_set_num_threads(1)

EMBED_DIM = 512


class IndexUnavailableError(Exception):
    """Raised when a job's index has not been built yet."""


def build_and_persist(job_id: str, matrix: np.ndarray, keys: list[str]) -> int:
    """Build a fresh index over `matrix` (N, 512) and write it + the id map to B2.

    Returns the serialized index size in bytes.
    """
    mat = np.ascontiguousarray(matrix, dtype="float32").reshape(-1, EMBED_DIM)
    index = faiss.IndexIDMap(faiss.IndexFlatIP(EMBED_DIM))
    ids = np.arange(mat.shape[0], dtype="int64")
    index.add_with_ids(mat, ids)
    index_bytes = faiss.serialize_index(index).tobytes()
    index_store.put_index(job_id, index_bytes)
    index_store.put_id_map(job_id, keys)
    logger.info("Built FAISS index for job=%s (%d vectors)", job_id, mat.shape[0])
    return len(index_bytes)


def search(job_id: str, vec: np.ndarray, k: int) -> list[tuple[str, float]]:
    """Return up to `k` (image_key, cosine-score) hits for a query vector."""
    index_bytes = index_store.get_index(job_id)
    keys = index_store.get_id_map(job_id)
    if index_bytes is None or keys is None:
        raise IndexUnavailableError(f"No index built for job '{job_id}'")
    index = faiss.deserialize_index(np.frombuffer(index_bytes, dtype="uint8"))
    total = index.ntotal
    if total == 0:
        return []
    query = np.ascontiguousarray(vec, dtype="float32").reshape(1, EMBED_DIM)
    scores, ids = index.search(query, min(k, total))
    hits: list[tuple[str, float]] = []
    for idx, score in zip(ids[0], scores[0], strict=False):
        if idx == -1 or idx < 0 or idx >= len(keys):
            continue
        hits.append((keys[idx], float(score)))
    return hits
