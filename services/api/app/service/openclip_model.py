"""Local OpenCLIP embedder — the only place torch / open_clip are imported.

Vendor-faithful: we run an OpenCLIP/LAION checkpoint on-device through the
maintained `open_clip_torch` runtime — never a substitute embedder. Text and
image inputs map into the same 512-d L2-normalized space, so cosine similarity
(inner product on normalized vectors) ranks text↔image alike.

Device is auto-detected at load time: CUDA → Apple MPS → CPU, defaulting to CPU.
No GPU is ever required (`deployment: local`, per the build plan). The heavy
imports and the weight download (~600 MB of ungated LAION weights, no token)
happen lazily on first use, so importing this module stays cheap and
network-free — unit tests inject a stub embedder instead of loading the model.

Models are cached per checkpoint: a job names its model, and both checkpoints
are 512-d so a job's index dimension is fixed.
"""

import io
import logging
import threading

import numpy as np

logger = logging.getLogger(__name__)

EMBED_DIM = 512

_lock = threading.Lock()
# (arch, pretrained) -> (model, preprocess, tokenizer, device)
_models: dict[tuple[str, str], tuple] = {}
_device: str | None = None


def split_model(value: str) -> tuple[str, str]:
    """Split a `ModelName` value ("ViT-B-32/laion2b_s34b_b79k") into (arch, pretrained)."""
    arch, _, pretrained = value.partition("/")
    return arch, pretrained


def _select_device() -> str:
    """First available of CUDA → Apple MPS → CPU. Never hard-requires a GPU."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _ensure_loaded(arch: str, pretrained: str) -> tuple:
    """Lazily load a checkpoint once, thread-safely (double-checked)."""
    global _device
    key = (arch, pretrained)
    cached = _models.get(key)
    if cached is not None:
        return cached
    with _lock:
        cached = _models.get(key)
        if cached is not None:
            return cached
        import open_clip
        import torch

        # Cap torch's intra-op OpenMP pool to one thread — belt-and-suspenders
        # alongside the OMP_NUM_THREADS env guard set in main.py / seed-corpus.py,
        # so torch's bundled libomp doesn't contend with faiss-cpu's in-process.
        torch.set_num_threads(1)

        device = _select_device()
        logger.info("Loading OpenCLIP %s/%s on device=%s", arch, pretrained, device)
        model, _, preprocess = open_clip.create_model_and_transforms(
            arch, pretrained=pretrained
        )
        tokenizer = open_clip.get_tokenizer(arch)
        model = model.to(device).eval()
        torch.set_grad_enabled(False)
        entry = (model, preprocess, tokenizer, device)
        _models[key] = entry
        _device = device
        return entry


def current_device() -> str | None:
    """The device the model loaded onto, or None if nothing is loaded yet."""
    return _device


def _normalize(vec: "np.ndarray") -> "np.ndarray":
    vec = vec.astype("float32").reshape(-1)
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec = vec / norm
    return vec


def embed_image(model_value: str, image_bytes: bytes) -> np.ndarray:
    """Embed raw image bytes to an L2-normalized 512-d float32 vector."""
    import torch
    from PIL import Image

    arch, pretrained = split_model(model_value)
    model, preprocess, _tokenizer, device = _ensure_loaded(arch, pretrained)
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = preprocess(img).unsqueeze(0).to(device)
    with torch.no_grad():
        features = model.encode_image(tensor)
    return _normalize(features.cpu().numpy())


def embed_text(model_value: str, text: str) -> np.ndarray:
    """Embed a text query to an L2-normalized 512-d float32 vector."""
    import torch

    arch, pretrained = split_model(model_value)
    model, _preprocess, tokenizer, device = _ensure_loaded(arch, pretrained)
    tokens = tokenizer([text]).to(device)
    with torch.no_grad():
        features = model.encode_text(tokens)
    return _normalize(features.cpu().numpy())
