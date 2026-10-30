import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Headset, PackageSearch } from "lucide-react"

import { OrderCard } from "@/components/cards/order-card"
import { EmptyState } from "@/components/feedback/states"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { useRole } from "@/app/role-context"
import { customerOrders } from "@/mocks/data"
import { cn } from "@/lib/utils"

const filters = [
  { id: "all", label: "All orders" },
  { id: "shipped", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
] as const

export function CustomerOrdersPage() {
  const { user } = useRole()
  const orders = useMemo(() => customerOrders(user.customerId ?? "cus_01"), [user.customerId])
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all")

  const visible = orders.filter((order) => {
    if (filter === "all") return true
    if (filter === "shipped") return order.status === "shipped" || order.status === "processing"
    return order.status === filter
  })

  return (
    <div>
      <PageHeader
        eyebrow="Customer portal"
        title="My Orders"
        description="Every order on your account, with live shipment status and one-click help."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/support">
              <Headset className="size-3.5" /> Ask the assistant
            </Link>
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {filters.map((item) => {
          const count =
            item.id === "all"
              ? orders.length
              : orders.filter((o) =>
                  item.id === "shipped" ? o.status === "shipped" || o.status === "processing" : o.status === item.id
                ).length
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                filter === item.id
                  ? "border-primary/20 bg-blue-50 text-primary"
                  : "border-border bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {item.label}
              <span className="ml-1.5 text-[10.5px] text-muted-foreground">{count}</span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={PackageSearch}
            title="No orders in this view"
            description="Try a different filter, or ask the assistant about a specific order number."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/support">Open support chat</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}
