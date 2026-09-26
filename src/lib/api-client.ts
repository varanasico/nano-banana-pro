import type { AspectRatio, JobStatus, Mode, Model, Resolution } from "./types";

export interface JobImage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface Job {
  id: string;
  status: JobStatus;
  partial: boolean;
  prompt: string;
  mode: Mode;
  model: Model;
  resolution: Resolution;
  aspect_ratio: AspectRatio;
  output_count: number;
  estimated_cost_usd: number;
  actual_cost_usd: number | null;
  input_images: JobImage[];
  output_images: JobImage[];
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Preset {
  id: string;
  name: string;
  prompt: string;
  mode: Mode;
  resolution: Resolution;
  aspect_ratio: AspectRatio;
  output_count: number;
  created_at: string;
}

export interface Settings {
  default_resolution: Resolution;
  default_aspect_ratio: AspectRatio;
  default_output_count: number;
  default_model: Model;
  cost_guardrail_threshold_usd: number | null;
  pricing: { standard: Record<Resolution, number>; lite: Record<Resolution, number> };
  provider_name: string;
  api_key_set: boolean;
  api_key_suffix: string | null;
}

export interface CostGuardrailError {
  error: "cost_guardrail_exceeded";
  estimated_cost_usd: number;
  threshold_usd: number;
  requires_confirmation: true;
}

export interface CreateJobInput {
  prompt: string;
  mode: Mode;
  model: Model;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  outputCount: number;
  inputFiles: File[];
  presetId?: string | null;
  confirmCost?: boolean;
}

export async function createJob(
  input: CreateJobInput
): Promise<{ id: string; status: JobStatus; estimated_cost_usd: number } | CostGuardrailError> {
  const form = new FormData();
  form.set("prompt", input.prompt);
  form.set("mode", input.mode);
  form.set("model", input.model);
  form.set("resolution", input.resolution);
  form.set("aspect_ratio", input.aspectRatio);
  form.set("output_count", String(input.outputCount));
  if (input.presetId) form.set("preset_id", input.presetId);
  if (input.confirmCost) form.set("confirm_cost", "true");
  for (const file of input.inputFiles) form.append("input_images", file);

  const res = await fetch("/api/jobs", { method: "POST", body: form });
  const json = await res.json();
  if (res.status === 402) return json as CostGuardrailError;
  if (!res.ok) throw new Error(json.error ?? "Nepodařilo se vytvořit job");
  return json;
}

export async function getJob(id: string): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}`);
  if (!res.ok) throw new Error("Job nenalezen");
  return res.json();
}

export async function listJobs(params: { page?: number; pageSize?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("page_size", String(params.pageSize));
  const res = await fetch(`/api/jobs?${qs.toString()}`);
  if (!res.ok) throw new Error("Nepodařilo se načíst historii");
  return res.json() as Promise<{ items: Job[]; page: number; page_size: number; total: number }>;
}

export async function rerunJob(id: string) {
  const res = await fetch(`/api/jobs/${id}/rerun`, { method: "POST" });
  if (!res.ok) throw new Error("Rerun se nepodařil");
  return res.json() as Promise<{ id: string }>;
}

export async function listPresets(): Promise<{ items: Preset[] }> {
  const res = await fetch("/api/presets");
  if (!res.ok) throw new Error("Nepodařilo se načíst presety");
  return res.json();
}

export async function createPreset(input: Omit<Preset, "id" | "created_at">): Promise<Preset> {
  const res = await fetch("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Nepodařilo se uložit preset");
  return res.json();
}

export async function deletePreset(id: string): Promise<void> {
  const res = await fetch(`/api/presets/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Nepodařilo se smazat preset");
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Nepodařilo se načíst nastavení");
  return res.json();
}

export async function updateSettings(partial: Record<string, unknown>): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw new Error("Nepodařilo se uložit nastavení");
  return res.json();
}

export async function setProviderApiKey(apiKey: string): Promise<void> {
  const res = await fetch("/api/settings/provider-key", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) throw new Error("Nepodařilo se uložit API klíč");
}

export async function urlToFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}
