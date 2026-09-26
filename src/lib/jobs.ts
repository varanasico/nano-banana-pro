import crypto from "node:crypto";
import { db } from "./db";
import { activeProvider } from "./provider";
import { readStorageFile, saveOutputFile, saveUploadFile } from "./storage";
import { estimateCostUsd } from "./pricing";
import type { GenerationJobRow, GenerationParams, ImageRow } from "./types";

const JOB_CONCURRENCY = Number(process.env.JOB_CONCURRENCY ?? 1);
let running = 0;
const pending: string[] = [];

export interface UploadedFile {
  buffer: Buffer;
  mimeType: string;
}

export interface JobWithImages extends GenerationJobRow {
  input_images: ImageRow[];
  output_images: ImageRow[];
}

const insertJobStmt = db.prepare(
  `INSERT INTO generation_jobs
    (id, prompt, mode, model, resolution, aspect_ratio, output_count, input_image_count, status, estimated_cost_usd, preset_id)
   VALUES (@id, @prompt, @mode, @model, @resolution, @aspect_ratio, @output_count, @input_image_count, 'queued', @estimated_cost_usd, @preset_id)`
);

const insertInputImageStmt = db.prepare(
  `INSERT INTO generation_input_images (id, job_id, file_path, mime_type, order_index) VALUES (?, ?, ?, ?, ?)`
);

const insertOutputImageStmt = db.prepare(
  `INSERT INTO generation_output_images (id, job_id, file_path, mime_type, order_index) VALUES (?, ?, ?, ?, ?)`
);

const getJobStmt = db.prepare<[string], GenerationJobRow>(
  `SELECT * FROM generation_jobs WHERE id = ?`
);

const getInputImagesStmt = db.prepare<[string], ImageRow>(
  `SELECT * FROM generation_input_images WHERE job_id = ? ORDER BY order_index ASC`
);

const getOutputImagesStmt = db.prepare<[string], ImageRow>(
  `SELECT * FROM generation_output_images WHERE job_id = ? ORDER BY order_index ASC`
);

const updateJobStatusStmt = db.prepare(
  `UPDATE generation_jobs SET status = @status, partial = @partial, error_message = @error_message,
     actual_cost_usd = @actual_cost_usd, completed_at = @completed_at WHERE id = @id`
);

function toJobWithImages(row: GenerationJobRow): JobWithImages {
  return {
    ...row,
    input_images: getInputImagesStmt.all(row.id),
    output_images: getOutputImagesStmt.all(row.id),
  };
}

export function getJob(id: string): JobWithImages | null {
  const row = getJobStmt.get(id);
  return row ? toJobWithImages(row) : null;
}

export function listJobs(opts: { page: number; pageSize: number; status?: string }) {
  const offset = (opts.page - 1) * opts.pageSize;
  const where = opts.status ? "WHERE status = ?" : "";
  const args = opts.status ? [opts.status] : [];
  const items = db
    .prepare(
      `SELECT * FROM generation_jobs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...args, opts.pageSize, offset) as GenerationJobRow[];
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM generation_jobs ${where}`).get(...args) as { c: number }
  ).c;
  return { items, total };
}

export function createJob(
  params: GenerationParams,
  inputFiles: UploadedFile[],
  presetId: string | null = null
): JobWithImages {
  const id = `job_${crypto.randomUUID()}`;
  insertJobStmt.run({
    id,
    prompt: params.prompt,
    mode: params.mode,
    model: params.model,
    resolution: params.resolution,
    aspect_ratio: params.aspectRatio,
    output_count: params.outputCount,
    input_image_count: inputFiles.length,
    estimated_cost_usd: estimateCostUsd(params),
    preset_id: presetId,
  });

  inputFiles.forEach((file, index) => {
    const relativePath = saveUploadFile(id, index, file.buffer, file.mimeType);
    insertInputImageStmt.run(crypto.randomUUID(), id, relativePath, file.mimeType, index);
  });

  enqueue(id);
  return getJob(id)!;
}

export function rerunJob(sourceJobId: string): JobWithImages | null {
  const source = getJob(sourceJobId);
  if (!source) return null;

  const params: GenerationParams = {
    prompt: source.prompt,
    mode: source.mode,
    model: source.model,
    resolution: source.resolution,
    aspectRatio: source.aspect_ratio,
    outputCount: source.output_count,
  };

  const inputFiles: UploadedFile[] = source.input_images.map((img) => ({
    buffer: readInputBuffer(img.file_path),
    mimeType: img.mime_type,
  }));

  return createJob(params, inputFiles, source.preset_id);
}

function readInputBuffer(relativePath: string): Buffer {
  const buf = readStorageFile(relativePath);
  if (!buf) throw new Error(`Missing stored file: ${relativePath}`);
  return buf;
}

// --- Minimal in-process queue (see docs/PRD.md section 8: no Redis/BullMQ needed for 1 user) ---

function enqueue(jobId: string) {
  pending.push(jobId);
  pump();
}

function pump() {
  while (running < JOB_CONCURRENCY && pending.length > 0) {
    const jobId = pending.shift()!;
    running++;
    processJob(jobId)
      .catch((err) => {
        console.error(`Job ${jobId} failed unexpectedly`, err);
      })
      .finally(() => {
        running--;
        pump();
      });
  }
}

async function processJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  db.prepare("UPDATE generation_jobs SET status = 'processing' WHERE id = ?").run(jobId);

  const params: GenerationParams = {
    prompt: job.prompt,
    mode: job.mode,
    model: job.model,
    resolution: job.resolution,
    aspectRatio: job.aspect_ratio,
    outputCount: job.output_count,
  };
  const inputImages = job.input_images.map((img) => ({
    buffer: readInputBuffer(img.file_path),
    mimeType: img.mime_type,
  }));

  try {
    const result = await activeProvider.generate(params, inputImages);

    result.outputs.forEach((output, index) => {
      const relativePath = saveOutputFile(jobId, index, output.buffer, output.mimeType);
      insertOutputImageStmt.run(crypto.randomUUID(), jobId, relativePath, output.mimeType, index);
    });

    const allFailed = result.succeededCount === 0;
    updateJobStatusStmt.run({
      id: jobId,
      status: allFailed ? "failed" : "completed",
      partial: result.failedCount > 0 && !allFailed ? 1 : 0,
      error_message:
        result.errors.length > 0
          ? `${result.failedCount} of ${job.output_count} generations failed: ${result.errors[0]}`
          : null,
      actual_cost_usd: result.actualCostUsd,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    updateJobStatusStmt.run({
      id: jobId,
      status: "failed",
      partial: 0,
      error_message: err instanceof Error ? err.message : String(err),
      actual_cost_usd: 0,
      completed_at: new Date().toISOString(),
    });
  }
}
