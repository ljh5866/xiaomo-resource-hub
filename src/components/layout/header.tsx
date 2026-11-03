import Link from "next/link";
import { Suspense } from "react";
import { Bookmark, type LucideIcon } from "lucide-react";
import { site } from "@/content/site";
import { UserMenu } from "@/components/auth/user-menu";
import { SearchField } from "./search-field";

const NAV_ICONS: Partial<Record<string, LucideIcon>> = {
  "/favorites": Bookmark,
};

function SearchFallback() {
  return <div className="h-12 w-full border border-line bg-surface-2" aria-hidden />;
}

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link
      href="/"
      aria-label={`${site.name} 首页`}
      className="group flex items-center gap-2.5"
    >
      <span
        aria-hidden
        className={
          "grid place-items-center border-2 border-accent font-serif font-black leading-none text-accent transition-colors group-hover:bg-accent group-hover:text-on-accent " +
          (size === "lg" ? "size-12 text-2xl" : "size-9 text-lg")
        }
      >
        {site.seal}
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={
            "font-serif font-bold tracking-tight text-ink " +
            (size === "lg" ? "text-xl" : "text-[17px]")
          }
        >
          {site.name}
        </span>
        <span className="mt-1 font-mono text-[10px] tracking-[0.16em] text-dim">
          {site.latin}
        </span>
      </span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/92 backdrop-blur-[6px]">
      <div className="container-page flex h-16 items-center gap-4 lg:gap-8">
        <Logo />

        <div className="hidden min-w-0 flex-1 lg:block">
          <Suspense fallback={<SearchFallback />}>
            <SearchField placeholder={site.search.header} />
          </Suspense>
        </div>

        <nav aria-label="主导航" className="ml-auto flex items-center gap-1">
          {site.nav
            .filter((item) => item.href !== "/login")
            .map((item) => {
              const Icon = NAV_ICONS[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "inline-flex min-h-11 items-center gap-1.5 px-3 text-sm text-muted transition-colors hover:text-accent " +
                    ("desktopOnly" in item && item.desktopOnly ? "hidden md:inline-flex" : "")
                  }
                >
                  {Icon && <Icon className="size-4" strokeWidth={1.5} aria-hidden />}
                  <span className={Icon ? "hidden sm:inline" : ""}>{item.label}</span>
                </Link>
              );
            })}
          <UserMenu />
        </nav>
      </div>

      {/* 移动端：搜索框独占一行 */}
      <div className="container-page pb-3 lg:hidden">
        <Suspense fallback={<SearchFallback />}>
          <SearchField placeholder={site.search.page} />
        </Suspense>
      </div>
    </header>
  );
}
