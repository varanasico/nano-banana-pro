"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePreset, type Preset } from "@/lib/api-client";

export function PresetActions({ preset }: { preset: Preset }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  function load() {
    sessionStorage.setItem(
      "nbp_preset",
      JSON.stringify({
        prompt: preset.prompt,
        resolution: preset.resolution,
        aspect_ratio: preset.aspect_ratio,
        output_count: preset.output_count,
      })
    );
    router.push("/");
  }

  async function remove() {
    if (!confirm(`Smazat preset "${preset.name}"?`)) return;
    setDeleting(true);
    try {
      await deletePreset(preset.id);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        onClick={load}
        className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-amber-400 hover:text-amber-400"
      >
        Načíst do workspace
      </button>
      <button
        onClick={remove}
        disabled={deleting}
        className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-red-400 hover:border-red-500 disabled:opacity-40"
      >
        Smazat
      </button>
    </div>
  );
}
