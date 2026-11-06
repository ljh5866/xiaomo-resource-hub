"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, FolderOpen, FileText, Loader2, TriangleAlert } from "lucide-react";

type PanFile = {
  fid: string;
  name: string;
  size: number;
  isDir: boolean;
  token?: string | null;
};

type Share = {
  provider: string;
  shareId: string;
  title: string | null;
  files: PanFile[];
  total: number;
  needsLogin: boolean;
};

type Direct = { url: string; expiresIn: number | null; fileName: string; size: number };

function fmtBytes(n: number): string {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * 解析面板：进页面自动解析当前链接，列出文件；点单个文件取直链。
 * 所有请求都只带 linkId，服务端自己查库，前端构造不出别家的分享。
 */
export function ParsePanel({
  linkId,
  provider,
  providerName,
  resourceTitle,
  shareUrl,
  hasCredential,
}: {
  linkId: number;
  provider: string;
  providerName: string;
  resourceTitle: string;
  shareUrl: string;
  hasCredential: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [busyFid, setBusyFid] = useState<string | null>(null);
  const [directs, setDirects] = useState<Record<string, Direct>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<{ fid: string; name: string }[]>([]);

  const load = useCallback(
    async (pdirFid = "0") => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/pan/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ linkId, pdirFid }),
        });
        const json = (await res.json()) as { ok?: boolean; share?: Share; error?: string; code?: string };
        if (!res.ok || !json.ok) {
          setError({ message: json.error ?? "解析失败", code: json.code });
          setShare(null);
        } else {
          setShare(json.share ?? null);
        }
      } catch {
        setError({ message: "网络异常，稍后再试" });
      } finally {
        setLoading(false);
      }
    },
    [linkId],
  );

  useEffect(() => {
    void load("0");
  }, [load]);

  function openDir(dir: PanFile) {
    setCrumbs((prev) => [...prev, { fid: dir.fid, name: dir.name }]);
    setDirects({});
    void load(dir.fid);
  }

  function goCrumb(index: number) {
    const next = crumbs.slice(0, index);
    setCrumbs(next);
    setDirects({});
    void load(next.length ? next[next.length - 1].fid : "0");
  }

  async function getDirect(file: PanFile) {
    setBusyFid(file.fid);
    try {
      const res = await fetch("/api/pan/direct", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          linkId,
          fid: file.fid,
          name: file.name,
          size: file.size,
          token: file.token ?? null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; direct?: Direct; error?: string; code?: string };
      if (!res.ok || !json.ok || !json.direct) {
        setError({ message: json.error ?? "取直链失败", code: json.code });
      } else {
        setDirects((prev) => ({ ...prev, [file.fid]: json.direct as Direct }));
      }
    } catch {
      setError({ message: "网络异常，稍后再试" });
    } finally {
      setBusyFid(null);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  const dirs = share?.files.filter((f) => f.isDir) ?? [];
  const files = share?.files.filter((f) => !f.isDir) ?? [];

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-line bg-surface-2 px-3 py-2 text-[12px] text-muted">
        <span className="font-mono text-dim">来源</span>
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="max-w-full truncate text-accent hover:underline"
        >
          {shareUrl}
        </a>
        {!hasCredential && (
          <span className="ml-auto inline-flex items-center gap-1 text-danger">
            <TriangleAlert className="size-3.5" strokeWidth={2} aria-hidden />
            服务器未配置 {providerName} 登录凭证，只能看列表，取不到直链
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-1 py-10 text-[13px] text-muted">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />
          正在向 {providerName} 请求文件列表…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-[8px] border border-danger/40 bg-danger/5 px-4 py-4 text-[13px]">
          <p className="flex items-center gap-2 font-medium text-danger">
            <TriangleAlert className="size-4" strokeWidth={2} aria-hidden />
            {error.message}
          </p>
          {error.code === "need-passcode" && (
            <p className="mt-2 text-muted">这条分享需要提取码，但库里没存到，去原资源页看看是否带了码。</p>
          )}
          {error.code === "share-invalid" && (
            <p className="mt-2 text-muted">分享已失效，建议在原资源页点「举报」，小编会换链。</p>
          )}
          <button
            type="button"
            onClick={() => void load(crumbs.length ? crumbs[crumbs.length - 1].fid : "0")}
            className="mt-3 min-h-9 cursor-pointer rounded-[6px] border border-line px-3 text-[12px] text-muted hover:border-accent hover:text-accent"
          >
            重试
          </button>
        </div>
      )}

      {!loading && share && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
              <button
                type="button"
                onClick={() => goCrumb(0)}
                className="cursor-pointer hover:text-accent"
              >
                根目录
              </button>
              {crumbs.map((c, i) => (
                <span key={c.fid} className="flex items-center gap-1">
                  <span className="text-line-strong">/</span>
                  <button
                    type="button"
                    onClick={() => goCrumb(i + 1)}
                    className="max-w-[180px] cursor-pointer truncate hover:text-accent"
                  >
                    {c.name}
                  </button>
                </span>
              ))}
              <span className="text-dim">
                · 共 <span className="font-mono text-ink">{share.total}</span> 项
              </span>
            </p>
            <p className="font-mono text-[11px] text-dim">
              {share.files.length >= 100 ? "只列出前 100 项" : ""}
            </p>
          </div>

          {dirs.length > 0 && (
            <ul className="divide-y divide-line rounded-[8px] border border-line">
              {dirs.map((d) => (
                <li key={d.fid}>
                  <button
                    type="button"
                    onClick={() => openDir(d)}
                    className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-[13px] text-ink transition-colors hover:bg-surface-2"
                  >
                    <FolderOpen className="size-4 text-dim" strokeWidth={1.5} aria-hidden />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto font-mono text-[11px] text-dim">进入 ›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {files.length === 0 && dirs.length === 0 && (
            <p className="rounded-[8px] border border-line bg-surface-2 px-4 py-8 text-center text-[13px] text-muted">
              这个分享里没有文件。
            </p>
          )}

          <ul className="divide-y divide-line rounded-[8px] border border-line">
            {files.map((f) => {
              const direct = directs[f.fid];
              return (
                <li key={f.fid} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="size-4 shrink-0 text-dim" strokeWidth={1.5} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{f.name}</span>
                    <span className="font-mono text-[11px] text-dim">{fmtBytes(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => void getDirect(f)}
                      disabled={busyFid === f.fid}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[6px] bg-accent px-3 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60"
                    >
                      {busyFid === f.fid ? (
                        <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden />
                      ) : (
                        <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
                      )}
                      获取直链
                    </button>
                  </div>

                  {direct && (
                    <div className="mt-2 rounded-[6px] bg-surface-2 px-3 py-2">
                      <p className="break-all font-mono text-[11px] text-muted">{direct.url}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copy(direct.url, f.fid)}
                          className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[6px] border border-line px-2 text-[11px] text-muted hover:border-accent hover:text-accent"
                        >
                          {copied === f.fid ? (
                            <Check className="size-3 text-ok" strokeWidth={2} aria-hidden />
                          ) : (
                            <Copy className="size-3" strokeWidth={1.5} aria-hidden />
                          )}
                          {copied === f.fid ? "已复制" : "复制直链"}
                        </button>
                        <a
                          href={direct.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-[6px] border border-line px-2 text-[11px] text-muted hover:border-accent hover:text-accent"
                        >
                          浏览器打开
                          <ExternalLink className="size-3" strokeWidth={1.5} aria-hidden />
                        </a>
                        {direct.expiresIn && (
                          <span className="font-mono text-[10px] text-dim">
                            约 {Math.round(direct.expiresIn / 60)} 分钟后失效
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="px-1 text-[11px] leading-relaxed text-dim">
            直链由 {providerName} 直接签发，本站不中转文件。夸克取直链时会把文件转存一份到站点账号的网盘，
            下载完可自行忽略；直链有时效，过期请重新获取。
          </p>
        </>
      )}
    </div>
  );
}
