"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  FileInput,
  Gamepad2,
  Inbox,
  LayoutDashboard,
  Link2,
  ShieldAlert,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { group: string; items: NavItem[] };

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  resources: Boxes,
  games: Gamepad2,
  taxonomy: Tags,
  submissions: Inbox,
  reports: ShieldAlert,
  links: Link2,
  imports: FileInput,
  users: Users,
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ nav, variant = "side" }: { nav: NavGroup[]; variant?: "side" | "mobile" }) {
  const pathname = usePathname();
  const router = useRouter();

  if (variant === "mobile") {
    return (
      <select
        aria-label="后台导航"
        value={nav.flatMap((g) => g.items).find((i) => isActive(pathname, i.href))?.href ?? "/admin"}
        onChange={(e) => router.push(e.target.value)}
        className="min-h-8 rounded-[6px] border border-line bg-surface px-2 text-[12px] text-ink md:hidden"
      >
        {nav.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((i) => (
              <option key={i.href} value={i.href}>
                {i.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  return (
    <nav aria-label="后台导航" className="flex-1 overflow-y-auto px-2 py-3">
      {nav.map((g) => (
        <div key={g.group} className="mb-4 last:mb-0">
          <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
            {g.group}
          </p>
          <ul>
            {g.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Boxes;
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      "flex min-h-9 items-center gap-2 rounded-[6px] px-2 text-[13px] transition-colors " +
                      (active
                        ? "bg-surface-2 font-medium text-ink shadow-[inset_2px_0_0_0_var(--ink)]"
                        : "text-muted hover:bg-surface-2 hover:text-ink")
                    }
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
