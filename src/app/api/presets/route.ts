import { NextRequest, NextResponse } from "next/server";
import { createPreset, listPresets } from "@/lib/presets";
import { ASPECT_RATIOS, MODES, RESOLUTIONS } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ items: listPresets() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const { name, prompt, mode, resolution, aspect_ratio, output_count } = body;
  if (!name || typeof name !== "string")
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!prompt || typeof prompt !== "string")
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  if (!MODES.includes(mode)) return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  if (!RESOLUTIONS.includes(resolution))
    return NextResponse.json({ error: "invalid resolution" }, { status: 400 });
  if (!ASPECT_RATIOS.includes(aspect_ratio))
    return NextResponse.json({ error: "invalid aspect_ratio" }, { status: 400 });
  if (!Number.isInteger(output_count) || output_count < 1 || output_count > 4)
    return NextResponse.json({ error: "output_count must be between 1 and 4" }, { status: 400 });

  const preset = createPreset({ name, prompt, mode, resolution, aspect_ratio, output_count });
  return NextResponse.json(preset, { status: 201 });
}
