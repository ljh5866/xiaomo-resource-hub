import Link from "next/link";
import { StatusDot, type LinkStatus } from "@/components/ui/status-dot";
import { ChipRow } from "@/components/ui/chip";
import { platformOf, providerOf } from "@/lib/constants";
import { cn, relativeDate } from "@/lib/utils";

export type ResourceCardData = {
  code: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  categoryName?: string;
  platforms?: string[];
  sizeLabel?: string | null;
  provider?: string | null;
  status?: LinkStatus;
  updatedAt?: Date | number | null;
  isFeatured?: boolean;
  coverUrl?: string | null;
  coverBlur?: string | null;
};

/**
 * 封面：有图用图（带 LQIP 底色防抖），没图用「目录卡」纹理。
 * 上传图已由服务端转好 WebP，这里不再走 next/image 优化管线。
 */
function CoverFrame({
  code,
  featured,
  coverUrl,
  coverBlur,
  title,
}: {
  code: string;
  featured?: boolean;
  coverUrl?: string | null;
  coverBlur?: string | null;
  title: string;
}) {
  if (coverUrl) {
    return (
      <div className="relative aspect-[21/9] w-full overflow-hidden border-b border-line bg-surface-2 sm:aspect-[16/10]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          style={
            coverBlur
              ? { backgroundImage: `url(${coverBlur})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        />
        {featured && (
          <span className="absolute right-0 top-0 border-b border-l border-accent/40 bg-canvas px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-accent">
            精选
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-[21/9] w-full overflow-hidden border-b border-line sm:aspect-[16/10]",
        featured ? "bg-surface-2" : "bg-surface-2/60",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, var(--line-strong) 0 1px, transparent 1px 28px)",
        }}
      />
      <div aria-hidden className="absolute inset-y-0 left-6 w-px bg-accent/25" />
      <span className="absolute bottom-3 left-3 font-mono text-[11px] tracking-[0.08em] text-dim">
        {code}
      </span>
      {featured && (
        <span className="absolute right-0 top-0 border-b border-l border-accent/40 bg-canvas px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-accent">
          精选
        </span>
      )}
    </div>
  );
}

export function ResourceCard({
  data,
  priority = false,
}: {
  data: ResourceCardData;
  priority?: boolean;
}) {
  const chips = [
    data.categoryName,
    ...(data.platforms ?? []).slice(0, 2).map(platformOf),
    data.sizeLabel,
    data.provider ? providerOf(data.provider).short : null,
  ].filter(Boolean) as string[];

  return (
    <Link
      href={`/r/${data.slug}`}
      className={cn(
        "group flex h-full flex-col border border-line bg-surface transition-[border-color,transform] duration-180 ease-out",
        "hover:-translate-y-0.5 hover:border-line-strong",
        data.status === "invalid" && "opacity-70",
      )}
      data-priority={priority || undefined}
    >
      <CoverFrame
        code={data.code}
        featured={data.isFeatured}
        coverUrl={data.coverUrl}
        coverBlur={data.coverBlur}
        title={data.title}
      />

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] tracking-[0.08em] text-dim">
            {data.coverUrl ? "" : data.code}
          </span>
          <StatusDot status={data.status ?? "unknown"} size="sm" />
        </div>

        <h3 className="line-clamp-2 font-serif text-[17px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
          {data.title}
        </h3>

        {data.subtitle && (
          <p className="line-clamp-1 text-[13px] leading-relaxed text-muted">
            {data.subtitle}
          </p>
        )}

        <div className="mt-auto pt-2">
          {/* 单行不换行：超过 3 个就只显示 2 个 + 计数 */}
          <ChipRow items={chips} max={chips.length > 3 ? 2 : 3} />
        </div>

        <p className="pt-1 font-mono text-[11px] text-dim">
          更新 {relativeDate(data.updatedAt)}
        </p>
      </div>
    </Link>
  );
}
