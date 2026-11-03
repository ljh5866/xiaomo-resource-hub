"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveResource } from "@/lib/admin/actions";
import { LINK_PROVIDERS } from "@/lib/admin/schema";
import { KINDS, LANGUAGES, LICENSE, PLATFORMS, providerOf } from "@/lib/constants";
import { sniffExtractCode } from "@/lib/extract-code";
import { cn } from "@/lib/utils";

type Category = { id: number; slug: string; name: string };

type LinkDraft = {
  provider: string;
  url: string;
  extractCode: string;
  label: string;
  isPrimary: boolean;
};

export type ResourceFormValues = {
  id?: number;
  title: string;
  slug: string;
  subtitle: string;
  summary: string;
  contentMd: string;
  categoryId: number | "";
  kind: string;
  platforms: string[];
  version: string;
  sizeLabel: string;
  language: string;
  licenseLabel: string;
  sourceUrl: string;
  sourceNote: string;
  coverUrl: string;
  coverBlur: string;
  status: string;
  isFeatured: boolean;
  seoTitle: string;
  seoDesc: string;
  tags: string;
  links: LinkDraft[];
};

const EMPTY: ResourceFormValues = {
  title: "",
  slug: "",
  subtitle: "",
  summary: "",
  contentMd: "",
  categoryId: "",
  kind: "software",
  platforms: [],
  version: "",
  sizeLabel: "",
  language: "zh-CN",
  licenseLabel: "free",
  sourceUrl: "",
  sourceNote: "",
  coverUrl: "",
  coverBlur: "",
  status: "draft",
  isFeatured: false,
  seoTitle: "",
  seoDesc: "",
  tags: "",
  links: [{ provider: "quark", url: "", extractCode: "", label: "主链接", isPrimary: true }],
};

