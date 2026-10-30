import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Mail, MapPin, Phone, Search, Star, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { customers, customerOrders } from "@/mocks/data"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Customer } from "@/types"

export function AdminCustomersPage() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Customer | null>(null)

  const visible = useMemo(() => {
    const q = query.toLowerCase()
    return customers.filter(
      (customer) =>
        customer.fullName.toLowerCase().includes(q) || customer.email.toLowerCase().includes(q)
    )
  }, [query])

  const selectedOrders = selected ? customerOrders(selected.id) : []

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Operations"
        title="Customers"
        description="Account directory with loyalty tier, order volume, and ticket load."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => toast.info("Customer creation arrives with the API in Milestone 3")}>
            <UserPlus className="size-3.5" /> Add customer
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
                placeholder="Search name or email..."
                className="h-8 pl-8 text-[12px]"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {visible.length} of {customers.length} customers · demo data
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Open tickets</TableHead>
                <TableHead>Member since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[10.5px] font-semibold text-white">
                          {customer.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{customer.fullName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{customer.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.loyaltyTier === "standard" ? "outline" : "premium"} className="capitalize">
                      {customer.loyaltyTier === "standard" ? "Standard" : customer.loyaltyTier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.city}</TableCell>
                  <TableCell className="text-right tabular">{customer.totalOrders}</TableCell>
                  <TableCell className="text-right tabular">{customer.activeTickets}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(customer.memberSince)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" size="sm" className="h-auto p-0 text-[11.5px]" onClick={() => setSelected(customer)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {visible.length === 0 && (
            <p className="py-8 text-center text-[12px] text-muted-foreground">No customers match that search.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Customer profile</DialogTitle>
            <DialogDescription>Read-only summary · management actions arrive in Milestone 3.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[14px] font-semibold text-white">
                    {selected.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[15px] font-semibold">{selected.fullName}</p>
                  <Badge variant="premium" className="mt-0.5 gap-1 capitalize">
                    <Star className="size-2.5 fill-amber-500 text-amber-500" /> {selected.loyaltyTier}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1.5 rounded-lg border border-border bg-slate-50/60 p-2.5 text-[12px]">
                <p className="flex items-center gap-2"><Mail className="size-3.5 text-slate-400" /> {selected.email}</p>
                <p className="flex items-center gap-2"><Phone className="size-3.5 text-slate-400" /> {selected.phone}</p>
                <p className="flex items-center gap-2"><MapPin className="size-3.5 text-slate-400" /> {selected.city}, {selected.country}</p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border text-center">
                <div className="py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Orders</p>
                  <p className="text-[16px] font-semibold tabular">{selected.totalOrders}</p>
                </div>
                <div className="py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tickets</p>
                  <p className="text-[16px] font-semibold tabular">{selected.activeTickets}</p>
                </div>
                <div className="py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">LTV</p>
                  <p className="text-[16px] font-semibold tabular">
                    {formatCurrency(selectedOrders.reduce((sum, order) => sum + order.totalCents, 0))}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent orders</p>
                <div className="space-y-1">
                  {selectedOrders.slice(0, 3).map((order) => (
                    <Link
                      key={order.id}
                      to={`/orders/${order.orderNumber}`}
                      className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-[11.5px] hover:bg-slate-50"
                    >
                      <span className="font-mono text-[10.5px]">#{order.orderNumber}</span>
                      <span className="text-muted-foreground">{formatCurrency(order.totalCents, order.currency)}</span>
                    </Link>
                  ))}
                  {selectedOrders.length === 0 && (
                    <p className="text-[11.5px] text-muted-foreground">No orders in the demo dataset.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
