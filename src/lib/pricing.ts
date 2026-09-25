import { getSettings } from "./settings";
import type { GenerationParams } from "./types";

/** estimated_cost_usd = unit_output_price(resolution) x output_count (docs/PRD.md sekce 10). */
export function estimateCostUsd(params: Pick<GenerationParams, "resolution" | "outputCount">): number {
  const { pricing } = getSettings();
  const unitPrice = pricing.standard[params.resolution];
  return Number((unitPrice * params.outputCount).toFixed(4));
}

export function costPerOutputUsd(resolution: GenerationParams["resolution"]): number {
  const { pricing } = getSettings();
  return pricing.standard[resolution];
}
