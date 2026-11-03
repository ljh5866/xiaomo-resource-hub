import { cn } from "@/lib/utils";

export type LinkStatus = "ok" | "invalid" | "unknown" | "checking";

const MAP: Record<LinkStatus, { label: string; color: string; text: string }> = {
  ok: { label: "有效", color: "bg-ok", text: "text-ok" },
  invalid: { label: "失效", color: "bg-danger", text: "text-danger" },
  unknown: { label: "待校验", color: "bg-dim", text: "text-dim" },
  checking: { label: "校验中", color: "bg-info", text: "text-info" },
};

/** 方章状态标记：小方点 + 文字，绝不只用颜色传达状态（DESIGN.md §5.2 / §9） */
export function StatusDot({
  status,
  className,
  size = "md",
}: {
  status: LinkStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const s = MAP[status] ?? MAP.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border border-line/70 bg-transparent px-1.5 leading-none",
        size === "md" ? "h-5 text-[11px]" : "h-4 text-[10px]",
        s.text,
        className,
      )}
    >
      <span className={cn("block size-1.5", s.color)} aria-hidden />
      {s.label}
    </span>
  );
}

export function statusLabel(status: LinkStatus) {
  return (MAP[status] ?? MAP.unknown).label;
}
