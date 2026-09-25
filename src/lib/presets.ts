import crypto from "node:crypto";
import { db } from "./db";
import type { PresetRow } from "./types";

const insertStmt = db.prepare(
  `INSERT INTO presets (id, name, prompt, mode, resolution, aspect_ratio, output_count)
   VALUES (@id, @name, @prompt, @mode, @resolution, @aspect_ratio, @output_count)`
);
const listStmt = db.prepare<[], PresetRow>(`SELECT * FROM presets ORDER BY created_at DESC`);
const getStmt = db.prepare<[string], PresetRow>(`SELECT * FROM presets WHERE id = ?`);
const deleteStmt = db.prepare(`DELETE FROM presets WHERE id = ?`);
const updateStmt = db.prepare(
  `UPDATE presets SET name = @name, prompt = @prompt, mode = @mode, resolution = @resolution,
     aspect_ratio = @aspect_ratio, output_count = @output_count WHERE id = @id`
);

export function listPresets(): PresetRow[] {
  return listStmt.all();
}

export function getPreset(id: string): PresetRow | null {
  return getStmt.get(id) ?? null;
}

export function createPreset(input: Omit<PresetRow, "id" | "created_at">): PresetRow {
  const id = crypto.randomUUID();
  insertStmt.run({ id, ...input });
  return getPreset(id)!;
}

export function updatePreset(
  id: string,
  input: Partial<Omit<PresetRow, "id" | "created_at">>
): PresetRow | null {
  const existing = getPreset(id);
  if (!existing) return null;
  const merged = { ...existing, ...input };
  updateStmt.run(merged);
  return getPreset(id);
}

export function deletePreset(id: string): boolean {
  return deleteStmt.run(id).changes > 0;
}
