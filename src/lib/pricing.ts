import { getSettings, pricingTierFor } from "./settings";
import type { GenerationParams } from "./types";

/** estimated_cost_usd = unit_output_price(model, resolution) x output_count (docs/PRD.md sekce 10). */
export function estimateCostUsd(
  params: Pick<GenerationParams, "model" | "resolution" | "outputCount">
): number {
  return Number((costPerOutputUsd(params.model, params.resolution) * params.outputCount).toFixed(4));
}

export function costPerOutputUsd(
  model: GenerationParams["model"],
  resolution: GenerationParams["resolution"]
): number {
  const { pricing } = getSettings();
  return pricing[pricingTierFor(model)][resolution];
}
