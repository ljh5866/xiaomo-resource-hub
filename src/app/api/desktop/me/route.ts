import { desktopUser, unauthorized } from "@/lib/desktop/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/desktop/me → 当前账号（Bearer token） */
export function GET(req: Request) {
  const user = desktopUser(req);
  if (!user) return unauthorized();
  return Response.json({ ok: true, user });
}
