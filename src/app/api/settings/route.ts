import { NextRequest, NextResponse } from "next/server";
import { getSettings, hasProviderApiKey, providerApiKeySuffix, updateSettings } from "@/lib/settings";
import { ASPECT_RATIOS, MODELS, RESOLUTIONS } from "@/lib/types";

export async function GET() {
  const settings = getSettings();
  return NextResponse.json({
    default_resolution: settings.defaultResolution,
    default_aspect_ratio: settings.defaultAspectRatio,
    default_output_count: settings.defaultOutputCount,
    default_model: settings.defaultModel,
    cost_guardrail_threshold_usd: settings.costGuardrailThresholdUsd,
    pricing: settings.pricing,
    provider_name: "nano_banana_pro",
    api_key_set: hasProviderApiKey(),
    api_key_suffix: providerApiKeySuffix(),
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  if (body.default_resolution && !RESOLUTIONS.includes(body.default_resolution)) {
    return NextResponse.json({ error: "invalid default_resolution" }, { status: 400 });
  }
  if (body.default_aspect_ratio && !ASPECT_RATIOS.includes(body.default_aspect_ratio)) {
    return NextResponse.json({ error: "invalid default_aspect_ratio" }, { status: 400 });
  }
  if (body.default_model && !MODELS.includes(body.default_model)) {
    return NextResponse.json({ error: "invalid default_model" }, { status: 400 });
  }

  const settings = updateSettings({
    defaultResolution: body.default_resolution,
    defaultAspectRatio: body.default_aspect_ratio,
    defaultOutputCount: body.default_output_count,
    defaultModel: body.default_model,
    costGuardrailThresholdUsd:
      body.cost_guardrail_threshold_usd === undefined
        ? undefined
        : body.cost_guardrail_threshold_usd,
    pricing: body.pricing,
  });

  return NextResponse.json({
    default_resolution: settings.defaultResolution,
    default_aspect_ratio: settings.defaultAspectRatio,
    default_output_count: settings.defaultOutputCount,
    default_model: settings.defaultModel,
    cost_guardrail_threshold_usd: settings.costGuardrailThresholdUsd,
    pricing: settings.pricing,
  });
}
