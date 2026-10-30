import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

type Tone = "blue" | "violet" | "emerald" | "amber" | "slate" | "rose"

const toneStyles: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-600",
  rose: "bg-rose-50 text-rose-600",
}

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  tone?: Tone
  delta?: { value: string; direction: "up" | "down"; positive?: boolean }
  className?: string
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  delta,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-card p-3.5 shadow-card transition-shadow hover:shadow-raised",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", toneStyles[tone])}>
          <Icon className="size-4" strokeWidth={2.1} />
        </span>
      </div>
      <div className="mt-1.5 flex items-end gap-2">
        <p className="text-[24px] font-semibold leading-none tracking-tight tabular">{value}</p>
        {delta && (
          <span
            className={cn(
              "mb-0.5 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10.5px] font-semibold",
              delta.positive === false ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
            )}
          >
            {delta.direction === "up" ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