export function ResourceForm({
  categories,
  initial,
}: {
  categories: Category[];
  initial?: ResourceFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<ResourceFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as {
        ok: boolean;
        message?: string;
        url?: string;
        blur?: string;
      };
      if (!json.ok || !json.url) throw new Error(json.message ?? "上传失败");
      setV((p) => ({ ...p, coverUrl: json.url!, coverBlur: json.blur ?? "" }));
    } catch (err) {
      setUploadMsg((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const set = <K extends keyof ResourceFormValues>(k: K, val: ResourceFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const setLink = (i: number, patch: Partial<LinkDraft>) =>
    setV((prev) => ({
      ...prev,
      links: prev.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));

  function onUrlBlur(i: number) {
    const url = v.links[i].url;
    if (!url) return;
    const sniffed = sniffExtractCode(url);
    if (sniffed && !v.links[i].extractCode) setLink(i, { extractCode: sniffed });
    if (!v.slug && v.title) {
      const guess = url
        .replace(/^https?:\/\//, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .slice(0, 40)
        .replace(/^-|-$/g, "");
      if (guess) set("slug", guess.toLowerCase());
    }
  }

  function submit() {
    setErrors({});
    setMessage(null);

    start(async () => {
      const payload = {
        title: v.title.trim(),
        slug: v.slug.trim(),
        subtitle: v.subtitle.trim() || null,
        summary: v.summary.trim() || null,
        contentMd: v.contentMd.trim() || null,
        categoryId: v.categoryId === "" ? 0 : Number(v.categoryId),
        kind: v.kind,
        platforms: v.platforms,
        version: v.version.trim() || null,
        sizeLabel: v.sizeLabel.trim() || null,
        language: v.language,
        licenseLabel: v.licenseLabel,
        sourceUrl: v.sourceUrl.trim() || null,
        sourceNote: v.sourceNote.trim() || null,
        coverUrl: v.coverUrl || null,
        coverBlur: v.coverBlur || null,
        status: v.status,
        isFeatured: v.isFeatured,
        seoTitle: v.seoTitle.trim() || null,
        seoDesc: v.seoDesc.trim() || null,
        tags: v.tags
          .split(/[,，\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
        links: v.links
          .filter((l) => l.url.trim())
          .map((l) => ({
            provider: l.provider,
            url: l.url.trim(),
            extractCode: l.extractCode.trim() || null,
            label: l.label.trim() || null,
            isPrimary: l.isPrimary,
          })),
      };

      const res = await saveResource(payload, initial?.id);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage(res.message);
        return;
      }
      setMessage(res.message);
      router.push("/admin/resources");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="border border-danger/40 bg-danger/5 px-4 py-2.5 text-[13px] text-danger">
          {message}
        </div>
      )}

      <Card title="基本信息">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="标题" required error={errors.title}>
            <input
              value={v.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Excel 数据看板模板合集"
              className={inputCls}
            />
          </Field>

          <Field label="slug（URL）" required error={errors.slug} hint="小写字母数字连字符">
            <input
              value={v.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="excel-dashboard-pack"
              className={cn(inputCls, "font-mono")}
            />
          </Field>

          <Field label="副标题" className="md:col-span-2">
            <input
              value={v.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
              placeholder="12 套可直接套用的经营分析看板，含公式说明"
              className={inputCls}
            />
          </Field>

          <Field label="摘要（列表与 SEO 用）" className="md:col-span-2" hint="≤120 字">
            <textarea
              value={v.summary}
              onChange={(e) => set("summary", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>

          <Field label="说明正文（Markdown）" className="md:col-span-2" hint="≥150 字，空行分段">
            <textarea
              value={v.contentMd}
              onChange={(e) => set("contentMd", e.target.value)}
              rows={7}
              className={cn(inputCls, "leading-relaxed")}
            />
          </Field>
        </div>
      </Card>

      <Card title="分类与属性">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="分类" required error={errors.categoryId}>
            <select
              value={v.categoryId}
              onChange={(e) => set("categoryId", e.target.value === "" ? "" : Number(e.target.value))}
              className={inputCls}
            >
              <option value="">请选择</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="类型">
            <select value={v.kind} onChange={(e) => set("kind", e.target.value)} className={inputCls}>
              {Object.entries(KINDS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="授权">
            <select
              value={v.licenseLabel}
              onChange={(e) => set("licenseLabel", e.target.value)}
              className={inputCls}
            >
              {Object.entries(LICENSE).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="平台" className="md:col-span-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(PLATFORMS).map(([k, label]) => {
                const on = v.platforms.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      set(
                        "platforms",
                        on ? v.platforms.filter((p) => p !== k) : [...v.platforms, k],
                      )
                    }
                    aria-pressed={on}
                    className={cn(
                      "min-h-9 cursor-pointer border px-3 text-[13px] transition-colors",
                      on
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-line text-muted hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="版本">
            <input value={v.version} onChange={(e) => set("version", e.target.value)} className={cn(inputCls, "font-mono")} placeholder="v3.2" />
          </Field>
          <Field label="大小">
            <input value={v.sizeLabel} onChange={(e) => set("sizeLabel", e.target.value)} className={cn(inputCls, "font-mono")} placeholder="1.2 GB" />
          </Field>
          <Field label="语言">
            <select value={v.language} onChange={(e) => set("language", e.target.value)} className={inputCls}>
              {Object.entries(LANGUAGES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card title="下载链接" note="至少一条；链接全站唯一，重复会被拒绝">
        <div className="space-y-3">
          {v.links.map((l, i) => (
            <div key={i} className="border border-line bg-canvas p-3">
              <div className="grid gap-3 md:grid-cols-[160px_1fr_120px_28px]">
                <select
                  value={l.provider}
                  onChange={(e) => setLink(i, { provider: e.target.value })}
                  className={inputCls}
                >
                  {LINK_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {providerOf(p).name}
                    </option>
                  ))}
                </select>
                <input
                  value={l.url}
                  onChange={(e) => setLink(i, { url: e.target.value })}
                  onBlur={() => onUrlBlur(i)}
                  placeholder="https://pan.quark.cn/s/xxxx"
                  className={cn(inputCls, "font-mono text-[12px]")}
                />
                <input
                  value={l.extractCode}
                  onChange={(e) => setLink(i, { extractCode: e.target.value })}
                  placeholder="提取码"
                  className={cn(inputCls, "font-mono")}
                />
                <button
                  type="button"
                  onClick={() =>
                    set("links", v.links.length > 1 ? v.links.filter((_, idx) => idx !== i) : v.links)
                  }
                  aria-label="删除这条链接"
                  className="grid size-11 cursor-pointer place-items-center border border-line text-dim transition-colors hover:border-danger hover:text-danger"
                >
                  <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  value={l.label}
                  onChange={(e) => setLink(i, { label: e.target.value })}
                  placeholder="标注，如「主链接」「Windows 版」"
                  className={cn(inputCls, "h-9 max-w-56 text-[12px]")}
                />
                <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <input
                    type="radio"
                    name="primary"
                    checked={l.isPrimary}
                    onChange={() =>
                      set(
                        "links",
                        v.links.map((x, idx) => ({ ...x, isPrimary: idx === i })),
                      )
                    }
                  />
                  设为主链接
                </label>
                {errors[`links.${i}.url`] && (
                  <span className="text-[12px] text-danger">{errors[`links.${i}.url`]}</span>
                )}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              set("links", [
                ...v.links,
                { provider: "baidu", url: "", extractCode: "", label: "备用", isPrimary: false },
              ])
            }
          >
            <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
            加一条链接
          </Button>
          {errors.links && <p className="text-[12px] text-danger">{errors.links}</p>}
        </div>
      </Card>

      <Card title="封面" note="16:10 建议 800×500；上传后自动转 WebP 并生成 LQIP">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative aspect-[16/10] w-full max-w-xs shrink-0 overflow-hidden border border-line bg-surface-2">
            {v.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={v.coverUrl}
                alt="封面预览"
                className="size-full object-cover"
                style={v.coverBlur ? { backgroundImage: `url(${v.coverBlur})`, backgroundSize: "cover" } : undefined}
              />
            ) : (
              <div className="grid size-full place-items-center text-[12px] text-dim">
                还没有封面
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center border border-line px-3 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent">
              {uploading ? "上传中…" : "选择图片"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => upload(e.target.files?.[0])}
                disabled={uploading}
              />
            </label>
            {v.coverUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setV((p) => ({ ...p, coverUrl: "", coverBlur: "" }))}
              >
                移除封面
              </Button>
            )}
            {uploadMsg && <p className="text-[12px] text-danger">{uploadMsg}</p>}
            <p className="max-w-xs text-[11px] leading-relaxed text-dim">
              留空则前台用「目录卡」纹理占位（按编号），不影响排版。
            </p>
          </div>
        </div>
      </Card>

      <Card title="标签与来源">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="标签" hint="逗号或空格分隔">
            <input
              value={v.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="Excel, 模板, 报告"
              className={inputCls}
            />
          </Field>
          <Field label="来源页 URL" hint="台账用">
            <input
              value={v.sourceUrl}
              onChange={(e) => set("sourceUrl", e.target.value)}
              placeholder="https://…"
              className={cn(inputCls, "font-mono text-[12px]")}
            />
          </Field>
          <Field label="来源说明" className="md:col-span-2">
            <input
              value={v.sourceNote}
              onChange={(e) => set("sourceNote", e.target.value)}
              placeholder="公开发布页面 / 作者授权 / 记录日期"
              className={inputCls}
            />
          </Field>
        </div>
      </Card>

      <Card title="发布与 SEO">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="状态">
            <select value={v.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
          </Field>
          <Field label="精选">
            <label className="inline-flex min-h-11 items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={v.isFeatured}
                onChange={(e) => set("isFeatured", e.target.checked)}
              />
              放到首页「本周精选」
            </label>
          </Field>
          <Field label="SEO 标题" className="md:col-span-1">
            <input value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className={inputCls} />
          </Field>
          <Field label="SEO 描述" className="md:col-span-3">
            <textarea
              value={v.seoDesc}
              onChange={(e) => set("seoDesc", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-canvas/95 py-3 backdrop-blur">
        <Button variant="primary" size="lg" onClick={submit} disabled={pending}>
          {pending ? "保存中…" : initial?.id ? "保存修改" : "创建资源"}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => router.push("/admin/resources")}>
          取消
        </Button>
        <span className="ml-auto font-mono text-[11px] text-dim">
          {v.links.filter((l) => l.url).length} 条链接
        </span>
      </div>
    </div>
  );
}

const inputCls =
  "min-h-11 w-full border border-line bg-surface-2 px-3 text-[14px] text-ink outline-none transition-colors focus:border-accent";

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-serif text-[15px] font-semibold text-ink">{title}</h2>
        {note && <p className="mt-0.5 text-[11px] text-dim">{note}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  required,
  error,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-[12px] text-muted">{label}</span>
        {required && <span className="text-[11px] text-danger">*</span>}
        {hint && <span className="text-[11px] text-dim">· {hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
