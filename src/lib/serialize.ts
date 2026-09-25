import type { ImageRow } from "./types";
import type { JobWithImages } from "./jobs";

function imageUrl(relativePath: string): string {
  return `/storage/${relativePath}`;
}

function serializeImage(img: ImageRow) {
  return {
    id: img.id,
    url: imageUrl(img.file_path),
    width: img.width ?? null,
    height: img.height ?? null,
  };
}

export function serializeJob(job: JobWithImages) {
  return {
    id: job.id,
    status: job.status,
    partial: Boolean(job.partial),
    prompt: job.prompt,
    mode: job.mode,
    resolution: job.resolution,
    aspect_ratio: job.aspect_ratio,
    output_count: job.output_count,
    estimated_cost_usd: job.estimated_cost_usd,
    actual_cost_usd: job.actual_cost_usd,
    input_images: job.input_images.map(serializeImage),
    output_images: job.output_images.map(serializeImage),
    error_message: job.error_message,
    created_at: job.created_at,
    completed_at: job.completed_at,
  };
}
