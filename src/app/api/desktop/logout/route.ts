export const runtime = "nodejs";

/**
 * POST /api/desktop/logout
 *
 * 令牌是无状态的，服务端不需要做什么：客户端丢掉即可。
 * 真要吊销全部设备请改密码（会 bump token_version）。
 */
export async function POST() {
  return Response.json({ ok: true });
}
