from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    job_id: str = Field(min_length=1)
    query: str = Field(min_length=1, max_length=1000)
    k: int = Field(default=12, ge=1, le=48)


class SearchHit(BaseModel):
    """A single ranked image, hydrated with a browser-renderable URL."""

    key: str
    # Cosine similarity in [-1, 1] (vectors are L2-normalized, inner product).
    score: float
    # Presigned (or public) URL for the browser. Populated on read; never
    # persisted (presigned URLs are short-lived).
    image_url: str | None = None


class SearchResponse(BaseModel):
    job_id: str
    query: str
    count: int
    hits: list[SearchHit]
