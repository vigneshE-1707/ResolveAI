import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns"

export function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatCompactCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100)
}

export function formatDate(iso: string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!iso) return "—"
  return format(new Date(iso), pattern)
}

export function formatTime(iso: string): string {
  return format(new Date(iso), "h:mm a")
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return `Today, ${formatTime(iso)}`
  if (isYesterday(d)) return `Yesterday, ${formatTime(iso)}`
  return format(d, "MMM d, h:mm a")
}

export function timeAgo(iso: string): string {
  return `${formatDistanceToNowStrict(new Date(iso))} ago`
}

export function duration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function pct(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
