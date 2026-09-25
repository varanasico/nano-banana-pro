import type { GenerationParams } from "../types";

export interface InputImage {
  buffer: Buffer;
  mimeType: string;
}

export interface GeneratedOutput {
  buffer: Buffer;
  mimeType: string;
}

export interface ProviderGenerationResult {
  outputs: GeneratedOutput[];
  succeededCount: number;
  failedCount: number;
  actualCostUsd: number;
  errors: string[];
}

/**
 * Abstraction over an image-generation provider. See docs/API.md section 3 for the concrete
 * Nano Banana Pro (Gemini) mapping — this interface is what the rest of the app depends on.
 */
export interface ProviderAdapter {
  readonly name: string;
  estimateCost(params: GenerationParams): number;
  generate(params: GenerationParams, inputImages: InputImage[]): Promise<ProviderGenerationResult>;
}
