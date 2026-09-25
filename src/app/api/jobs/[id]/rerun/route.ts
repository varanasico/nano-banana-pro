import { NextRequest, NextResponse } from "next/server";
import { rerunJob } from "@/lib/jobs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = rerunJob(id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
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
