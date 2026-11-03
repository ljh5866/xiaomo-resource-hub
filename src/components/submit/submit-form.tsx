"use client";

import { useState, useTransition } from "react";
import { PROVIDERS } from "@/lib/constants";
const inputCls =
  "min-h-11 w-full border border-line bg-surface-2 px-3 text-[14px] text-ink outline-none transition-colors focus:border-accent";

/** 投稿表单：不需要登录，提交后进后台待审队列 */
export function SubmitForm({
  categories,
}: {
  categories: { slug: string; name: string }[];
}) {
  const [form, setForm] = useState({
    title: "",
    url: "",
    categorySlug: categories[0]?.slug ?? "",
    provider: "quark",
    note: "",
    contact: "",
  });
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const json = (await res.json()) as { ok: boolean; message?: string; duplicated?: boolean };
        if (!json.ok) {
          setState("error");
          setMessage(json.message ?? "提交失败");
          return;
        }
        setState("ok");
        setMessage(json.message ?? "已提交，审核通过后会出现在站内。");
        if (!json.duplicated) {
          setForm((f) => ({ ...f, title: "", url: "", note: "" }));
        }
      } catch {
        setState("error");
        setMessage("网络异常，稍后再试");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1 block text-[12px] text-muted">资源名称 *</span>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
          minLength={2}
          maxLength={120}
          placeholder="例如：Excel 数据看板模板合集"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] text-muted">分享链接 *</span>
        <input
          value={form.url}
          onChange={(e) => set("url", e.target.value)}
          required
          type="url"
          placeholder="https://pan.quark.cn/s/xxxx"
          className={inputCls}
        />
        <span className="mt-1 block text-[11px] text-dim">
          公开可直接访问的链接；提取码写在备注里即可。
        </span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">分类</span>
          <select
            value={form.categorySlug}
            onChange={(e) => set("categorySlug", e.target.value)}
            className={inputCls}
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">网盘</span>
          <select
            value={form.provider}
            onChange={(e) => set("provider", e.target.value)}
            className={inputCls}
          >
            {Object.entries(PROVIDERS).map(([key, p]) => (
              <option key={key} value={key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[12px] text-muted">备注（提取码、版本、适用范围）</span>
        <textarea
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          rows={3}
          maxLength={400}
          placeholder="提取码 m801；Windows 版，含公式说明"
          className="w-full border border-line bg-surface-2 px-3 py-2 text-[14px] leading-relaxed text-ink outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] text-muted">联系方式（可选）</span>
        <input
          value={form.contact}
          onChange={(e) => set("contact", e.target.value)}
          maxLength={120}
          placeholder="邮箱或 TG，采纳后通知你"
          className={inputCls}
        />
      </label>

      {message && (
        <p
          className={
            "border px-3 py-2 text-[12px] " +
            (state === "ok"
              ? "border-ok/40 bg-ok/5 text-ok"
              : "border-danger/40 bg-danger/5 text-danger")
          }
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-accent bg-accent px-6 text-[14px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "提交中…" : "提交"}
      </button>

      <p className="text-[11px] leading-relaxed text-dim">
        只收录公开可访问的分享链接；请勿提交侵权或含恶意程序的资源。
      </p>
    </form>
  );
}
