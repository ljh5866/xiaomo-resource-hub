"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FolderOpen,
  FileText,
  Loader2,
  TriangleAlert,
  UserRound,
} from "lucide-react";

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
 * 解析面板：进页面自动解析当前链接 → 目录树 → 点文件走服务端代理下载。
 *
 * 为什么不把直链给浏览器：夸克直链绑定账号 Cookie，浏览器直接打开是 412。
 * 所以下载链接指向 /api/pan/download，由服务器带 Cookie 拉流再转给用户。
 */
export function ParsePanel({
  linkId,
  provider,
  providerName,
  resourceTitle,
  shareUrl,
  hasCredential,
  credentialSource,
}: {
  linkId: number;
  provider: string;
  providerName: string;
  resourceTitle: string;
  shareUrl: string;
  hasCredential: boolean;
  credentialSource: "user" | "none";
}) {
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busyFid, setBusyFid] = useState<string | null>(null);
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
    void load(dir.fid);
  }

  function goCrumb(index: number) {
    const next = crumbs.slice(0, index);
    setCrumbs(next);
    void load(next.length ? next[next.length - 1].fid : "0");
  }

  /** 当前目录的 fid：下载时要靠它在新 stoken 下重新取配套的文件 token */
  function currentDir(): string {
    return crumbs.length ? crumbs[crumbs.length - 1].fid : "0";
  }

  function downloadHref(f: PanFile): string {
    const qs = new URLSearchParams({
      linkId: String(linkId),
      fid: f.fid,
      name: f.name,
      size: String(f.size),
      pdir: currentDir(),
    });
    if (f.token) qs.set("token", f.token);
    return `/api/pan/download?${qs.toString()}`;
  }

  /**
   * 绑定自己账号的用户走「直链直出」：服务器只发一个 URL，流量走用户自己的带宽。
   * 浏览器没登录同一个夸克账号时会 412，所以旁边保留「经服务器」这条稳的路。
   */
  async function directDownload(f: PanFile) {
    setBusyFid(f.fid);
    setError(null);
    try {
      const res = await fetch("/api/pan/direct", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          linkId,
          fid: f.fid,
          name: f.name,
          size: f.size,
          token: f.token ?? null,
          pdirFid: currentDir(),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        direct?: { url: string };
        error?: string;
        code?: string;
      };
      if (!res.ok || !json.ok || !json.direct) {
        setError({ message: json.error ?? "取直链失败", code: json.code });
        return;
      }
      const a = document.createElement("a");
      a.href = json.direct.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
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
        <span className="ml-auto inline-flex items-center gap-1.5">
          {credentialSource === "user" ? (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-ok/10 px-1.5 py-0.5 text-[11px] text-ok">
              <UserRound className="size-3" strokeWidth={2} aria-hidden />
              用你自己的账号
            </span>
          ) : null}
          {!hasCredential && (
            <span className="inline-flex items-center gap-1 text-danger">
              <TriangleAlert className="size-3.5" strokeWidth={2} aria-hidden />
              没有 {providerName} 凭证，只能看列表
            </span>
          )}
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-1 py-10 text-[13px] text-muted">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />
          正在向 {providerName} 请求文件列表…（跨境链路较慢，通常 5–15 秒）
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
              <button type="button" onClick={() => goCrumb(0)} className="cursor-pointer hover:text-accent">
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
              const href = downloadHref(f);
              const ownAccount = credentialSource === "user";
              return (
                <li key={f.fid} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <FileText className="size-4 shrink-0 text-dim" strokeWidth={1.5} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{f.name}</span>
                  <span className="font-mono text-[11px] text-dim">{fmtBytes(f.size)}</span>

                  {!hasCredential ? (
                    <a
                      href="/me/pan"
                      className="inline-flex min-h-8 items-center rounded-[6px] border border-line px-3 text-[12px] text-accent hover:border-accent"
                    >
                      去绑定网盘
                    </a>
                  ) : ownAccount ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void directDownload(f)}
                        disabled={busyFid === f.fid}
                        className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[6px] bg-accent px-3 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60"
                        title="用你自己的夸克账号取链，浏览器直接下载，走你的带宽"
                      >
                        {busyFid === f.fid ? (
                          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden />
                        ) : (
                          <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
                        )}
                        下载
                      </button>
                      <a
                        href={href}
                        className="inline-flex min-h-8 items-center rounded-[6px] border border-line px-2 text-[11px] text-muted hover:border-accent hover:text-accent"
                        title="经本站服务器中转，速度受服务器带宽限制"
                      >
                        经服务器
                      </a>
                      <button
                        type="button"
                        onClick={() => void copy(new URL(href, window.location.origin).toString(), f.fid)}
                        className="inline-flex min-h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] border border-line text-muted hover:border-accent hover:text-accent"
                        title="复制下载地址（需登录后访问）"
                        aria-label="复制下载地址"
                      >
                        {copied === f.fid ? (
                          <Check className="size-3 text-ok" strokeWidth={2} aria-hidden />
                        ) : (
                          <Copy className="size-3" strokeWidth={1.5} aria-hidden />
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <a
                        href={href}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-[6px] bg-accent px-3 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
                      >
                        <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
                        下载
                      </a>
                      <button
                        type="button"
                        onClick={() => void copy(new URL(href, window.location.origin).toString(), f.fid)}
                        className="inline-flex min-h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] border border-line text-muted hover:border-accent hover:text-accent"
                        title="复制下载地址（需登录后访问）"
                        aria-label="复制下载地址"
                      >
                        {copied === f.fid ? (
                          <Check className="size-3 text-ok" strokeWidth={2} aria-hidden />
                        ) : (
                          <Copy className="size-3" strokeWidth={1.5} aria-hidden />
                        )}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-1 px-1 text-[11px] leading-relaxed text-dim">
            <p>
              下载由本站服务器中转（{providerName} 直链绑定账号，浏览器直接打开会 412），
              支持断点续传；服务器限速由部署方设定。
            </p>
            <p>取链时会把文件转存一份到站点账号，下载完成后可忽略，不长期占用空间。</p>
          </div>
        </>
      )}
    </div>
  );
}
