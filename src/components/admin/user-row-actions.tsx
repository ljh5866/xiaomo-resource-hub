"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetUserPassword, setUserRole, setUserStatus } from "@/lib/admin/users";

const btn =
  "min-h-7 cursor-pointer rounded-[4px] border border-line px-1.5 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50";

export function UserRowActions({
  id,
  role,
  status,
  email,
}: {
  id: number;
  role: string;
  status: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {status !== "banned" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setUserStatus(id, "banned"))}
          className={btn}
        >
          封禁
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setUserStatus(id, "active"))}
          className={btn}
        >
          解封
        </button>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setUserRole(id, role === "admin" ? "user" : "admin"))}
        className={btn}
      >
        {role === "admin" ? "降为用户" : "设为管理员"}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const pwd = window.prompt(`给 ${email} 设置新密码（至少 8 位，含字母数字）`);
          if (pwd) run(() => resetUserPassword(id, pwd));
        }}
        className={btn}
      >
        重置密码
      </button>

      {msg && <span className="text-[11px] text-dim">{msg}</span>}
    </div>
  );
}
