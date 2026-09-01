export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  /** Set when a format-specific extractor was skipped or failed (e.g. an image
   *  above the decompression-bomb decode limit). Core fields stay exact. */
  metadata_warning: string | null;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

/** A short-lived presigned PUT the browser uploads a file directly to B2 with.
 *  `headers` are signed into the URL, so the browser must send them verbatim. */
export interface PresignUploadResponse {
  key: string;
  url: string;
  method: string;
  content_type: string;
  headers: Record<string, string>;
  expires_in: number;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- Embedding jobs + semantic search ---

// Both checkpoints are 512-d, so a job's index dimension is fixed and search
// always operates within one model's vector space.
export const MODELS = [
  "ViT-B-32/laion2b_s34b_b79k",
  "ViT-B-16/laion2b_s34b_b79k",
] as const;
export type ModelName = (typeof MODELS)[number];

export const PRECISIONS = ["float32", "float16"] as const;
export type Precision = (typeof PRECISIONS)[number];

export const MODALITIES = ["images"] as const;
export type Modality = (typeof MODALITIES)[number];

export type JobStatus = "draft" | "running" | "complete" | "failed";

export interface JobConfig {
  model: ModelName;
  precision: Precision;
  modality: Modality;
  source_prefix: string;
  shard_size: number;
}

export interface EmbeddingJob {
  id: string;
  name: string;
  description: string;
  status: JobStatus;
  config: JobConfig;
  created_at: string;
  updated_at: string;
  dim: number;
  image_count: number;
  vector_count: number;
  shard_count: number;
  shard_bytes: number;
  index_bytes: number;
  duration_seconds: number | null;
  throughput_per_second: number | null;
  index_key: string | null;
  shard_keys: string[];
  error: string | null;
}

export interface JobSummary {
  id: string;
  name: string;
  status: JobStatus;
  model: ModelName;
  precision: Precision;
  image_count: number;
  vector_count: number;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface SearchHit {
  key: string;
  score: number;
  image_url: string | null;
}

export interface SearchResponse {
  job_id: string;
  query: string;
  count: number;
  hits: SearchHit[];
}

export interface CorpusImage {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  image_url: string | null;
}

export interface PipelineStats {
  corpus_images: number;
  vectors_embedded: number;
  shard_count: number;
  shard_bytes: number;
  shard_bytes_human: string;
  index_bytes: number;
  index_bytes_human: string;
  jobs_total: number;
  jobs_complete: number;
  bytes_per_vector: number;
}

export interface ProjectionPoint {
  items: number;
  label: string;
  projected_bytes: number;
  projected_human: string;
}

export interface ThroughputPoint {
  job_id: string;
  name: string;
  items_per_second: number;
  vector_count: number;
  created_at: string;
}

export interface DashboardData {
  stats: PipelineStats;
  projection: ProjectionPoint[];
  float32_bytes_per_vector: number;
  float16_bytes_per_vector: number;
  throughput: ThroughputPoint[];
}
