import { NextResponse } from "next/server";

const startedAt = Date.now();

export async function GET() {
  return NextResponse.json({
    status: "ok",
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
  });
}
