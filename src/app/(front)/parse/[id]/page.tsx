import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { get } from "@/db/client";
import { getSessionUser } from "@/lib/auth";
import { providerOf } from "@/lib/constants";
import { isPanProvider } from "@/lib/pan/types";
import { providerReady } from "@/lib/pan";
import { resolveCookie } from "@/lib/pan/credentials";
import { ParsePanel } from "@/components/parse/parse-panel";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  provider: string;
  url: string;
  extractCode: string | null;
  label: string | null;
  slug: string;
  title: string;
  categorySlug: string;
  categoryName: string;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = get<{ title: string }>(
    `SELECT r.title FROM resource_links l JOIN resources r ON r.id = l.resource_id WHERE l.id = ?`,
    Number(id),
  );
  if (!row) notFound();
  return { title: `解析 · ${row.title}`, robots: { index: false, follow: false } };
}

/**
 * 站内解析页：/parse/{linkId}
 *
 * 只解析这一个链接（服务端按 id 查库，前端无法换成别人的链接），需要登录。
 */
export default async function ParsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const linkId = Number(id);
  if (!Number.isFinite(linkId) || linkId <= 0) notFound();

  const viewer = await getSessionUser();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/parse/${id}`)}`);

  const row = get<Row>(
    `SELECT l.id, l.provider, l.url, l.extract_code AS extractCode, l.label,
            r.slug, r.title, c.slug AS categorySlug, c.name AS categoryName
       FROM resource_links l
       JOIN resources r ON r.id = l.resource_id
       JOIN categories c ON c.id = r.category_id
      WHERE l.id = ? AND r.status = 'published'`,
    linkId,
  );
  if (!row) notFound();

  const provider = row.provider;
  const pan = isPanProvider(provider) ? provider : null;
  const meta = providerOf(provider);
  const cred = pan ? resolveCookie(viewer.id ?? null, pan) : null;

  return (
    <div className="container-page py-10">
      <nav className="flex flex-wrap items-center gap-1 text-[12px] text-dim">
        <Link href="/" className="hover:text-accent">
          首页
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/c/${row.categorySlug}`} className="hover:text-accent">
          {row.categoryName}
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/r/${row.slug}`} className="hover:text-accent">
          {row.title}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-muted">解析</span>
      </nav>

      <header className="mt-6 border-b border-line pb-4">
        <h1 className="font-sans text-[24px] font-bold text-ink lg:text-[28px]">网盘解析</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span aria-hidden className="size-2" style={{ backgroundColor: meta.tint }} />
          <span className="font-medium text-ink">{meta.name}</span>
          <span className="text-line-strong">|</span>
          <span className="truncate">{row.title}</span>
        </p>
      </header>

      {!pan ? (
        <p className="mt-8 border border-line bg-surface-2 px-4 py-8 text-center text-[13px] text-muted">
          这个来源不是网盘分享链接，没有可解析的内容。
        </p>
      ) : !providerReady(pan) ? (
        <p className="mt-8 border border-line bg-surface-2 px-4 py-8 text-center text-[13px] text-muted">
          {meta.name} 的解析还在开发中，目前只支持夸克网盘。
        </p>
      ) : !cred ? (
        <div className="mt-8 rounded-[10px] border border-line p-6">
          <h2 className="text-[15px] font-semibold text-ink">解析前需要先绑定你自己的{meta.name}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            本站不代持任何网盘账号，解析和下载都用你自己的账号完成：
            文件转存到你的网盘，直链在你的浏览器里直接打开，走你自己的带宽。
          </p>
          <ol className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-muted">
            <li>1. 电脑浏览器登录 pan.quark.cn（手机 App 拿不到 Cookie）</li>
            <li>2. 装「小莫资源网 · 网盘绑定助手」扩展，点一下「读取并绑定」；或手动复制 Cookie 粘贴</li>
            <li>3. 回到这个页面刷新，就能看到分享里的文件了</li>
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href="/me/pan"
              className="inline-flex min-h-9 items-center rounded-[6px] bg-accent px-4 text-[12px] font-medium text-on-accent hover:bg-accent-strong"
            >
              去绑定网盘
            </a>
            <a
              href="/xiaomo-pan-helper.zip"
              className="inline-flex min-h-9 items-center rounded-[6px] border border-line px-3 text-[12px] text-muted hover:border-accent hover:text-accent"
            >
              下载绑定扩展
            </a>
          </div>
        </div>
      ) : (
        <ParsePanel
          linkId={row.id}
          provider={pan}
          providerName={meta.name}
          resourceTitle={row.title}
          shareUrl={row.url}
          hasCredential={Boolean(cred)}
          credentialSource={cred?.source ?? "none"}
        />
      )}
    </div>
  );
}
