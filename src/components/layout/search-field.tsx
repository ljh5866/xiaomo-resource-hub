"use client";

import { ArrowRight, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

/**
 * 搜索框：提交走 /search?q=，URL 即状态（docs/03 §3.4）。
 * Esc 清空；pending 时按钮进入等待态。
 */
export function SearchField({
  placeholder = "搜索资源…",
  autoFocus = false,
}: {
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = inputRef.current?.value.trim() ?? "";
    startTransition(() => {
      router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
    });
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="relative flex h-12 w-full items-center border border-line bg-surface-2 transition-[border-color,box-shadow] duration-160 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(211,169,79,0.15)]"
    >
      <Search
        className="pointer-events-none ml-3 size-[18px] shrink-0 text-dim"
        strokeWidth={1.5}
        aria-hidden
      />
      <input
        ref={inputRef}
        name="q"
        defaultValue={params.get("q") ?? ""}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label="搜索资源"
        enterKeyHint="search"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.currentTarget.value = "";
            e.currentTarget.blur();
          }
        }}
        className="h-full w-full min-w-0 bg-transparent px-2.5 text-[15px] text-ink outline-none"
      />
      <button
        type="submit"
        aria-label="开始搜索"
        aria-busy={pending}
        className="mr-2 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center border border-transparent text-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        disabled={pending}
      >
        <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
    </form>
  );
}
