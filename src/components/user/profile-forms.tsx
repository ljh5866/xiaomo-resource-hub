"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePassword, updateProfile } from "@/lib/user/actions";

const field =
  "min-h-10 w-full rounded-[10px] border border-line bg-surface-2 px-3 text-[14px] text-ink outline-none transition-colors focus:border-accent";

export function ProfileForms({
  name,
  hasPassword,
}: {
  name: string;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [nameValue, setNameValue] = useState(name);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [changing, startChange] = useTransition();

  return (
    <div className="space-y-6">
      {/* 昵称 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startSave(async () => {
            const res = await updateProfile({ name: nameValue });
            setNameMsg({ ok: res.ok, text: res.message });
            if (res.ok) router.refresh();
          });
        }}
        className="rounded-[14px] border border-line bg-surface p-5"
      >
        <h2 className="text-[15px] font-semibold text-ink">昵称</h2>
        <p className="mt-1 text-[12px] text-muted">显示在收藏和投稿里，最多 24 个字</p>

        <div className="mt-3 flex gap-2">
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            maxLength={24}
            className={field}
            aria-label="昵称"
          />
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 shrink-0 cursor-pointer rounded-[10px] bg-ink px-4 text-[13px] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>

        {nameMsg && (
          <p className={`mt-2 text-[12px] ${nameMsg.ok ? "text-ok" : "text-danger"}`}>{nameMsg.text}</p>
        )}
      </form>

      {/* 密码 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startChange(async () => {
            const res = await changePassword({
              oldPassword: String(fd.get("oldPassword") ?? ""),
              newPassword: String(fd.get("newPassword") ?? ""),
              confirm: String(fd.get("confirm") ?? ""),
            });
            setPwdMsg({ ok: res.ok, text: res.message });
            if (res.ok) setTimeout(() => router.push("/login?changed=1"), 800);
          });
        }}
        className="rounded-[14px] border border-line bg-surface p-5"
      >
        <h2 className="text-[15px] font-semibold text-ink">
          {hasPassword ? "修改密码" : "设置密码"}
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          {hasPassword
            ? "改完会退出其它设备上的登录"
            : "你的账号还没有密码（验证码注册或从旧站迁来），设置后可以用密码登录"}
        </p>

        <div className="mt-3 space-y-2.5">
          {hasPassword && (
            <input
              type="password"
              name="oldPassword"
              placeholder="当前密码"
              autoComplete="current-password"
              className={field}
            />
          )}
          <input
            type="password"
            name="newPassword"
            required
            minLength={8}
            placeholder="新密码（至少 8 位，含字母和数字）"
            autoComplete="new-password"
            className={field}
          />
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            placeholder="再输一次"
            autoComplete="new-password"
            className={field}
          />
        </div>

        {pwdMsg && (
          <p className={`mt-2 text-[12px] ${pwdMsg.ok ? "text-ok" : "text-danger"}`}>{pwdMsg.text}</p>
        )}

        <button
          type="submit"
          disabled={changing}
          className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-[10px] bg-accent px-4 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          {changing ? "提交中…" : hasPassword ? "更新密码" : "设置密码"}
        </button>
      </form>
    </div>
  );
}
