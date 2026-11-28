"use client";

import { useEffect, useRef, useState } from "react";
import {
  fmtSize,
  onDownloadProgress,
  panWebDirect,
  quarkDownload,
  resolveQuarkShare,
  waitPanDirect,
  type PanFile,
  type ShareListing,
} from "../lib/quark";
import { panWindowAlive, reopenPanWindow } from "../lib/pan";

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
  const unRef = useRef<(() => void) | null>(null);

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
      // 转存/取链必须在网盘页面里做（httpOnly cookie 拿不出来）
      if (!(await panWindowAlive())) {
        await reopenPanWindow("quark");
        setRow(f.fid, {
          phase: "idle",
          err: "需要网盘窗口保持打开 —— 已帮你重新打开，登录后再点下载",
        });
        return;
      }

      setRow(f.fid, { phase: "link" });
      await panWebDirect(shareId, stoken, f);

      const d = await waitPanDirect(75_000);
      if (!d) {
        setRow(f.fid, { phase: "idle", err: "没等到夸克返回直链（看网盘窗口左下角的红字）" });
        return;
      }

      setRow(f.fid, { phase: "down", total: f.size });
      const path = await quarkDownload(d.url, d.name || f.name);
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
      <div className="share-meta">共 {listing?.total ?? 0} 项</div>
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
