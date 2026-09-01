import type { ModelName } from "@openclip-batch-embeddings/shared";

/** Cosine similarity (0..1 for normalized OpenCLIP vectors) as a percentage. */
export function formatScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

/** "ViT-B-32/laion2b_s34b_b79k" → "ViT-B-32 · LAION-2B". */
export function modelLabel(model: ModelName): string {
  const arch = model.split("/")[0];
  return `${arch} · LAION-2B`;
}

/** A duration in seconds as a compact "1.2s" / "3m 4s". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
