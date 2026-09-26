import Link from "next/link";
import { getJob, listJobs } from "@/lib/jobs";
import { serializeJob } from "@/lib/serialize";
import { RerunButton } from "@/components/RerunButton";
import { MODEL_LABELS } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  queued: "Ve frontě",
  processing: "Generuji",
  completed: "Hotovo",
  failed: "Selhalo",
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));
  const { items, total } = listJobs({ page, pageSize: 20 });
  const jobs = items.map((row) => serializeJob(getJob(row.id)!));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Historie ({total})</h1>

      {jobs.length === 0 && <p className="text-sm text-neutral-500">Zatím žádné joby.</p>}

      <div className="space-y-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3 sm:flex-row sm:items-center"
          >
            <div className="flex gap-1.5">
              {job.output_images.slice(0, 4).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={img.url}
                  alt=""
                  className="h-14 w-14 rounded object-cover border border-neutral-800"
                />
              ))}
              {job.output_images.length === 0 && (
                <div className="flex h-14 w-14 items-center justify-center rounded border border-neutral-800 text-xs text-neutral-600">
                  {STATUS_LABEL[job.status]}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-neutral-200">{job.prompt}</p>
              <p className="text-xs text-neutral-500">
                {MODEL_LABELS[job.model]} · {job.resolution} · {job.aspect_ratio} · {job.output_count}× ·{" "}
                {STATUS_LABEL[job.status]} · ${(job.actual_cost_usd ?? job.estimated_cost_usd).toFixed(3)}{" "}
                · {new Date(job.created_at).toLocaleString("cs-CZ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/?fromJob=${job.id}`}
                className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-amber-400 hover:text-amber-400"
              >
                Načíst do workspace
              </Link>
              <RerunButton jobId={job.id} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-sm">
        {page > 1 ? (
          <Link href={`/history?page=${page - 1}`} className="text-amber-400 hover:underline">
            ← Novější
          </Link>
        ) : (
          <span />
        )}
        {page * 20 < total && (
          <Link href={`/history?page=${page + 1}`} className="text-amber-400 hover:underline">
            Starší →
          </Link>
        )}
      </div>
    </div>
  );
}
