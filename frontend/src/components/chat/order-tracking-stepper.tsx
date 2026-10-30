import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import type { OrderCardData } from "@/types"

export function OrderTrackingStepper({ steps }: { steps: OrderCardData["steps"] }) {
  return (
    <div className="flex items-start px-1 py-1">
      {steps.map((step, index) => (
        <div key={step.label} className="flex flex-1 items-start last:flex-none">
          <div className="flex min-w-0 flex-col items-center">
            <span
              className={cn(
                "flex size-[18px] items-center justify-center rounded-full border transition-colors",
                step.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                step.state === "current" && "border-blue-500 bg-blue-500 text-white ring-4 ring-blue-100",
                step.state === "upcoming" && "border-slate-300 bg-white text-transparent"
              )}
            >
              {step.state === "done" ? (
                <Check className="size-2.5" strokeWidth={3.5} />
              ) : step.state === "current" ? (
                <span className="size-1.5 rounded-full bg-white" />
              ) : (
                <span className="size-1.5 rounded-full bg-slate-300" />
              )}
            </span>
            <p
              className={cn(
                "mt-1.5 max-w-[76px] truncate text-center text-[10.5px] font-semibold leading-tight",
                step.state === "upcoming" ? "text-slate-400" : "text-slate-700"
              )}
              title={step.label}
            >
              {step.label}
            </p>
            <p className="text-[10px] leading-tight text-slate-400">{step.at}</p>
          </div>
          {index < steps.length - 1 && (
            <span
              className={cn(
                "mx-1 mt-[8px] h-0.5 min-w-3 flex-1 rounded-full",
                steps[index + 1].state === "upcoming" ? "bg-slate-200" : "bg-emerald-400"
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function InlineOrderCard({ data }: { data: OrderCardData }) {
  return (
    <div className="mt-2.5 rounded-lg border border-slate-200/80 bg-white/70 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="font-mono text-[11.5px] font-semibold text-slate-700">#{data.orderNumber}</p>
        <p className="text-[10.5px] text-slate-500">
          {data.carrier} · <span className="font-mono">{data.trackingNumber}</span>
        </p>
      </div>
      <OrderTrackingStepper steps={data.steps} />
    </div>
  )
}
