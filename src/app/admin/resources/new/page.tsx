import { all } from "@/db/client";
import { ResourceForm } from "@/components/admin/resource-form";

export const dynamic = "force-dynamic";

export default async function NewResourcePage() {
  const categories = all<{ id: number; slug: string; name: string }>(
    "SELECT id, slug, name FROM categories ORDER BY sort_order",
  );

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-[20px] font-bold text-ink">新建资源</h1>
      <ResourceForm categories={categories} />
    </div>
  );
}
