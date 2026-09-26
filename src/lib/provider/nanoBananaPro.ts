import { costPerOutputUsd } from "../pricing";
import { getProviderApiKey } from "../settings";
import type { GenerationParams } from "../types";
import type { GeneratedOutput, InputImage, ProviderAdapter, ProviderGenerationResult } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Small stagger between fan-out requests so 4 simultaneous outputs don't look like a burst to
// the provider's rate limiter. See docs/API.md section 3.3.
const FAN_OUT_JITTER_MS = 150;

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  error?: { message?: string; status?: string };
}

function buildRequestBody(params: GenerationParams, inputImages: InputImage[]) {
  const parts: GeminiPart[] = [{ text: params.prompt }];
  for (const img of inputImages) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.buffer.toString("base64") } });
  }
  return {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: params.aspectRatio,
        imageSize: params.resolution,
      },
    },
  };
}

async function generateOne(
  params: GenerationParams,
  inputImages: InputImage[],
  apiKey: string
): Promise<GeneratedOutput> {
  const res = await fetch(`${API_BASE}/${params.model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildRequestBody(params, inputImages)),
  });

  const json = (await res.json()) as GeminiResponse;

  if (!res.ok) {
    throw new Error(json.error?.message ?? `Provider request failed with HTTP ${res.status}`);
  }

  const imagePart = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!imagePart?.inlineData) {
    const finishReason = json.candidates?.[0]?.finishReason;
    throw new Error(
      finishReason
        ? `Provider returned no image (finishReason: ${finishReason})`
        : "Provider response contained no image"
    );
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const nanoBananaProAdapter: ProviderAdapter = {
  name: "nano_banana_pro",

  estimateCost(params) {
    return Number((costPerOutputUsd(params.model, params.resolution) * params.outputCount).toFixed(4));
  },

  async generate(params, inputImages): Promise<ProviderGenerationResult> {
    const apiKey = getProviderApiKey();
    if (!apiKey) {
      throw new Error(
        "No provider API key configured. Set GEMINI_API_KEY or configure it in Settings."
      );
    }

    const attempts = await Promise.allSettled(
      Array.from({ length: params.outputCount }, async (_, i) => {
        if (i > 0) await delay(i * FAN_OUT_JITTER_MS);
        return generateOne(params, inputImages, apiKey);
      })
    );

    const outputs: GeneratedOutput[] = [];
    const errors: string[] = [];
    for (const attempt of attempts) {
      if (attempt.status === "fulfilled") {
        outputs.push(attempt.value);
      } else {
        errors.push(attempt.reason instanceof Error ? attempt.reason.message : String(attempt.reason));
      }
    }

    const unitPrice = costPerOutputUsd(params.model, params.resolution);
    return {
      outputs,
      succeededCount: outputs.length,
      failedCount: errors.length,
      actualCostUsd: Number((unitPrice * outputs.length).toFixed(4)),
      errors,
    };
  },
};
