import { listPresets } from "@/lib/presets";
import { PresetActions } from "@/components/PresetActions";

export default function PresetsPage() {
  const presets = listPresets();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Presety</h1>
        <p className="text-sm text-neutral-500">
          Ulož si oblíbenou kombinaci promptu a parametrů přímo z workspace tlačítkem „Uložit jako
          preset“.
        </p>
      </div>

      {presets.length === 0 && <p className="text-sm text-neutral-500">Zatím žádné presety.</p>}

      <div className="space-y-2">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-200">{preset.name}</p>
              <p className="truncate text-xs text-neutral-500">{preset.prompt}</p>
              <p className="text-xs text-neutral-600">
                {preset.resolution} · {preset.aspect_ratio} · {preset.output_count}×
              </p>
            </div>
            <PresetActions preset={preset} />
          </div>
        ))}
      </div>
    </div>
  );
}
