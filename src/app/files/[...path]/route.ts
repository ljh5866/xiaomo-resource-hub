import { NextResponse } from "next/server";
import { contentTypeOf, readFile } from "@/lib/storage";

export const runtime = "nodejs";

/** 本地封面的静态出口：/files/covers/xxxx.webp */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const rel = path.join("/");
  const buf = await readFile(rel);

  if (!buf) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentTypeOf(rel),
      // 文件名是内容哈希：可以长期缓存
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(buf.byteLength),
    },
  });
}
