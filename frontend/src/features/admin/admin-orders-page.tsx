import { useState } from "react"
import { Download, Search } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminOrders } from "@/lib/api/hooks"
import { formatCurrency, formatDate } from "@/lib/format"
import { orderStatusTone } from "@/lib/status"

export function AdminOrdersPage() {
  const [query, setQuery] = useState("")
  const ordersQuery = useAdminOrders({ q: query || undefined, pageSize: 50 })
  const orders = ordersQuery.data?.data ?? []

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
            onClick={() => toast.info("CSV export is not available yet")}
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
            <p className="text-[11px] text-muted-foreground">
              {ordersQuery.data?.total ?? orders.length} orders
            </p>
          </div>

          {ordersQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-8 rounded-md" />
              ))}
            </div>
          ) : (
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
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-[11px] font-semibold">
                      #{order.orderNumber}
                    </TableCell>
                    <TableCell className="font-medium">{order.customerName ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {order.firstItemName ?? "—"}
                      {order.lineCount > 1 ? ` +${order.lineCount - 1} more` : ""}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={orderStatusTone[order.status]} />
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {order.shipment?.carrier ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular">
                      {formatCurrency(order.totalCents, order.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(order.placedAt, "MMM d")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!ordersQuery.isLoading && orders.length === 0 && (
            <p className="py-8 text-center text-[12px] text-muted-foreground">
              {ordersQuery.isError ? "Could not load orders." : "No orders match that search."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
