import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { serializeJob } from "@/lib/serialize";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(serializeJob(job));
}
