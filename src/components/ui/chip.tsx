import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 方角小标签：DESIGN.md §5.6 —— 高 24px、直角、最多 4 个 */
export function Chip({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent" | "muted";
}) {
  const tones = {
    default: "bg-surface-2 text-muted border-transparent",
    accent: "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent border-transparent",
    muted: "bg-transparent text-dim border-line",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-[12px] leading-none whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ChipRow({
  items,
  max = 4,
  className,
}: {
  items: ReactNode[];
  max?: number;
  className?: string;
}) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((item, i) => (
        <Chip key={i}>{item}</Chip>
      ))}
      {rest > 0 && <Chip tone="muted">+{rest}</Chip>}
    </div>
  );
}
