import { nanoBananaProAdapter } from "./nanoBananaPro";
import type { ProviderAdapter } from "./types";

export const activeProvider: ProviderAdapter = nanoBananaProAdapter;
export type { ProviderAdapter, ProviderGenerationResult, InputImage, GeneratedOutput } from "./types";
