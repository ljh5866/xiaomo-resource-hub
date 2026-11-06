import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { pollQrLogin } from "@/lib/pan/qr";
import { saveCredential } from "@/lib/pan/credentials";

/**
 * POST /api/pan/qr/poll { sessionId }
 *
 * 前端每 2 秒调一次：waiting → scanned → ok。
 * 拿到 ok 时把 Cookie 加密落库（与手动粘贴走同一张表）。
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let sessionId = "";
  try {
    const body = (await req.json()) as { sessionId?: string };
    sessionId = String(body.sessionId ?? "");
  } catch {
    return Response.json({ error: "请求格式不对" }, { status: 400 });
  }
  if (!sessionId) return Response.json({ error: "缺少 sessionId" }, { status: 400 });

  const result = await pollQrLogin(sessionId);

  if (result.state === "ok") {
    saveCredential(user.id, "quark", result.cookie, result.nickname);
    revalidatePath("/me/pan");
    revalidatePath("/me");
    return Response.json({ ok: true, state: "ok", nickname: result.nickname });
  }

  return Response.json({ ok: result.state !== "error", ...result });
}
