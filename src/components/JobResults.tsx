"use client";

import type { Job } from "@/lib/api-client";

export function JobResults({
  job,
  onUseAsInput,
}: {
  job: Job;
  onUseAsInput?: (url: string, index: number) => void;
}) {
  if (job.status === "queued" || job.status === "processing") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        {job.status === "queued" ? "Ve frontě…" : "Generuji…"}
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
        Generování selhalo: {job.error_message ?? "neznámá chyba"}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {job.partial && (
        <div className="rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
          Částečný úspěch — {job.output_images.length} z {job.output_count} požadovaných výstupů.{" "}
          {job.error_message}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {job.output_images.map((img, index) => (
          <div
            key={img.id}
            className="group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={job.prompt} className="aspect-square w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <a
                href={img.url}
                download
                className="rounded bg-neutral-950/80 px-2 py-1 text-xs text-neutral-100 hover:bg-neutral-800"
              >
                Stáhnout
              </a>
              {onUseAsInput && (
                <button
                  onClick={() => onUseAsInput(img.url, index)}
                  className="rounded bg-neutral-950/80 px-2 py-1 text-xs text-neutral-100 hover:bg-neutral-800"
                >
                  Použít jako vstup
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-500">
        {job.resolution} · {job.aspect_ratio} · skutečná cena $
        {(job.actual_cost_usd ?? job.estimated_cost_usd).toFixed(3)}
      </p>
    </div>
  );
}
