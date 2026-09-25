import { NextRequest, NextResponse } from "next/server";
import { deletePreset, getPreset, updatePreset } from "@/lib/presets";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const updated = updatePreset(id, body);
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getPreset(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  deletePreset(id);
  return NextResponse.json({ ok: true });
}
