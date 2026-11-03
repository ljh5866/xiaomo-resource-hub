import { renderOg } from "@/lib/og-image";

export const runtime = "nodejs";

/**
 * GET /api/og?title=…&sub=…&tag=…
 * 生成 1200×630 分享图。图片内容由 query 决定，所以可以放心缓存。
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;

  const title = (sp.get("title") ?? "小莫资源网").slice(0, 80);
  const sub = sp.get("sub")?.slice(0, 120) ?? undefined;
  const tag = sp.get("tag")?.slice(0, 120) ?? undefined;

  const png = await renderOg({ title, sub, tag });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.byteLength),
      // 一天缓存 + 一周 stale：图片只在后台改标题时变
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
