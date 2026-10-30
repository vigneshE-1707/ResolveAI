import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Download, Search } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/format"
import { orderStatusTone } from "@/lib/status"
import { customers, orders } from "@/mocks/data"

export function AdminOrdersPage() {
  const [query, setQuery] = useState("")

  const visible = useMemo(() => {
    const q = query.toLowerCase()
    return orders.filter((order) => {
      const customer = customers.find((c) => c.id === order.customerId)
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        customer?.fullName.toLowerCase().includes(q) ||
        order.items.some((item) => item.name.toLowerCase().includes(q))
      )
    })
  }, [query])

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Operations"
        title="Orders"
        description="All orders across the business system, including shipment exceptions."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("CSV export arrives with the reporting API in Milestone 9")}
          >
            <Download className="size-3.5" /> Export
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Order number, customer, product..."
                className="h-8 pl-8 text-[12px]"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{visible.length} orders · demo data</p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((order) => {
                const customer = customers.find((c) => c.id === order.customerId)
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link to={`/orders/${order.orderNumber}`} className="font-mono text-[11px] font-semibold text-primary hover:underline">
                        #{order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{customer?.fullName ?? "—"}</p>
                      <p className="text-[10.5px] text-muted-foreground">{customer?.city}</p>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {order.items.map((item) => item.name).join(", ")}
                    </TableCell>
                    <TableCell><StatusBadge tone={orderStatusTone[order.status]} /></TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {order.shipment?.carrier ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular">
                      {formatCurrency(order.totalCents, order.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(order.placedAt, "MMM d")}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {visible.length === 0 && (
            <p className="py-8 text-center text-[12px] text-muted-foreground">No orders match that search.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
