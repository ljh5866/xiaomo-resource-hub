"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, getToken, setToken, type Me } from "./api";

/**
 * 登录态。token 存 localStorage，进应用时用 /api/app/me 验一次。
 * 没有账号体系以外的副作用——收藏直接写网站那张 favorites 表，网站能看到同一份。
 */
type Ctx = {
  user: Me["user"] | null;
  favorites: Set<string>;
  loading: boolean;
  login: (email: string, secret: { password?: string; code?: string }) => Promise<void>;
  logout: () => void;
  toggleFavorite: (slug: string) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me["user"] | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setFavorites(new Set());
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me.user);
      setFavorites(new Set(me.favorites.map((f) => f.slug)));
    } catch {
      // token 失效：清掉，回到未登录
      setToken(null);
      setUser(null);
      setFavorites(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, secret: { password?: string; code?: string }) => {
      const r = await authApi.login(email, secret);
      setToken(r.token);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setFavorites(new Set());
  }, []);

  const toggleFavorite = useCallback(
    async (slug: string) => {
      const on = !favorites.has(slug);
      const r = await authApi.favorite(slug, on);
      setFavorites((prev) => {
        const next = new Set(prev);
        if (r.favorited) next.add(slug);
        else next.delete(slug);
        return next;
      });
      return r.favorited;
    },
    [favorites],
  );

  const value = useMemo(
    () => ({ user, favorites, loading, login, logout, toggleFavorite, refresh }),
    [user, favorites, loading, login, logout, toggleFavorite, refresh],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
