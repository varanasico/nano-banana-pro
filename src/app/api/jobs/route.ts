import { NextRequest, NextResponse } from "next/server";
import { createJob, getJob, listJobs, type UploadedFile } from "@/lib/jobs";
import { serializeJob } from "@/lib/serialize";
import { estimateCostUsd } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { ASPECT_RATIOS, MODES, RESOLUTIONS, type GenerationParams } from "@/lib/types";

const MAX_INPUT_IMAGES = 3;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("page_size") ?? 20)));
  const status = searchParams.get("status") ?? undefined;

  const { items, total } = listJobs({ page, pageSize, status });
  return NextResponse.json({
    items: items.map((row) => serializeJob(getJob(row.id)!)),
    page,
    page_size: pageSize,
    total,
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const prompt = String(form.get("prompt") ?? "").trim();
  const mode = String(form.get("mode") ?? "");
  const resolution = String(form.get("resolution") ?? "");
  const aspectRatio = String(form.get("aspect_ratio") ?? "");
  const outputCountRaw = form.get("output_count");
  const outputCount = Number(outputCountRaw);
  const presetId = form.get("preset_id");
  const confirmCost = form.get("confirm_cost") === "true";

  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  if (!MODES.includes(mode as (typeof MODES)[number]))
    return NextResponse.json({ error: `mode must be one of ${MODES.join(", ")}` }, { status: 400 });
  if (!RESOLUTIONS.includes(resolution as (typeof RESOLUTIONS)[number]))
    return NextResponse.json(
      { error: `resolution must be one of ${RESOLUTIONS.join(", ")}` },
      { status: 400 }
    );
  if (!ASPECT_RATIOS.includes(aspectRatio as (typeof ASPECT_RATIOS)[number]))
    return NextResponse.json(
      { error: `aspect_ratio must be one of ${ASPECT_RATIOS.join(", ")}` },
      { status: 400 }
    );
  if (!Number.isInteger(outputCount) || outputCount < 1 || outputCount > 4)
    return NextResponse.json({ error: "output_count must be between 1 and 4" }, { status: 400 });

  const fileEntries = form.getAll("input_images").filter((f): f is File => f instanceof File && f.size > 0);
  if (fileEntries.length > MAX_INPUT_IMAGES) {
    return NextResponse.json(
      { error: `at most ${MAX_INPUT_IMAGES} input images are allowed` },
      { status: 400 }
    );
  }

  const inputFiles: UploadedFile[] = [];
  for (const file of fileEntries) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `unsupported file type: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `${file.name} exceeds the 15MB limit` }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    inputFiles.push({ buffer, mimeType: file.type });
  }

  const params: GenerationParams = {
    prompt,
    mode: mode as GenerationParams["mode"],
    resolution: resolution as GenerationParams["resolution"],
    aspectRatio: aspectRatio as GenerationParams["aspectRatio"],
    outputCount,
  };

  const estimatedCostUsd = estimateCostUsd(params);
  const { costGuardrailThresholdUsd } = getSettings();
  if (
    !confirmCost &&
    costGuardrailThresholdUsd !== null &&
    estimatedCostUsd > costGuardrailThresholdUsd
  ) {
    return NextResponse.json(
      {
        error: "cost_guardrail_exceeded",
        estimated_cost_usd: estimatedCostUsd,
        threshold_usd: costGuardrailThresholdUsd,
        requires_confirmation: true,
      },
      { status: 402 }
    );
  }

  const job = createJob(params, inputFiles, typeof presetId === "string" ? presetId : null);
  return NextResponse.json(
    {
      id: job.id,
      status: job.status,
      estimated_cost_usd: job.estimated_cost_usd,
      created_at: job.created_at,
    },
    { status: 201 }
  );
}
