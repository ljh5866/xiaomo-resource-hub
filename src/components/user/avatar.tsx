import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-[12px]",
  md: "size-12 text-[15px]",
  lg: "size-20 text-[26px]",
} as const;

const DEFAULT_SRC = "/default-avatar.webp";

/**
 * 头像：有图用图，没有就用默认头像图（深色圆形人像）。
 * 默认图放在 public/default-avatar.webp，未登录/新用户都能拿到。
 */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const resolved = src || DEFAULT_SRC;

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2",
        SIZES[size],
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt={name ? `${name} 的头像` : "头像"}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
