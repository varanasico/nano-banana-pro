"use client";

import { useEffect, useState } from "react";
import {
  getSettings,
  setProviderApiKey,
  updateSettings,
  type Settings,
} from "@/lib/api-client";
import { ASPECT_RATIOS, RESOLUTIONS, type AspectRatio, type Resolution } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <p className="text-sm text-neutral-500">Načítám…</p>;

  async function save(partial: Record<string, unknown>) {
    const updated = await updateSettings(partial);
    setSettings((prev) => (prev ? { ...prev, ...updated } : prev));
    setSavedMessage("Uloženo.");
    setTimeout(() => setSavedMessage(null), 2000);
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-lg font-semibold">Nastavení</h1>

      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-medium text-neutral-300">Provider</h2>
        <p className="text-xs text-neutral-500">
          {settings.api_key_set
            ? `API klíč nastaven (…${settings.api_key_suffix})`
            : "API klíč není nastaven — appka bez něj nemůže generovat."}
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="GEMINI_API_KEY"
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-amber-400"
          />
          <button
            onClick={async () => {
              if (!apiKey) return;
              await setProviderApiKey(apiKey);
              setApiKey("");
              setSettings(await getSettings());
            }}
            className="rounded-md bg-amber-400 px-3 py-2 text-sm font-medium text-neutral-950"
          >
            Uložit klíč
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-medium text-neutral-300">Výchozí hodnoty nového jobu</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Rozlišení</label>
            <select
              value={settings.default_resolution}
              onChange={(e) => save({ default_resolution: e.target.value as Resolution })}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-sm"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Poměr stran</label>
            <select
              value={settings.default_aspect_ratio}
              onChange={(e) => save({ default_aspect_ratio: e.target.value as AspectRatio })}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-sm"
            >
              {ASPECT_RATIOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Počet výstupů</label>
            <select
              value={settings.default_output_count}
              onChange={(e) => save({ default_output_count: Number(e.target.value) })}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-sm"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-medium text-neutral-300">Cost guardrail</h2>
        <p className="text-xs text-neutral-500">
          Nad touto cenou appka před spuštěním jobu vyžádá potvrzení. Nech prázdné pro vypnutí.
        </p>
        <input
          type="number"
          step="0.01"
          min="0"
          defaultValue={settings.cost_guardrail_threshold_usd ?? ""}
          onBlur={(e) =>
            save({
              cost_guardrail_threshold_usd: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          placeholder="např. 0.5"
          className="w-40 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-amber-400"
        />
      </section>

      {savedMessage && <p className="text-sm text-emerald-400">{savedMessage}</p>}
    </div>
  );
}
