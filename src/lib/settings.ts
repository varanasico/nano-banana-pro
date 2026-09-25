import { db } from "./db";
import type { AspectRatio, Resolution } from "./types";

export interface PricingTable {
  // USD per output image, by resolution.
  standard: Record<Resolution, number>;
}

export interface AppSettings {
  defaultResolution: Resolution;
  defaultAspectRatio: AspectRatio;
  defaultOutputCount: number;
  costGuardrailThresholdUsd: number | null;
  pricing: PricingTable;
}

const DEFAULT_PRICING: PricingTable = {
  // Orientační ceny, ověř aktuální ceník providera — viz docs/PRD.md sekce 10.
  standard: { "1K": 0.134, "2K": 0.134, "4K": 0.24 },
};

const DEFAULTS: AppSettings = {
  defaultResolution: "2K",
  defaultAspectRatio: "1:1",
  defaultOutputCount: 1,
  costGuardrailThresholdUsd: 0.5,
  pricing: DEFAULT_PRICING,
};

const getStmt = db.prepare<[string], { value: string }>(
  "SELECT value FROM settings WHERE key = ?"
);
const setStmt = db.prepare<[string, string]>(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);

function getRaw(key: string): string | undefined {
  return getStmt.get(key)?.value;
}

export function getSettings(): AppSettings {
  return {
    defaultResolution: (getRaw("default_resolution") as Resolution) ?? DEFAULTS.defaultResolution,
    defaultAspectRatio:
      (getRaw("default_aspect_ratio") as AspectRatio) ?? DEFAULTS.defaultAspectRatio,
    defaultOutputCount: Number(getRaw("default_output_count") ?? DEFAULTS.defaultOutputCount),
    costGuardrailThresholdUsd: (() => {
      const raw = getRaw("cost_guardrail_threshold_usd");
      if (raw === undefined) return DEFAULTS.costGuardrailThresholdUsd;
      if (raw === "") return null;
      return Number(raw);
    })(),
    pricing: (() => {
      const raw = getRaw("pricing_json");
      if (!raw) return DEFAULT_PRICING;
      try {
        return JSON.parse(raw) as PricingTable;
      } catch {
        return DEFAULT_PRICING;
      }
    })(),
  };
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  if (partial.defaultResolution) setStmt.run("default_resolution", partial.defaultResolution);
  if (partial.defaultAspectRatio) setStmt.run("default_aspect_ratio", partial.defaultAspectRatio);
  if (partial.defaultOutputCount !== undefined)
    setStmt.run("default_output_count", String(partial.defaultOutputCount));
  if (partial.costGuardrailThresholdUsd !== undefined)
    setStmt.run(
      "cost_guardrail_threshold_usd",
      partial.costGuardrailThresholdUsd === null ? "" : String(partial.costGuardrailThresholdUsd)
    );
  if (partial.pricing) setStmt.run("pricing_json", JSON.stringify(partial.pricing));
  return getSettings();
}

/** Provider API key: DB override takes precedence over the GEMINI_API_KEY env var. */
export function getProviderApiKey(): string | undefined {
  return getRaw("provider_api_key") || process.env.GEMINI_API_KEY;
}

export function setProviderApiKey(key: string): void {
  setStmt.run("provider_api_key", key);
}

export function hasProviderApiKey(): boolean {
  return Boolean(getProviderApiKey());
}

export function providerApiKeySuffix(): string | null {
  const key = getProviderApiKey();
  if (!key) return null;
  return key.slice(-4);
}
