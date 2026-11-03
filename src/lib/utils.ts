import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CN_DATE = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Shanghai",
});

export function formatDate(date: Date | number | null | undefined) {
  if (!date) return "—";
  return CN_DATE.format(new Date(date)).replaceAll("/", "-");
}

/** 相对时间：用于卡片上的"更新于" */
export function relativeDate(date: Date | number | null | undefined) {
  if (!date) return "—";
  const t = new Date(date).getTime();
  const diff = Date.now() - t;
  const day = 86_400_000;
  if (diff < 3_600_000) return "刚刚";
  if (diff < day) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`;
  return formatDate(date);
}

export function formatCount(n: number | null | undefined) {
  const v = n ?? 0;
  if (v < 1000) return String(v);
  if (v < 10_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(v / 10_000).toFixed(1).replace(/\.0$/, "")}w`;
}

/** 目录编号：XM-2026-0417 */
export function makeCode(seq: number, year = new Date().getFullYear()) {
  return `XM-${year}-${String(seq).padStart(4, "0")}`;
}
