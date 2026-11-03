import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit/submit-form";
import { listCategories } from "@/lib/queries";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "投稿",
  description: "推荐一条资源，审核通过后会出现在小莫资源网。",
  alternates: { canonical: "/submit" },
};

export default async function SubmitPage() {
  const categories = await listCategories();

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-xl">
        <header className="border-b border-line pb-5">
          <h1 className="font-serif text-[30px] font-bold text-ink">投稿</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            发现了好东西？填在这里。审核通过后会归档进对应分类，并标注来源为「读者投稿」。
            不需要注册。
          </p>
        </header>

        <SubmitForm categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />

        <div className="mt-10 border-t border-line pt-5 text-[12px] leading-relaxed text-dim">
          <p>收录标准：</p>
          <ul className="mt-2 space-y-1">
            <li>· 公开可直接访问的分享链接（不是需要加群/加好友的那种）</li>
            <li>· 内容与描述一致，不含捆绑安装包</li>
            <li>· 能说明来源与授权情况更好</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
