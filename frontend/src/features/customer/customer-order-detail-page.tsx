import { useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import { useCreateReturn, useMyAddresses, useMyOrder } from "@/lib/api/hooks"
import { formatCurrency, formatDate } from "@/lib/format"
import { orderStatusTone } from "@/lib/status"

const returnReasons = [
  { value: "wrong_item", label: "Wrong item received" },
  { value: "damaged", label: "Item arrived damaged" },
  { value: "not_as_described", label: "Not as described" },
  { value: "changed_mind", label: "Changed my mind" },
  { value: "late_delivery", label: "Arrived too late" },
  { value: "other", label: "Other" },
] as const

export function CustomerOrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>()
  const orderQuery = useMyOrder(orderNumber)
  const addresses = useMyAddresses()
  const createReturn = useCreateReturn()
  const [returnOpen, setReturnOpen] = useState(false)
  const [reason, setReason] = useState<string>("wrong_item")
  const [reasonText, setReasonText] = useState("")

  const order = orderQuery.data
  const defaultAddress = addresses.data?.find((address) => address.isDefault) ?? addresses.data?.[0]

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading order…</span>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (orderQuery.isError || !order) {
    const notFound = orderQuery.error instanceof ApiError && orderQuery.error.isNotFound
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={PackageOpen}
          title={notFound ? "Order not found" : "Could not load this order"}
          description={
            notFound
              ? `We couldn't find ${orderNumber ?? "that order"} on your account.`
              : "The order service did not respond. Try again in a moment."
          }
          action={
            notFound ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/orders">
                  <ArrowLeft className="size-3.5" /> Back to orders
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void orderQuery.refetch()}>
                Try again
              </Button>
            )
          }
        />
      </div>
    )
  }

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  const submitReturn = () => {
    createReturn.mutate(
      { orderNumber: order.orderNumber, reasonCode: reason, reasonText: reasonText || undefined },
      {
        onSuccess: () => {
          setReturnOpen(false)
          setReasonText("")
          toast.success("Return requested", {
            description: `We'll review ${order.orderNumber} and email you the next steps.`,
          })
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Could not submit the return")
        },
      }
    )
  }

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
              onClick={() => toast.info("Invoice download is not available yet")}
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
              {defaultAddress ? (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                  <span>
                    {defaultAddress.line1}
                    {defaultAddress.line2 ? (
                      <>
                        <br />
                        {defaultAddress.line2}
                      </>
                    ) : null}
                    <br />
                    {defaultAddress.city}
                    {defaultAddress.region ? `, ${defaultAddress.region}` : ""} {defaultAddress.postalCode}
                    <br />
                    {defaultAddress.country}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">No address on file.</p>
              )}
              <p className="mt-2 text-[10.5px] text-muted-foreground">
                This is your account's default address. The order-level shipping address is not exposed
                by the API yet.
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
                  disabled={!order.returnEligible || createReturn.isPending}
                  onClick={() => setReturnOpen(true)}
                >
                  <RotateCcw className="size-3.5" /> Return item
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-[11.5px]"
                  disabled
                  title="Order cancellation is not available yet"
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

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a return</DialogTitle>
            <DialogDescription>
              Tell us why {order.orderNumber} is coming back. Returns are reviewed by the support team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="return-reason">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="return-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {returnReasons.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return-notes">Details (optional)</Label>
              <Textarea
                id="return-notes"
                value={reasonText}
                onChange={(event) => setReasonText(event.target.value)}
                placeholder="Anything else we should know?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitReturn} disabled={createReturn.isPending}>
              {createReturn.isPending ? "Submitting…" : "Submit return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
