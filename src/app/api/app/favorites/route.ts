import { get, run } from "@/db/client";
import { getAppUser, unauthorized } from "@/lib/app-auth";
import { corsOptions } from "@/lib/app-cors";

/**
 * POST   /api/app/favorites  { slug }  → 收藏
 * DELETE /api/app/favorites  { slug }  → 取消
 *
 * 与网站 /api/favorite 写同一张 favorites 表，所以网站和桌面端看到的是同一份数据。
 */
export async function POST(req: Request) {
  return toggle(req, true);
}

export async function DELETE(req: Request) {
  return toggle(req, false);
}

async function toggle(req: Request, on: boolean): Promise<Response> {
  const user = getAppUser(req);
  if (!user) return unauthorized();

  let slug = "";
  try {
    const body = (await req.json()) as { slug?: string };
    slug = String(body.slug ?? "").trim();
  } catch {
    return Response.json({ ok: false, error: "请求格式不对" }, { status: 400 });
  }
  if (!slug) return Response.json({ ok: false, error: "缺少 slug" }, { status: 400 });

  const res = get<{ id: number }>(
    "SELECT id FROM resources WHERE slug = ? AND status = 'published'",
    slug,
  );
  if (!res) return Response.json({ ok: false, error: "资源不存在" }, { status: 404 });

  if (on) {
    run(
      "INSERT OR IGNORE INTO favorites (user_id, resource_id, created_at) VALUES (?,?,unixepoch())",
      user.id,
      res.id,
    );
  } else {
    run("DELETE FROM favorites WHERE user_id = ? AND resource_id = ?", user.id, res.id);
  }

  const count = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?",
    user.id,
  )?.n ?? 0;

  return Response.json({ ok: true, favorited: on, count });
}

export const OPTIONS = corsOptions;
