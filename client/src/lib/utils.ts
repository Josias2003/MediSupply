import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Rwandan Francs — e.g. 1,250,000 RWF */
export function formatRWF(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Compact RWF for dashboards — e.g. 1.25M RWF */
export function formatRWFCompact(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M RWF`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K RWF`;
  return `${n.toFixed(0)} RWF`;
}
