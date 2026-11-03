"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/** 客户端会话上下文：让 Header 的登录态不再强制整站动态渲染 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
