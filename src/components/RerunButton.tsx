"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rerunJob } from "@/lib/api-client";

export function RerunButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const { id } = await rerunJob(jobId);
          router.push(`/?fromJob=${id}`);
        } finally {
          setLoading(false);
        }
      }}
      className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-amber-400 hover:text-amber-400 disabled:opacity-40"
    >
      {loading ? "Spouštím…" : "Re-run"}
    </button>
  );
}
