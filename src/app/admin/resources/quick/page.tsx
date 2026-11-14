import { all } from "@/db/client";
import { QuickAddForm } from "@/components/admin/quick-add-form";

export const dynamic = "force-dynamic";

export default async function QuickAddPage() {
  const categories = all<{ slug: string; name: string }>(
    "SELECT slug, name FROM categories ORDER BY sort_order",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[20px] font-bold text-ink">批量贴链接</h1>
        <p className="mt-1 text-[12px] text-muted">
          一行一个链接。能推断的都自动填好，建完是草稿，之后只要补标题和封面。
        </p>
      </div>
      <QuickAddForm categories={categories} />
    </div>
  );
}
