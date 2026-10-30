import { Link } from "react-router-dom"
import { ArrowUpRight, Package, Truck } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { formatCurrency, formatDate } from "@/lib/format"
import { orderStatusTone, shipmentStatusTone } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { Order } from "@/types"

function ItemThumb({ name }: { name: string }) {
  const tone = name.toLowerCase().includes("phone")
    ? "from-slate-700 to-slate-900"
    : name.toLowerCase().includes("lamp")
      ? "from-amber-100 to-orange-200"
      : name.toLowerCase().includes("pod") || name.toLowerCase().includes("audio")
        ? "from-slate-100 to-slate-300"
        : name.toLowerCase().includes("shoe") || name.toLowerCase().includes("runner")
          ? "from-emerald-100 to-teal-200"
          : "from-indigo-100 to-violet-200"

  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white/90",
        tone
      )}
    >
      <Package className="size-4" />
    </div>
  )
}

export function OrderCard({ order, compact = false }: { order: Order; compact?: boolean }) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const firstItem = order.items[0]

  return (
    <Link
      to={`/orders/${order.orderNumber}`}
      className={cn(
        "group block rounded-xl border border-border bg-card p-3.5 shadow-card transition-all hover:border-blue-200 hover:shadow-raised",
        compact && "p-3"
      )}
    >
      <div className="flex items-start gap-3">
        <ItemThumb name={firstItem?.name ?? "item"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[11.5px] font-semibold text-slate-500">
                #{order.orderNumber}
              </p>
              <p className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-800">
                {firstItem?.name}
                {order.items.length > 1 && (
                  <span className="font-normal text-muted-foreground"> +{order.items.length - 1} more</span>
                )}
              </p>
            </div>
            <StatusBadge tone={orderStatusTone[order.status]} className="shrink-0" />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>Placed {formatDate(order.placedAt, "MMM d")}</span>
            <span className="text-slate-300">•</span>
            <span>
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-slate-700">{formatCurrency(order.totalCents, order.currency)}</span>
            {order.shipment?.estimatedDelivery && order.status === "shipped" && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <Truck className="size-3" /> ETA {formatDate(order.shipment.estimatedDelivery, "MMM d")}
                </span>
              </>
            )}
            {order.shipment?.status === "exception" && (
              <>
                <span className="text-slate-300">•</span>
                <StatusBadge tone={shipmentStatusTone.exception} className="h-4 px-1.5 text-[9.5px]" />
              </>
            )}
          </div>
        </div>
        <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-blue-500" />
      </div>
    </Link>
  )
}
