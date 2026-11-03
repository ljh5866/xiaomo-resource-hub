import { NextResponse } from "next/server";
import { countResources, listResources } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 列表分页接口，给「加载更多」用。
 *   GET /api/resources?category=template&offset=24&limit=12
 *
 * 为什么不用 ?page=2 的页面路由：那样每个列表页都会变成动态渲染，
 * 失去 SSG/ISR。这里首屏仍然是静态的，只有"加载更多"才走接口。
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;

  const category = sp.get("category")?.trim() || undefined;
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(24, Math.max(1, Number(sp.get("limit") ?? 12) || 12));

  const items = await listResources({ categorySlug: category, limit, offset });
  const total = await countResources({ categorySlug: category });

  const nextOffset = offset + items.length < total ? offset + items.length : null;

  return NextResponse.json(
    {
      ok: true,
      total,
      nextOffset,
      items: items.map((i) => ({
        ...i,
        // 序列化成毫秒时间戳，客户端直接 new Date(ms)
        updatedAt: i.updatedAt instanceof Date ? i.updatedAt.getTime() : (i.updatedAt ?? null),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
