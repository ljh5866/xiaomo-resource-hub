import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "关于",
  description: "小莫资源网是什么、资源从哪来、链接失效怎么处理。",
};

export default function AboutPage() {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-[68ch]">
        <h1 className="font-serif text-[34px] font-bold text-ink">关于小莫资源网</h1>

        <section className="mt-8 space-y-4 text-[15px] leading-[1.9] text-ink/90">
          <p>
            小莫资源网是一个资源索引站。它不做网盘、不托管大文件，只做三件事：
            <strong className="text-ink">归档、编号、标注状态</strong>。
          </p>
          <p>
            每条资源都有一个目录编号（如 XM-2026-0417），可以被引用、被检索、被存档。
            每条下载链接都有独立的校验记录——它是昨天还活着，还是三个月没人管过，页面上写得很清楚。
          </p>
        </section>

        <section id="source" className="mt-12 border-t border-line pt-8">
          <h2 className="font-serif text-[22px] font-semibold text-ink">资源来源</h2>
          <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-muted">
            <li>· 只收录公开发布的分享链接，不破解、不二次打包、不修改原始文件。</li>
            <li>· 每条资源记录来源页 URL、公开形式与记录日期，形成可追溯台账。</li>
            <li>· 权利人提出异议时，凭台账定位并下架，不需要逐条翻找。</li>
          </ul>
        </section>

        <section id="report" className="mt-12 border-t border-line pt-8">
          <h2 className="font-serif text-[22px] font-semibold text-ink">链接失效怎么办</h2>
          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            系统每天自动巡检一轮。连续失败的链接会被标记为「失效」并降权展示——不隐藏，
            因为你至少知道它曾经存在。点开详情页可以看备用链接，也可以举报提醒小编优先修复。
          </p>
        </section>

        <section id="request" className="mt-12 border-t border-line pt-8">
          <h2 className="font-serif text-[22px] font-semibold text-ink">提交资源需求</h2>
          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            没搜到想要的东西？把关键词和用途写清楚发给我们，收录后会出现在「每日更新」里。
            （投稿入口在 V1.1 开放，M1 骨架阶段先整理需求池。）
          </p>
        </section>
      </div>
    </div>
  );
}
