"""Scoped corpus gallery — the source images the pipeline embeds.

Distinct from the full-bucket `/files` explorer: this lists only image objects
under the `corpus/` prefix and hydrates each with a presigned thumbnail URL.
"""

from app.config import settings
from app.repo import get_inline_url, list_prefix
from app.types import CorpusImage
from app.types.formatting import humanize_bytes

_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")


def list_corpus() -> list[CorpusImage]:
    images: list[CorpusImage] = []
    for obj in list_prefix(settings.corpus_prefix):
        key = obj["key"]
        if not key.lower().endswith(_IMAGE_EXTS):
            continue
        images.append(
            CorpusImage(
                key=key,
                filename=key.rsplit("/", 1)[-1],
                size_bytes=obj["size"],
                size_human=humanize_bytes(obj["size"]),
                image_url=get_inline_url(key),
            )
        )
    images.sort(key=lambda c: c.key)
    return images
