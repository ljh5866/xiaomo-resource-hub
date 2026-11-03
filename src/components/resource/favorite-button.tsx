"use client";

import { useEffect, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 收藏按钮：初始状态由客户端拉（GET /api/favorite?id=），
 * 这样详情页在服务端不读 cookie → 可以继续 ISR 静态化。
 */
export function FavoriteButton({ resourceId }: { resourceId: number }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    fetch(`/api/favorite?id=${resourceId}`)
      .then((r) => r.json())
      .then((j: { favorited?: boolean }) => {
        if (alive) setOn(Boolean(j.favorited));
      })
      .catch(() => alive && setOn(false));
    return () => {
      alive = false;
    };
  }, [resourceId]);

  function toggle() {
    const next = !on;
    setOn(next);

    start(async () => {
      try {
        const res = await fetch("/api/favorite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: resourceId }),
        });
        const json = (await res.json()) as { ok: boolean; favorited?: boolean };
        if (!json.ok) setOn(!next);
        else if (typeof json.favorited === "boolean") setOn(json.favorited);
      } catch {
        setOn(!next);
      }
    });
  }

  const loading = on === null;
  const Icon = on ? BookmarkCheck : Bookmark;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending || loading}
      aria-pressed={Boolean(on)}
      aria-busy={loading}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 border px-3 text-[13px] transition-colors",
        on
          ? "border-accent/50 text-accent"
          : "border-line text-muted hover:border-accent hover:text-accent",
        loading && "opacity-70",
      )}
    >
      <Icon className="size-4" strokeWidth={1.5} aria-hidden />
      {loading ? "收藏" : on ? "已收藏" : "收藏"}
    </button>
  );
}
