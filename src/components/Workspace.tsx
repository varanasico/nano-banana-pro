"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createJob,
  createPreset,
  getJob,
  getSettings,
  urlToFile,
  type CostGuardrailError,
  type Job,
  type Settings,
} from "@/lib/api-client";
import { ASPECT_RATIOS, RESOLUTIONS, type AspectRatio, type Resolution } from "@/lib/types";
import { JobResults } from "./JobResults";

const POLL_INTERVAL_MS = 2500;
const MAX_INPUT_IMAGES = 3;

function isCostGuardrailError(x: unknown): x is CostGuardrailError {
  return typeof x === "object" && x !== null && (x as { error?: string }).error === "cost_guardrail_exceeded";
}

export function Workspace() {
  const searchParams = useSearchParams();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<Resolution>("2K");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [outputCount, setOutputCount] = useState(1);
  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardrail, setGuardrail] = useState<CostGuardrailError | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load settings + apply defaults.
  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setResolution(s.default_resolution);
      setAspectRatio(s.default_aspect_ratio);
      setOutputCount(s.default_output_count);
    });
  }, []);

  // Prefill from history ("fromJob") or presets ("preset" carries JSON via sessionStorage set by Presets page).
  useEffect(() => {
    const fromJob = searchParams.get("fromJob");
    if (!fromJob) return;
    (async () => {
      const source = await getJob(fromJob);
      setPrompt(source.prompt);
      setResolution(source.resolution);
      setAspectRatio(source.aspect_ratio);
      setOutputCount(source.output_count);
      const files = await Promise.all(
        source.input_images.map((img, i) => urlToFile(img.url, `input-${i}`))
      );
      setInputFiles(files);
    })().catch((err) => setError(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("nbp_preset");
    if (!raw) return;
    sessionStorage.removeItem("nbp_preset");
    try {
      const preset = JSON.parse(raw);
      // Reading a one-shot handoff from sessionStorage (set by the Presets page) into local
      // state — an external-system read, not a derived-state mirror.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrompt(preset.prompt);
      setResolution(preset.resolution);
      setAspectRatio(preset.aspect_ratio);
      setOutputCount(preset.output_count);
    } catch {
      /* ignore malformed sessionStorage payload */
    }
  }, []);

  // Poll job status while queued/processing.
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      const updated = await getJob(job.id);
      setJob(updated);
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job]);

  const estimatedCost = settings ? settings.pricing.standard[resolution] * outputCount : 0;

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).slice(0, MAX_INPUT_IMAGES - inputFiles.length);
    setInputFiles((prev) => [...prev, ...incoming]);
  }

  function removeFile(index: number) {
    setInputFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const submit = useCallback(
    async (confirmCost: boolean) => {
      setSubmitting(true);
      setError(null);
      try {
        const mode = inputFiles.length > 0 ? "image_guided" : "text_to_image";
        const result = await createJob({
          prompt,
          mode,
          resolution,
          aspectRatio,
          outputCount,
          inputFiles,
          confirmCost,
        });
        if (isCostGuardrailError(result)) {
          setGuardrail(result);
          return;
        }
        setGuardrail(null);
        setJob({
          id: result.id,
          status: result.status,
          partial: false,
          prompt,
          mode,
          resolution,
          aspect_ratio: aspectRatio,
          output_count: outputCount,
          estimated_cost_usd: result.estimated_cost_usd,
          actual_cost_usd: null,
          input_images: [],
          output_images: [],
          error_message: null,
          created_at: new Date().toISOString(),
          completed_at: null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [prompt, resolution, aspectRatio, outputCount, inputFiles]
  );

  async function useOutputAsInput(url: string, index: number) {
    if (inputFiles.length >= MAX_INPUT_IMAGES) return;
    const file = await urlToFile(url, `output-${index}`);
    setInputFiles((prev) => [...prev, file]);
  }

  async function saveAsPreset() {
    const name = window.prompt("Název presetu:");
    if (!name) return;
    const mode = inputFiles.length > 0 ? "image_guided" : "text_to_image";
    await createPreset({ name, prompt, mode, resolution, aspect_ratio: aspectRatio, output_count: outputCount });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-300">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Popiš, co chceš vygenerovat…"
            className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-300">
            Zdrojové obrázky (0–3)
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900 p-3"
          >
            <div className="flex flex-wrap gap-2">
              {inputFiles.map((file, i) => (
                <div key={i} className="relative h-20 w-20 overflow-hidden rounded-md border border-neutral-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute right-0 top-0 rounded-bl bg-black/70 px-1.5 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {inputFiles.length < MAX_INPUT_IMAGES && (
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border border-neutral-700 text-xs text-neutral-500 hover:border-amber-400 hover:text-amber-400">
                  + Přidat
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-300">Rozlišení</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as Resolution)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-sm"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-300">Poměr stran</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-sm"
            >
              {ASPECT_RATIOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-300">Počet výstupů</label>
            <select
              value={outputCount}
              onChange={(e) => setOutputCount(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-sm"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-3">
          <div>
            <p className="text-sm text-neutral-400">Odhadovaná cena</p>
            <p className="text-lg font-semibold text-amber-400">${estimatedCost.toFixed(3)}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveAsPreset}
              disabled={!prompt}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-amber-400 hover:text-amber-400 disabled:opacity-40"
            >
              Uložit jako preset
            </button>
            <button
              onClick={() => submit(false)}
              disabled={submitting || !prompt}
              className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
            >
              {submitting ? "Generuji…" : "Generate"}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-400">Výsledky</h2>
        {job ? (
          <JobResults job={job} onUseAsInput={useOutputAsInput} />
        ) : (
          <p className="text-sm text-neutral-600">Zatím nic nevygenerováno.</p>
        )}
      </div>

      {guardrail && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h3 className="font-medium text-neutral-100">Potvrdit vyšší cenu</h3>
            <p className="text-sm text-neutral-400">
              Tento job bude stát odhadem ${guardrail.estimated_cost_usd.toFixed(3)}, což je nad
              tvým limitem ${guardrail.threshold_usd.toFixed(3)}. Pokračovat?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setGuardrail(null)}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300"
              >
                Zrušit
              </button>
              <button
                onClick={() => {
                  setGuardrail(null);
                  submit(true);
                }}
                className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-medium text-neutral-950"
              >
                Pokračovat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
