import Link from "next/link";
import { Rss } from "lucide-react";
import { site } from "@/content/site";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <p className="font-sans text-[15px] font-semibold text-ink">{site.name}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{site.footer.blurb}</p>
        </div>

        <nav aria-label="页脚导航" className="flex flex-wrap gap-x-5 gap-y-2">
          {site.footer.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent"
            >
              {l.label === "RSS" && (
                <Rss className="size-3.5" strokeWidth={1.5} aria-hidden />
              )}
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="container-page flex flex-col gap-2 border-t border-line py-5 text-[12px] text-dim md:flex-row md:items-center md:justify-between">
        <span className="font-mono tracking-wider">© 2026 {site.latin}</span>
        <span>{site.footer.legal}</span>
      </div>
    </footer>
  );
}
