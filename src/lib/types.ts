export const RESOLUTIONS = ["1K", "2K", "4K"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// Curated MVP subset of the aspect ratios the provider actually supports
// (full list: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 — see docs/API.md 3.1).
export const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "16:9", "9:16"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const MODES = ["text_to_image", "image_guided", "image_edit"] as const;
export type Mode = (typeof MODES)[number];

// Nano Banana Pro (higher quality, higher cost) vs. Nano Banana lite (Flash — cheaper, faster).
export const MODELS = ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"] as const;
export type Model = (typeof MODELS)[number];

export const MODEL_LABELS: Record<Model, string> = {
  "gemini-3-pro-image-preview": "Nano Banana Pro",
  "gemini-3.1-flash-image-preview": "Nano Banana lite",
};

/** Which PricingTable column (see settings.ts) a given model's price lives under. */
export function pricingTierFor(model: Model): "standard" | "lite" {
  return model === "gemini-3.1-flash-image-preview" ? "lite" : "standard";
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface GenerationParams {
  prompt: string;
  mode: Mode;
  model: Model;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  outputCount: number;
}

export interface GenerationJobRow {
  id: string;
  prompt: string;
  mode: Mode;
  model: Model;
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
