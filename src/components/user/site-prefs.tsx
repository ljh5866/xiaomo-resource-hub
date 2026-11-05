"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, Type } from "lucide-react";

type Theme = "light" | "dark" | "system";
type Font = "normal" | "large";

const THEME_KEY = "xm-theme";
const FONT_KEY = "xm-font";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

function applyFont(font: Font) {
  document.documentElement.dataset.font = font;
}

/** 站点偏好：主题与字号，存在浏览器本地，不落库 */
export function SitePrefs() {
  const [theme, setTheme] = useState<Theme>("light");
  const [font, setFont] = useState<Font>("normal");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "light";
    const savedFont = (localStorage.getItem(FONT_KEY) as Font | null) ?? "normal";
    setTheme(savedTheme);
    setFont(savedFont);
    setReady(true);
  }, []);

  function pickTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  function pickFont(next: Font) {
    setFont(next);
    localStorage.setItem(FONT_KEY, next);
    applyFont(next);
  }

  const themes: { key: Theme; label: string; icon: typeof Sun }[] = [
    { key: "light", label: "浅色", icon: Sun },
    { key: "dark", label: "深色", icon: Moon },
    { key: "system", label: "跟随系统", icon: Monitor },
  ];

  return (
    <section className="rounded-[14px] border border-line bg-surface p-5">
      <h2 className="text-[15px] font-semibold text-ink">外观</h2>
      <p className="mt-1 text-[12px] text-muted">只影响这台设备，不写进账号</p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-[12px] text-muted">主题</p>
          <div className="flex flex-wrap gap-2">
            {themes.map((t) => {
              const Icon = t.icon;
              const active = ready && theme === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pickTheme(t.key)}
                  aria-pressed={active}
                  className={
                    "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 text-[13px] transition-colors " +
                    (active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink")
                  }
                >
                  <Icon className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] text-muted">字号</p>
          <div className="flex gap-2">
            {(
              [
                ["normal", "标准"],
                ["large", "大"],
              ] as const
            ).map(([key, label]) => {
              const active = ready && font === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickFont(key)}
                  aria-pressed={active}
                  className={
                    "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 text-[13px] transition-colors " +
                    (active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink")
                  }
                >
                  <Type className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
