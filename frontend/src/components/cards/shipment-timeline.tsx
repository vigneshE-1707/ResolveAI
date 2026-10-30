import { CircleCheck, Clock, MapPin, Truck } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDateShort } from "@/lib/format"
import type { Shipment } from "@/types"

export function ShipmentTimeline({ shipment }: { shipment: Shipment }) {
  return (
    <ol className="relative space-y-3 pl-0.5">
      {shipment.events.map((event, index) => {
        const isLatest = index === 0
        const isDone = event.completed
        return (
          <li key={`${event.at}-${index}`} className="relative flex gap-2.5">
            <div className="relative flex flex-col items-center">
              <span
                className={cn(
                  "z-10 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  isDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                    : "border-slate-200 bg-white text-slate-300"
                )}
              >
                {isLatest ? <Truck className="size-2.5" /> : <CircleCheck className="size-2.5" />}
              </span>
              {index < shipment.events.length - 1 && (
                <span className="absolute top-5 h-[calc(100%-8px)] w-px bg-slate-200" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <p
                className={cn(
                  "text-[12px] leading-tight",
                  isLatest ? "font-semibold text-slate-800" : "font-medium text-slate-600"
                )}
              >
                {event.label}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
                <span className="inline-flex items-center gap-0.5">
                  <Clock className="size-2.5" /> {formatDateShort(event.at)}
                </span>
                {event.location && (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="size-2.5" /> {event.location}
                  </span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
