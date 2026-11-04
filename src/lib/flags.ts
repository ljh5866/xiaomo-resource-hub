/** 站点开关（放在普通模块里，因为 "use server" 文件只能导出 async 函数） */

/** 是否开放公开注册：默认开，管理端可用 ALLOW_REGISTRATION=false 关掉 */
export function registrationOpen(): boolean {
  return process.env.ALLOW_REGISTRATION !== "false";
}

/** 后台路径（可通过 ADMIN_PATH 改成只有自己知道的地址） */
export function adminPath(): string {
  return (process.env.ADMIN_PATH ?? "admin").replace(/^\/+|\/+$/g, "");
}
