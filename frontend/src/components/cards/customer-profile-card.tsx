import { Link } from "react-router-dom"
import { Mail, MapPin, Phone, Star } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatDate } from "@/lib/format"
import type { Customer } from "@/types"

export function CustomerProfileCard({
  customer,
  lastOrderAt,
  compact = false,
}: {
  customer: Customer
  lastOrderAt?: string | null
  compact?: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Customer Overview</CardTitle>
        {customer.loyaltyTier !== "standard" && (
          <Badge variant="premium" className="gap-1 capitalize">
            <Star className="size-2.5 fill-amber-500 text-amber-500" />
            {customer.loyaltyTier} member
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 ring-4 ring-indigo-50">
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[15px] font-semibold text-white">
              {customer.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight">{customer.fullName}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{customer.email}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-slate-50/60">
          <div className="px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Total orders
            </p>
            <p className="mt-0.5 text-[17px] font-semibold leading-none tabular">{customer.totalOrders}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Active tickets
            </p>
            <p className="mt-0.5 text-[17px] font-semibold leading-none tabular">{customer.activeTickets}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Last order
            </p>
            <p className="mt-0.5 truncate text-[13px] font-semibold leading-tight">
              {lastOrderAt ? formatDate(lastOrderAt, "MMM d, yyyy") : "—"}
            </p>
          </div>
        </div>

        {!compact && (
          <>
            <Separator className="my-3" />
            <div className="space-y-1.5 text-[11.5px] text-muted-foreground">
              {customer.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-3.5 text-slate-400" /> {customer.phone}
                </p>
              )}
              <p className="flex items-center gap-2">
                <Mail className="size-3.5 text-slate-400" /> {customer.email}
              </p>
              {(customer.city || customer.country) && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-slate-400" /> {customer.city}
                  {customer.city && customer.country ? ", " : ""}
                  {customer.country}
                </p>
              )}
              {customer.memberSince && (
                <p className="pl-[22px] text-[10.5px]">
                  Member since {formatDate(customer.memberSince)}
                </p>
              )}
            </div>
            <div className="mt-2.5 flex gap-1.5">
              <Link
                to="/profile"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                View full profile
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
