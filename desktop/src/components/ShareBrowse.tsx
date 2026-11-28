"use client";

import { useEffect, useRef, useState } from "react";
import {
  fmtSize,
  getConns,
  onDownloadProgress,
  quarkDirect,
  quarkDownload,
  resolveQuarkShare,
  setConns,
  type PanFile,
  type ShareListing,
} from "../lib/quark";

/**
 * 详情页里的「站内解析」：列出分享里的文件，支持转存 + 下载到本机。
 * 所有请求由本机 Rust 发出，cookie 不出这台电脑。
 */
type RowState = {
  phase: "idle" | "queue" | "link" | "down";
  got: number;
  total: number;
  chunks?: number;
  doneParts?: number;
  done?: string;
  err?: string;
};

export function ShareBrowse({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [listing, setListing] = useState<ShareListing | null>(null);
  const [shareId, setShareId] = useState("");
  const [stoken, setStoken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [conns, setConnsState] = useState(16);
  const unRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setConnsState(getConns());
  }, []);

  useEffect(() => {
    void onDownloadProgress((p) => {
      setRows((prev) => {
        const next: Record<string, RowState> = {};
        for (const [k, v] of Object.entries(prev)) {
          next[k] =
            v.phase === "down"
              ? { ...v, got: p.got, total: p.total || v.total, chunks: p.chunks, doneParts: p.done }
              : v;
        }
        return next;
      });
    }).then((un) => {
      unRef.current = un;
    });
    return () => {
      unRef.current?.();
    };
  }, []);

  const setRow = (fid: string, patch: Partial<RowState>) =>
    setRows((p) => ({ ...p, [fid]: { ...(p[fid] ?? { phase: "idle", got: 0, total: 0 }), ...patch } }));

  const run = async () => {
    setState("loading");
    setError(null);
    try {
      const r = await resolveQuarkShare(url);
      setListing(r.listing);
      setShareId(r.shareId);
      setStoken(r.stoken);
      setState("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("err");
    }
  };

  const download = async (f: PanFile) => {
    setRow(f.fid, { phase: "queue", got: 0, total: f.size, err: undefined });
    try {
      setRow(f.fid, { phase: "link" });
      // Rust 直连：转存 → 轮询 → 取直链（cookie 来自 WebView2 的 cookie store，含 httpOnly）
      const d = await quarkDirect(shareId, stoken, f);

      setRow(f.fid, { phase: "down", total: d.size || f.size });
      const path = await quarkDownload(d.url, d.file_name || f.name);

      // 下载完清理转存到用户网盘的那份
      setRow(f.fid, { phase: "idle", done: path });
    } catch (e) {
      setRow(f.fid, {
        phase: "idle",
        err: e instanceof Error ? e.message : typeof e === "string" ? e : "下载失败",
      });
    }
  };

  if (state === "idle") {
    return (
      <button className="btn btn-ghost share-toggle" onClick={() => void run()}>
        站内解析（本机）
      </button>
    );
  }

  if (state === "loading") return <p className="pan-hint">正在读取分享目录…</p>;

  if (state === "err") {
    return (
      <div className="share-box">
        <p className="form-err">解析失败：{error}</p>
        <button className="btn btn-ghost" onClick={() => void run()}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="share-box">
      {listing?.title && <div className="share-title">{listing.title}</div>}
      <div className="share-meta">
        <span>共 {listing?.total ?? 0} 项</span>
        <label className="conns">
          连接数
          <select
            value={String(conns)}
            onChange={(e) => {
              const n = Number(e.target.value);
              setConns(n);
              setConnsState(n);
            }}
          >
            {[4, 8, 16, 32, 64].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="file-list">
        {(listing?.files ?? []).map((f) => {
          const r = rows[f.fid];
          const pct = r && r.total > 0 ? Math.min(100, Math.round((r.got / r.total) * 100)) : 0;
          return (
            <li key={f.fid} className="file-row">
              <span className="file-icon">{f.is_dir ? "▸" : "·"}</span>
              <span className="file-name" title={f.name}>
                {f.name}
              </span>
              <span className="file-size">{f.is_dir ? "" : fmtSize(f.size)}</span>

              {r?.done ? (
                <span className="file-done" title={r.done}>
                  已保存
                </span>
              ) : r && r.phase !== "idle" ? (
                <span className="file-prog">
                  {r.phase === "queue" && "转存中…"}
                  {r.phase === "link" && "取链中…"}
                  {r.phase === "down" &&
                    `${pct}%${r.chunks ? ` · ${r.doneParts ?? 0}/${r.chunks} 片` : ""}`}
                </span>
              ) : f.is_dir ? null : (
                <button className="btn file-btn" onClick={() => void download(f)}>
                  下载
                </button>
              )}

              {r?.err && <span className="file-err">{r.err}</span>}
            </li>
          );
        })}
      </ul>
      {listing?.files?.length === 0 && <p className="pan-hint">这个分享是空的</p>}
    </div>
  );
}
