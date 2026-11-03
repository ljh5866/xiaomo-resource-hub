import { NextResponse } from "next/server";
import { get, run } from "@/db/client";
import { clientKey, hit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const PROVIDERS = new Set(["quark", "baidu", "aliyun", "xunlei", "123", "other"]);

/** 投稿：游客推荐一条资源，进 submissions 表等审核。限流 3 次/小时/IP */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    url?: string;
    categorySlug?: string;
    provider?: string;
    note?: string;
    contact?: string;
  } | null;

  const title = String(body?.title ?? "").trim().slice(0, 120);
  const url = String(body?.url ?? "").trim().slice(0, 500);
  const provider = String(body?.provider ?? "other");
  const categorySlug = String(body?.categorySlug ?? "").trim().slice(0, 60);
  const note = String(body?.note ?? "").trim().slice(0, 400);
  const contact = String(body?.contact ?? "").trim().slice(0, 120);

  if (title.length < 2) {
    return NextResponse.json({ ok: false, message: "标题太短" }, { status: 400 });
  }
  if (!/^https?:\/\/\S+$/i.test(url)) {
    return NextResponse.json({ ok: false, message: "链接要以 http(s):// 开头" }, { status: 400 });
  }
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ ok: false, message: "网盘类型不对" }, { status: 400 });
  }

  const rl = hit(clientKey(req, "submit"), { limit: 3, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, message: `提交太频繁，请 ${Math.ceil(rl.retryAfterSec / 60)} 分钟后再试` },
      { status: 429 },
    );
  }

  // 同一链接已经投过（待审或已采纳）就不重复入库
  const dup = get<{ id: number }>(
    "SELECT id FROM submissions WHERE url = ? AND status IN ('pending','accepted') LIMIT 1",
    url,
  );
  if (dup) {
    return NextResponse.json({ ok: true, duplicated: true, message: "这条已经投过了，正在排审" });
  }

  const category = categorySlug
    ? get<{ id: number; slug: string }>("SELECT id, slug FROM categories WHERE slug = ?", categorySlug)
    : null;

  run(
    `INSERT INTO submissions (title, url, category_slug, provider, note, contact, status, created_at)
     VALUES (?,?,?,?,?,?, 'pending', unixepoch())`,
    title,
    url,
    category?.slug ?? null,
    provider,
    note || null,
    contact || null,
  );

  return NextResponse.json({ ok: true, duplicated: false });
}
