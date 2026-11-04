import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { StatusDot } from "@/components/ui/status-dot";
import { ResourceCard } from "@/components/resource/resource-card";
import { LinkRow } from "@/components/resource/link-row";
import { ResourceCardSkeleton } from "@/components/ui/skeleton";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "视觉样张",
  robots: { index: false, follow: false },
};

/** 改视觉时先看这一页：所有 token 与组件的实际渲染都在这里。 */
const SWATCHES = [
  ["canvas", "var(--bg)", "页面底色"],
  ["surface", "var(--surface)", "卡片 / 面板"],
  ["surface-2", "var(--surface-2)", "悬浮 / 输入框"],
  ["line", "var(--line)", "分隔线与描边"],
  ["line-strong", "var(--line-strong)", "hover 描边"],
  ["ink", "var(--ink)", "正文"],
  ["muted", "var(--muted)", "次要文字"],
  ["dim", "var(--dim)", "元信息 / 禁用"],
  ["accent", "var(--accent)", "黄铜：唯一强调色"],
  ["ok", "var(--ok)", "链接有效"],
  ["danger", "var(--danger)", "失效 / 破坏性"],
  ["info", "var(--info)", "提示"],
] as const;

const TYPE = [
  ["display", "text-[40px] lg:text-[56px] font-sans font-bold leading-[1.05]", "找资源，别再翻十个网盘。"],
  ["h1", "text-[30px] lg:text-[38px] font-sans font-bold", "Excel 数据看板模板合集"],
  ["h2", "text-[24px] font-sans font-semibold", "本周精选"],
  ["h3", "text-[18px] font-sans font-semibold", "说明"],
  ["body", "text-[16px] leading-[1.7]", "软件、模板、素材、教程，逐条编号归档。"],
  ["small", "text-[13px] leading-[1.6] text-muted", "12 套可直接套用的经营分析看板。"],
  ["caption", "text-[12px] text-dim", "共 24 项"],
  ["mono", "font-mono text-[13px] tracking-[0.04em] text-dim", "XM-2026-0417"],
] as const;

export default function StyleGuidePage() {
  return (
    <div className="container-page py-10">
      <header className="border-b border-line pb-6">
        <h1 className="font-sans text-[30px] font-bold text-ink">视觉样张</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
          改颜色、改字阶、改组件形态之前，先在这一页看实际渲染。
          这里不用截图对比，改完 <code className="font-mono text-ink">globals.css</code> 或组件，
          刷新就同步。当前主题：{site.name} · 默认深色（加 <code className="font-mono text-ink">.light</code> 切浅色）。
        </p>
      </header>

      {/* 色板 */}
      <Section title="色板" note="组件里不允许出现裸 hex，只用这些变量">
        <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-4">
          {SWATCHES.map(([name, value, desc]) => (
            <div key={name} className="bg-surface p-4">
              <div
                className="h-10 w-full border border-line"
                style={{ background: value }}
                aria-hidden
              />
              <p className="mt-2 font-mono text-[12px] text-ink">--color-{name}</p>
              <p className="text-[11px] text-dim">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 字阶 */}
      <Section title="字阶" note="标题一律宋体，正文一律黑体；数字用等宽">
        <div className="space-y-4 border border-line bg-surface p-6">
          {TYPE.map(([name, cls, sample]) => (
            <div key={name} className="border-b border-line pb-4 last:border-0 last:pb-0">
              <p className="mb-1 font-mono text-[10px] tracking-[0.14em] text-dim">
                {name}
              </p>
              <p className={cls + " text-ink"}>{sample}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 按钮 */}
      <Section title="按钮" note="一屏至多一个 primary；触控目标 ≥44px">
        <div className="space-y-5 border border-line bg-surface p-6">
          {(["primary", "secondary", "ghost", "danger"] as const).map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <span className="w-24 font-mono text-[11px] text-dim">{v}</span>
              <Button variant={v} size="sm">小号</Button>
              <Button variant={v} size="md">中号</Button>
              <Button variant={v} size="lg">大号</Button>
              <Button variant={v} disabled>禁用</Button>
            </div>
          ))}
        </div>
      </Section>

      {/* 标签与状态 */}
      <Section title="标签 / 状态" note="状态必须带文字，不能只靠颜色">
        <div className="flex flex-col gap-6 border border-line bg-surface p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>默认</Chip>
            <Chip tone="accent">强调</Chip>
            <Chip tone="muted">弱化</Chip>
            <ChipRow items={["模板", "Windows", "1.2 GB", "夸克", "更多", "再来一个"]} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusDot status="ok" />
            <StatusDot status="unknown" />
            <StatusDot status="invalid" />
            <StatusDot status="checking" />
            <StatusDot status="ok" size="sm" />
            <StatusDot status="invalid" size="sm" />
          </div>
        </div>
      </Section>

      {/* 资源卡 */}
      <Section title="资源卡" note="直角、1px 描边、hover 只改描边与位移 2px">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ResourceCard
            data={{
              code: "XM-2026-9001",
              slug: "demo-ok",
              title: "正常状态的资源卡",
              subtitle: "展示标题两行截断与副标题一行截断的效果",
              categoryName: "模板",
              platforms: ["windows", "office"],
              sizeLabel: "1.2 GB",
              provider: "quark",
              status: "ok",
              updatedAt: new Date(),
            }}
          />
          <ResourceCard
            data={{
              code: "XM-2026-9002",
              slug: "demo-dead",
              title: "失效状态的资源卡（仍然可点）",
              subtitle: "降透明但保留入口，进去有修复说明",
              categoryName: "素材",
              platforms: ["mac"],
              sizeLabel: "3.2 GB",
              provider: "xunlei",
              status: "invalid",
              updatedAt: new Date(Date.now() - 86400000 * 30),
              isFeatured: true,
            }}
          />
          <ResourceCardSkeleton />
        </div>
      </Section>

      {/* 下载链接行 */}
      <Section title="下载链接行" note="竖排结构，适配 360px 侧栏；失效态禁用主按钮">
        <div className="grid max-w-md gap-3">
          <LinkRow
            link={{
              id: 1,
              provider: "quark",
              url: "#",
              extractCode: "m01x",
              label: "主链接",
              status: "ok",
              clickCount: 18787,
            }}
          />
          <LinkRow
            link={{
              id: 2,
              provider: "baidu",
              url: "#",
              extractCode: null,
              label: "备用",
              status: "unknown",
              clickCount: 12,
            }}
          />
          <LinkRow
            link={{
              id: 3,
              provider: "xunlei",
              url: "#",
              extractCode: "bk2x",
              label: null,
              status: "invalid",
              clickCount: 903,
            }}
          />
        </div>
      </Section>

      {/* 间距 */}
      <Section title="间距" note="4px 基数；section 96/56，卡片内边距 20/28，卡片间距 24">
        <div className="flex items-end gap-4 border border-line bg-surface p-6">
          {[4, 8, 12, 16, 24, 32, 48, 64, 96].map((n) => (
            <div key={n} className="text-center">
              <div className="bg-accent/70" style={{ width: n, height: n }} aria-hidden />
              <p className="mt-2 font-mono text-[10px] text-dim">{n}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="font-sans text-[20px] font-semibold text-ink">{title}</h2>
        {note && <p className="mt-1 font-mono text-[11px] tracking-wide text-dim">{note}</p>}
      </div>
      {children}
    </section>
  );
}
