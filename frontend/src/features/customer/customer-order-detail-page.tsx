import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Download,
  Headset,
  MapPin,
  PackageOpen,
  RotateCcw,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { ShipmentTimeline } from "@/components/cards/shipment-timeline"
import { EmptyState } from "@/components/feedback/states"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/format"
import { orderStatusTone } from "@/lib/status"
import { findOrder } from "@/mocks/data"

export function CustomerOrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>()
  const order = orderNumber ? findOrder(orderNumber) : undefined

  if (!order) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={PackageOpen}
          title="Order not found"
          description={`We couldn't find ${orderNumber ?? "that order"} on your account.`}
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/orders">
                <ArrowLeft className="size-3.5" /> Back to orders
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 h-7 gap-1 px-2 text-[12px] text-muted-foreground">
        <Link to="/orders">
          <ArrowLeft className="size-3.5" /> All orders
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Order ${order.orderNumber}`}
        title={order.items[0]?.name ?? "Order details"}
        description={`Placed ${formatDate(order.placedAt, "MMMM d, yyyy")} · ${itemCount} item${itemCount === 1 ? "" : "s"} · ${formatCurrency(order.totalCents, order.currency)}`}
        actions={
          <>
            <StatusBadge tone={orderStatusTone[order.status]} />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => toast.info("Invoice download arrives with the backend in Milestone 3")}
            >
              <Download className="size-3.5" /> Invoice
            </Button>
          </>
        }
      />

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3.5">
          {order.shipment ? (
            <Card>
              <CardHeader className="pb-2">
                <div>
                  <CardTitle className="flex items-center gap-1.5">
                    <Truck className="size-4 text-slate-400" /> Shipment tracking
                  </CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {order.shipment.carrier} ·{" "}
                    <span className="font-mono text-[10.5px]">{order.shipment.trackingNumber}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10.5px] text-muted-foreground">Estimated delivery</p>
                  <p className="text-[12.5px] font-semibold">
                    {formatDate(order.shipment.estimatedDelivery, "MMM d, yyyy")}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11.5px] text-blue-900">
                  {order.shipment.status === "exception"
                    ? "Carrier reported an exception. Support can review this with you."
                    : `In transit — latest scan: ${order.shipment.events[0]?.label ?? "awaiting update"}.`}
                </div>
                <ShipmentTimeline shipment={order.shipment} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-3 pt-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                  <PackageOpen className="size-4 text-slate-500" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold">No shipment yet</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    A tracking number appears here once the order ships.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Items in this order</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-slate-800">{item.name}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">{item.sku}</TableCell>
                      <TableCell className="text-right tabular">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">
                        {formatCurrency(item.unitPriceCents, order.currency)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular">
                        {formatCurrency(item.unitPriceCents * item.quantity, order.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-3" />
              <div className="ml-auto max-w-[260px] space-y-1 text-[12px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular">{formatCurrency(order.subtotalCents, order.currency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="tabular">
                    {order.shippingCents === 0 ? "Free" : formatCurrency(order.shippingCents, order.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="tabular">{formatCurrency(order.taxCents, order.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 text-[13px] font-semibold">
                  <span>Total</span>
                  <span className="tabular">{formatCurrency(order.totalCents, order.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Delivery address</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[12px] text-slate-600">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                <span>
                  John Doe
                  <br />
                  221 Lake Street, Apt 4B
                  <br />
                  {order.shippingCity}
                  <br />
                  {order.shippingCountry}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Return eligibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-slate-50/60 px-2.5 py-2">
                <ShieldCheck className="size-4 shrink-0 text-emerald-500" />
                <div className="text-[11.5px]">
                  <p className="font-semibold text-slate-800">
                    {order.returnEligible ? "Eligible for return" : "Return window closed"}
                  </p>
                  <p className="text-muted-foreground">
                    {order.returnEligible
                      ? `30-day window ends ${formatDate(order.returnWindowEndsAt, "MMM d, yyyy")}`
                      : "Return period for this order has ended."}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-[11.5px]"
                  disabled={!order.returnEligible}
                  onClick={() => toast.info("Return requests are created through the AI workflow in Milestone 7")}
                >
                  <RotateCcw className="size-3.5" /> Return item
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-[11.5px]"
                  onClick={() => toast.info("Cancellation is approval-gated from Milestone 7")}
                >
                  <XCircle className="size-3.5" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="pt-4">
              <p className="text-[12.5px] font-semibold text-slate-800">Need help with this order?</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                The assistant can check delivery, start a return, or escalate to a human agent.
              </p>
              <Button asChild size="sm" className="mt-2.5 w-full gap-1.5">
                <Link to="/support">
                  <Headset className="size-3.5" /> Chat about this order
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
