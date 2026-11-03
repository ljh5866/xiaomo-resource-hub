import { NextResponse } from "next/server";
import { get } from "@/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 健康检查：给 Caddy / UptimeRobot / systemd 用。不暴露任何隐私数据。 */
export async function GET() {
  const started = Date.now();

  const resources =
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM resources WHERE status = 'published'",
    )?.n ?? 0;

  const dbMs = Date.now() - started;

  return NextResponse.json(
    {
      ok: true,
      app: "xiaomo",
      time: new Date().toISOString(),
      db: { latencyMs: dbMs, published: resources },
      uptimeSec: Math.round(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
