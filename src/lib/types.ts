export const RESOLUTIONS = ["1K", "2K", "4K"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// Curated MVP subset of the aspect ratios the provider actually supports
// (full list: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 — see docs/API.md 3.1).
export const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "16:9", "9:16"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const MODES = ["text_to_image", "image_guided", "image_edit"] as const;
export type Mode = (typeof MODES)[number];

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface GenerationParams {
  prompt: string;
  mode: Mode;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  outputCount: number;
}

export interface GenerationJobRow {
  id: string;
  prompt: string;
  mode: Mode;
  resolution: Resolution;
  aspect_ratio: AspectRatio;
  output_count: number;
  input_image_count: number;
  status: JobStatus;
  partial: number;
  error_message: string | null;
  provider_name: string;
  provider_job_id: string | null;
  estimated_cost_usd: number;
  actual_cost_usd: number | null;
  preset_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ImageRow {
  id: string;
  job_id: string;
  file_path: string;
  mime_type: string;
  width?: number | null;
  height?: number | null;
  order_index: number;
  created_at: string;
}

export interface PresetRow {
  id: string;
  name: string;
  prompt: string;
  mode: Mode;
  resolution: Resolution;
  aspect_ratio: AspectRatio;
  output_count: number;
  created_at: string;
}
