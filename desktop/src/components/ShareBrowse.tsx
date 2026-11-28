"use client";

import { useState } from "react";
import { fmtSize, resolveQuarkShare, type ShareListing } from "../lib/quark";

/**
 * 详情页里的「站内解析」：点一下列出这个夸克分享里的文件。
 * 请求由本机 Rust 发，cookie 不出这台电脑。
 */
export function ShareBrowse({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [listing, setListing] = useState<ShareListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setState("loading");
    setError(null);
    try {
      const r = await resolveQuarkShare(url);
      setListing(r.listing);
      setState("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("err");
    }
  };

  if (state === "idle") {
    return (
      <button className="btn btn-ghost share-toggle" onClick={() => void run()}>
        站内解析（本机）
      </button>
    );
  }

  if (state === "loading") {
    return <p className="pan-hint">正在读取分享目录…</p>;
  }

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
        共 {listing?.total ?? 0} 项
        {listing?.cookie_names?.length ? (
          <span className="share-cookies">
            {" "}
            · 本机 cookie：{listing.cookie_names.join(", ")}
          </span>
        ) : null}
      </div>
      <ul className="file-list">
        {(listing?.files ?? []).map((f) => (
          <li key={f.fid} className="file-row">
            <span className="file-icon">{f.is_dir ? "▸" : "·"}</span>
            <span className="file-name">{f.name}</span>
            <span className="file-size">{f.is_dir ? "" : fmtSize(f.size)}</span>
          </li>
        ))}
      </ul>
      {listing?.files?.length === 0 && <p className="pan-hint">这个分享是空的</p>}
    </div>
  );
}
