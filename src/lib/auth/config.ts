import type { NextAuthConfig } from "next-auth";

/**
 * 边缘安全的基础配置：middleware 只用这一份（不碰数据库）。
 * Credentials provider 放在 src/lib/auth/index.ts，只在 Node 运行时加载。
 */
const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role ?? "user";
        token.ver = (user as { tokenVersion?: number }).tokenVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.uid ?? "");
        const u = session.user as { role?: string; ver?: number };
        u.role = String(token.role ?? "user");
        u.ver = Number(token.ver ?? 0);
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

export default authConfig;
