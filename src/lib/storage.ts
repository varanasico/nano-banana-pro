import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForMime(mimeType: string): string {
  return MIME_EXT[mimeType] ?? "bin";
}

export function saveUploadFile(jobId: string, index: number, buffer: Buffer, mimeType: string): string {
  const dir = path.join(DATA_DIR, "uploads", jobId);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `in_${index}.${extensionForMime(mimeType)}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return `uploads/${jobId}/${fileName}`;
}

export function saveOutputFile(jobId: string, index: number, buffer: Buffer, mimeType: string): string {
  const dir = path.join(DATA_DIR, "outputs", jobId);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `out_${index}.${extensionForMime(mimeType)}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return `outputs/${jobId}/${fileName}`;
}

export function readStorageFile(relativePath: string): Buffer | null {
  const full = path.join(DATA_DIR, relativePath);
  if (!full.startsWith(DATA_DIR)) return null; // guard against path traversal
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full);
}
