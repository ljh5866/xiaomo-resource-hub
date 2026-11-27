/**
 * 桌面端跨域支持。
 *
 * 桌面端页面 origin 是 tauri://localhost（开发时是 127.0.0.1:随机端口），
 * 调 https://ttals.com/api/app/* 必然跨域：
 *   · 简单请求要 Access-Control-Allow-Origin
 *   · POST + Authorization 会触发预检（OPTIONS），必须回 2xx 且带 Allow-Headers
 *
 * 只开放 READ + 账号相关的几个接口，写接口都在这里显式列出。
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Max-Age": "86400",
};

/** 预检响应：204 + CORS 头 */
export function corsOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** 给普通响应补 CORS 头（headers() 配置在某些部署下可能被覆盖，这里再兜一层） */
export function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}
