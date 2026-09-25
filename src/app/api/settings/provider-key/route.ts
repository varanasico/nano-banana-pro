import { NextRequest, NextResponse } from "next/server";
import { setProviderApiKey } from "@/lib/settings";

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : "";
  if (!apiKey) return NextResponse.json({ error: "api_key is required" }, { status: 400 });

  setProviderApiKey(apiKey);
  return NextResponse.json({ ok: true, api_key_suffix: apiKey.slice(-4) });
}
