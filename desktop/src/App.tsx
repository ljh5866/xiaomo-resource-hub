import { useCallback, useEffect, useMemo, useState } from "react";
import { api, coverUrl, type Card, type Detail, type Taxonomy } from "./lib/api";
import { installDesktopShell } from "./lib/shell";
import { TitleBar } from "./components/TitleBar";

type View = { k: "feed" } | { k: "detail"; slug: string };

export function App() {
  const [tax, setTax] = useState<Taxonomy | null>(null);
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>({ k: "feed" });

  useEffect(() => {
    installDesktopShell();
    api.taxonomy().then(setTax).catch(() => setTax({ categories: [], tags: [] }));
  }, []);

  const tags = useMemo(
    () => (tax?.tags ?? []).filter((t) => !category || t.category === category).slice(0, 40),
    [tax, category],
  );

  return (
    <div className="shell">
      <TitleBar />
      <div className="app">
        <aside className="side">
          <div className="brand">
            <span className="brand-mark">莫</span>
            小莫资源库
          </div>
        <div className="side-scroll">
          <div className="side-group">分类</div>
          <button
            className={`side-item ${!category ? "active" : ""}`}
            onClick={() => {
              setCategory("");
              setKind("");
              setView({ k: "feed" });
            }}
          >
            全部
          </button>
          {(tax?.categories ?? []).map((c) => (
            <button
              key={c.slug}
              className={`side-item ${category === c.slug ? "active" : ""}`}
              onClick={() => {
                setCategory(c.slug);
                setKind("");
                setView({ k: "feed" });
              }}
            >
              {c.name}
              <span className="count">{c.count}</span>
            </button>
          ))}

          {tags.length > 0 && (
            <>
              <div className="side-group">标签</div>
              {tags.map((t) => (
                <button
                  key={t.slug}
                  className={`side-item ${kind === t.slug ? "active" : ""}`}
                  onClick={() => {
                    setKind(kind === t.slug ? "" : t.slug);
                    if (t.category) setCategory(t.category);
                    setView({ k: "feed" });
                  }}
                >
                  {t.name}
                  <span className="count">{t.count}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="search">
            <span style={{ color: "var(--dim)", fontSize: 13 }}>⌕</span>
            <input
              value={q}
              placeholder="搜索标题或简介…"
              onChange={(e) => {
                setQ(e.target.value);
                setView({ k: "feed" });
              }}
            />
            {q && (
              <button className="btn btn-ghost" style={{ padding: "2px 8px" }} onClick={() => setQ("")}>
                清除
              </button>
            )}
          </div>
        </div>

        <div className="content">
          {view.k === "detail" ? (
            <DetailPage slug={view.slug} onBack={() => setView({ k: "feed" })} />
          ) : (
            <Feed category={category} kind={kind} q={q} onOpen={(slug) => setView({ k: "detail", slug })} />
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

function Feed({
  category,
  kind,
  q,
  onOpen,
}: {
  category: string;
  kind: string;
  q: string;
  onOpen: (slug: string) => void;
}) {
  const [items, setItems] = useState<Card[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const r = await api.feed({ category, kind, q, page: p });
        setItems((prev) => (replace ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
        setHasMore(r.hasMore);
        setPage(p);
      } catch (e) {
        setError(`拉取失败：${e instanceof Error ? e.message : "未知错误"}`);
      } finally {
        setLoading(false);
      }
    },
    [category, kind, q],
  );

  useEffect(() => {
    void load(1, true);
  }, [load]);

  if (error) return <div className="center err">{error}</div>;
  if (loading && !items.length) return <div className="center">载入中…</div>;
  if (!items.length) return <div className="center">这里还没有内容</div>;

  return (
    <>
      <div style={{ marginBottom: 14, fontSize: 12, color: "var(--dim)" }}>
        共 {total} 项{kind ? ` · 标签 ${kind}` : ""}
      </div>
      <div className="grid">
        {items.map((it) => (
          <button key={it.id} className="card" onClick={() => onOpen(it.slug)}>
            {(() => {
              const src = coverUrl(it.cover);
              return src ? (
                <img className="card-cover" src={src} alt="" loading="lazy" />
              ) : (
                <div className="card-cover-empty">无封面</div>
              );
            })()}
            <div className="card-body">
              <div className="card-title">{it.title}</div>
              <div className="card-meta">
                {[it.categoryName, it.version, it.size].filter(Boolean).join(" · ")}
              </div>
              {it.providerName && <span className="chip">{it.providerName}</span>}
            </div>
          </button>
        ))}
      </div>
      {hasMore && (
        <button className="btn more" disabled={loading} onClick={() => void load(page + 1, false)}>
          {loading ? "载入中…" : "加载更多"}
        </button>
      )}
    </>
  );
}

function DetailPage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setD(null);
    api
      .detail(slug)
      .then((r) => setD(r.resource))
      .catch((e) => setError(String(e)));
  }, [slug]);

  if (error) return <div className="center err">打不开：{error}</div>;
  if (!d) return <div className="center">载入中…</div>;

  const cover = coverUrl(d.cover);
  const openExternal = (url: string) => {
    // Tauri 环境用 opener 插件；浏览器里退化为新窗口
    const w = window as unknown as { __TAURI__?: { opener?: { openUrl?: (u: string) => Promise<void> } } };
    if (w.__TAURI__?.opener?.openUrl) void w.__TAURI__.opener.openUrl(url);
    else window.open(url, "_blank", "noopener");
  };

  return (
    <div className="detail">
      <button className="back" onClick={onBack}>
        ← 返回列表
      </button>
      <h1>{d.title}</h1>
      {d.subtitle && <p className="sub">{d.subtitle}</p>}

      <div className="tagline">
        <span className="chip">{d.categoryName}</span>
        {d.version && <span className="chip">v{d.version}</span>}
        {d.size && <span className="chip">{d.size}</span>}
        {d.platforms.map((p) => (
          <span key={p} className="chip">
            {p}
          </span>
        ))}
      </div>

      {cover && <img className="cover-lg" src={cover} alt="" />}

      {(() => {
        // 导入时常把简介同时写进 summary 和 content，重复渲染同一段很蠢
        const dup =
          !!d.summary && !!d.content && d.content.replace(/\s+/g, "").startsWith(d.summary.replace(/…$/, "").replace(/\s+/g, "").slice(0, 40));
        return (
          <>
            {d.summary && !dup && <p className="body-text">{d.summary}</p>}
            {d.content && <div className="body-text">{d.content}</div>}
          </>
        );
      })()}

      {d.links.length > 0 && (
        <div className="section">
          <h2>下载</h2>
          {d.links.map((l) => (
            <div key={l.id} className="link-row">
              <span className="prov">{l.providerName}</span>
              <span className="url">{l.url}</span>
              {l.code && <span className="chip">码 {l.code}</span>}
              <button className="btn" onClick={() => openExternal(l.url)}>
                打开
              </button>
            </div>
          ))}
        </div>
      )}

      {d.tags.length > 0 && (
        <div className="section">
          <h2>标签</h2>
          <div className="tagline">
            {d.tags.map((t) => (
              <span key={t.slug} className="chip">
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {d.meta.length > 0 && (
        <div className="section">
          <h2>信息</h2>
          {d.meta.map((m) => (
            <div key={m.label} className="card-meta">
              {m.label}：{m.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
