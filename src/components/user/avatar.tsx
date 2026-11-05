import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-[12px]",
  md: "size-12 text-[15px]",
  lg: "size-20 text-[26px]",
} as const;

/** 头像：有图用图，没有就用昵称首字（中文取第一个字） */
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
  const initial = (name ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2 font-medium text-muted",
        SIZES[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ? `${name} 的头像` : "头像"} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </span>
  );
}
