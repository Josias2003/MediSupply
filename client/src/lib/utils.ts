import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Rwandan Francs — e.g. 1,250,000 Rwf */
export function formatRWF(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  const formatted = new Intl.NumberFormat("en-RW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  return `${formatted} Rwf`;
}

/** Compact RWF for dashboards — e.g. 1.25M Rwf */
export function formatRWFCompact(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M Rwf`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K Rwf`;
  return `${n.toFixed(0)} Rwf`;
}
