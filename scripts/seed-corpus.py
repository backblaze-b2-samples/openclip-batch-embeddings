#!/usr/bin/env python3
"""Seed a small synthetic image corpus into Backblaze B2 and run one demo job.

Generates ~16 deterministic labeled tiles with Pillow (nothing binary is
committed, and a fresh clone reproduces the same corpus with no API key),
uploads them under `corpus/`, then creates and runs one Embedding Job so the
dashboard, search, and corpus pages have real artifacts.

The tiles use clearly distinct subjects (a colored shape + its rendered name) so
text→image search actually discriminates — "a red circle" ranks the red circle
above the blue square. The first embed downloads ~600 MB of ungated LAION
OpenCLIP weights (cached afterwards, no token required).

Usage (from the repo root, with your B2 credentials in .env):

    python scripts/seed-corpus.py
"""

# --- OpenMP single-runtime guard: MUST run before torch/faiss load ---
# The script reaches the OpenCLIP (torch) and FAISS runtimes through the service
# layer, and both bundle their own libomp; without this the first FAISS op aborts
# ("OMP: Error #15"). `setdefault` so an explicit operator override still wins.
import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import io
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
# Reuse the API's service layer (embedding + indexing + B2 writes) so there's a
# single code path for "run a job".
sys.path.insert(0, str(REPO_ROOT / "services" / "api"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(REPO_ROOT / ".env")

from PIL import Image, ImageDraw  # noqa: E402

from app.config import settings  # noqa: E402
from app.repo import put_bytes  # noqa: E402
from app.service import embedding_jobs, embedding_run  # noqa: E402
from app.types import JobCreate  # noqa: E402

SIZE = 336
# (subject label, fill color) — clearly distinct subjects for retrieval.
COLORS = [
    ("red", (220, 60, 50)),
    ("blue", (50, 90, 220)),
    ("green", (40, 170, 90)),
    ("yellow", (240, 200, 40)),
]
SHAPES = ["circle", "square", "triangle", "star"]


def _star(draw: "ImageDraw.ImageDraw", cx: int, cy: int, r: int, fill) -> None:
    import math

    pts = []
    for i in range(10):
        ang = math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rad * math.cos(ang), cy - rad * math.sin(ang)))
    draw.polygon(pts, fill=fill)


def _tile(color_name: str, color, shape: str) -> bytes:
    img = Image.new("RGB", (SIZE, SIZE), (245, 245, 245))
    draw = ImageDraw.Draw(img)
    m = 70
    box = (m, m, SIZE - m, SIZE - m)
    if shape == "circle":
        draw.ellipse(box, fill=color)
    elif shape == "square":
        draw.rectangle(box, fill=color)
    elif shape == "triangle":
        draw.polygon([(SIZE // 2, m), (m, SIZE - m), (SIZE - m, SIZE - m)], fill=color)
    else:
        _star(draw, SIZE // 2, SIZE // 2, (SIZE - 2 * m) // 2, color)
    draw.text((16, SIZE - 28), f"a {color_name} {shape}", fill=(30, 30, 30))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main() -> int:
    print("Seeding synthetic corpus under", settings.corpus_prefix)
    count = 0
    for color_name, color in COLORS:
        for shape in SHAPES:
            key = f"{settings.corpus_prefix}{color_name}-{shape}.png"
            put_bytes(key, _tile(color_name, color, shape), "image/png")
            print(f"  + {key}")
            count += 1
    print(f"Uploaded {count} images.\n")

    job = embedding_jobs.create_job(JobCreate(name="demo-corpus-run"))
    print(f"Created job {job.id}; running (first run downloads OpenCLIP weights)…")
    result = embedding_run.run_job(job.id)
    if result.status.value == "complete":
        print(
            f"Done. Embedded {result.vector_count} images into "
            f"{result.shard_count} shard(s); index at {result.index_key}."
        )
        return 0
    print(f"Run failed: {result.error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
