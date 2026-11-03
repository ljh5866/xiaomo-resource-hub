import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent border border-accent hover:bg-accent-strong hover:border-accent-strong",
  secondary:
    "bg-transparent text-ink border border-line-strong hover:border-accent hover:text-accent",
  ghost:
    "bg-transparent text-muted border border-transparent hover:bg-surface-2 hover:text-ink",
  danger:
    "bg-transparent text-danger border border-danger/60 hover:bg-danger/10 hover:border-danger",
};

const SIZE: Record<Size, string> = {
  // 触控目标一律 ≥44px：sm 用 min-h-11 兜底
  sm: "min-h-11 px-3 text-[13px] gap-1.5",
  md: "min-h-11 px-4 text-sm gap-2",
  lg: "min-h-12 px-6 text-[15px] gap-2",
};

export function buttonStyles(variant: Variant = "secondary", size: Size = "md") {
  return cn(
    "inline-flex items-center justify-center rounded-none font-medium",
    "transition-[background-color,border-color,color] duration-160 ease-out",
    "cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-45",
    VARIANT[variant],
    SIZE[size],
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={cn(buttonStyles(variant, size), className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <a className={cn(buttonStyles(variant, size), className)} {...props}>
      {children}
    </a>
  );
}
