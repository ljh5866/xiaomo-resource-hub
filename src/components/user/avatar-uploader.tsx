"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/user/avatar";
import { removeAvatar } from "@/lib/user/actions";

export function AvatarUploader({
  name,
  src,
}: {
  name: string | null;
  src: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(src);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [removing, startRemove] = useTransition();

  function pick() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    start(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/avatar", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "上传失败");
        return;
      }
      setPreview(json.url ?? null);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar name={name} src={preview} size="lg" />
        {pending && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-canvas/70">
            <Loader2 className="size-5 animate-spin text-muted" strokeWidth={1.5} aria-hidden />
          </span>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={pick}
            disabled={pending}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink transition-colors hover:border-line-strong disabled:opacity-60"
          >
            <Camera className="size-3.5" strokeWidth={1.5} aria-hidden />
            更换头像
          </button>

          {preview && (
            <button
              type="button"
              disabled={removing}
              onClick={() =>
                startRemove(async () => {
                  await removeAvatar();
                  setPreview(null);
                  router.refresh();
                })
              }
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-2 text-[13px] text-dim transition-colors hover:text-danger disabled:opacity-60"
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden />
              移除
            </button>
          )}
        </div>

        <p className="mt-1.5 text-[11px] text-dim">JPG / PNG，4MB 以内，自动裁成圆形</p>
        {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
