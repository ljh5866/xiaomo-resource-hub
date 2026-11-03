import { ImportForm } from "@/components/admin/import-form";

export const dynamic = "force-dynamic";

const COLUMNS = [
  ["标题", "必填", "资源名称，会作为详情页 H1"],
  ["slug", "必填", "URL 里的英文短名，一个资源一个，不能重复"],
  ["分类slug", "必填", "software / template / material / course / font / icon / ebook"],
  ["网盘", "必填", "quark / baidu / aliyun / xunlei / 123 / other"],
  ["链接", "必填", "http(s):// 开头的分享链接"],
  ["提取码", "选填", "如 m801"],
  ["大小", "选填", "如 1.2 GB"],
  ["版本", "选填", "如 v3.2"],
  ["摘要", "选填", "一句话说明，会进搜索与卡片副标题"],
];

export default function ImportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[22px] font-bold text-ink">批量导入</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          从表格里复制 CSV 粘进来，一次几十条。重复的 slug 与链接会自动跳过，不会覆盖已有资源。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/import-template.csv"
          download
          className="inline-flex min-h-10 items-center border border-line px-3 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
        >
          下载 CSV 模板
        </a>
        <span className="text-[12px] text-dim">
          或者用命令行从一个链接清单生成：<code className="font-mono text-ink">pnpm import:links links.txt</code>
        </span>
      </div>

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-2 text-left text-[11px] text-dim">
              <th className="px-3 py-2 font-normal">列</th>
              <th className="px-3 py-2 font-normal">必填</th>
              <th className="px-3 py-2 font-normal">说明</th>
            </tr>
          </thead>
          <tbody>
            {COLUMNS.map(([name, required, desc]) => (
              <tr key={name} className="border-t border-line">
                <td className="px-3 py-1.5 font-mono text-[12px] text-ink">{name}</td>
                <td className="px-3 py-1.5 text-[12px] text-dim">{required}</td>
                <td className="px-3 py-1.5 text-[12px] text-muted">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ImportForm />

      <div className="border-t border-line pt-4 text-[12px] leading-relaxed text-dim">
        <p>小提示：</p>
        <ul className="mt-1 space-y-1">
          <li>· 第一行表头会跳过（只要以 <code className="font-mono">title</code> 或 <code className="font-mono">标题</code> 开头）</li>
          <li>· 字段里有英文逗号时，用双引号把整个字段包起来</li>
          <li>· 导入的资源默认是「已发布」，会自动生成编号与搜索索引</li>
        </ul>
      </div>
    </div>
  );
}
