import { ImportForm } from "@/components/admin/import-form";

export const dynamic = "force-dynamic";

export default function ImportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-[20px] font-bold text-ink">批量导入</h1>
        <p className="mt-1 text-[13px] text-muted">
          从表格里复制一段 CSV 粘贴进来，一次录几十条。
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
