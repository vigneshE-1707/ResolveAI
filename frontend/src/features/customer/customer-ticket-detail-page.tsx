import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CalendarClock, Headset, Send, TicketX } from "lucide-react"

import { EmptyState } from "@/components/feedback/states"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ApiError } from "@/lib/api/client"
import { useMyTicket } from "@/lib/api/hooks"
import { formatDateShort } from "@/lib/format"
import { priorityTone, ticketCategoryLabel, ticketStatusTone } from "@/lib/status"

export function CustomerTicketDetailPage() {
  const { ticketNumber } = useParams<{ ticketNumber: string }>()
  const ticketQuery = useMyTicket(ticketNumber)
  const ticket = ticketQuery.data

  if (ticketQuery.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading ticket…</span>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-80" />
        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    )
  }

  if (ticketQuery.isError || !ticket) {
    const notFound = ticketQuery.error instanceof ApiError && ticketQuery.error.isNotFound
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={TicketX}
          title={notFound ? "Ticket not found" : "Could not load this ticket"}
          description={
            notFound
              ? `Ticket ${ticketNumber ?? ""} is not on your account.`
              : "The ticket service did not respond. Try again in a moment."
          }
          action={
            notFound ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/tickets">
                  <ArrowLeft className="size-3.5" /> Back to tickets
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void ticketQuery.refetch()}>
                Try again
              </Button>
            )
          }
        />
      </div>
    )
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 h-7 gap-1 px-2 text-[12px] text-muted-foreground">
        <Link to="/tickets">
          <ArrowLeft className="size-3.5" /> All tickets
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Ticket ${ticket.ticketNumber}`}
        title={ticket.subject}
        description={`Opened ${formatDateShort(ticket.createdAt)} · ${ticketCategoryLabel[ticket.category]}`}
        actions={
          <>
            <StatusBadge tone={priorityTone[ticket.priority]} withDot={false} />
            <StatusBadge tone={ticketStatusTone[ticket.status]} />
          </>
        }
      />

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Issue description</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[13px] leading-relaxed text-slate-700">
              {ticket.description || "No description was provided."}
              {ticket.escalationReason && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
                  <p className="font-semibold">Escalation reason</p>
                  <p className="mt-0.5">{ticket.escalationReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Add a reply</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <Textarea
                rows={3}
                placeholder="Share any extra detail with the support team..."
                id="ticket-reply"
                disabled
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10.5px] text-muted-foreground">
                  Customer replies on tickets are not available yet. Use chat to reach the support team.
                </p>
                <Button size="sm" className="gap-1.5" disabled>
                  <Send className="size-3.5" /> Send reply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Ticket details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ticket</span>
                <span className="font-mono text-[11px] font-semibold">{ticket.ticketNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium">{ticketCategoryLabel[ticket.category]}</span>
              </div>
              {ticket.orderNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Order</span>
                  <Link
                    to={`/orders/${ticket.orderNumber}`}
                    className="font-mono text-[11px] font-semibold text-primary hover:underline"
                  >
                    #{ticket.orderNumber}
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned</span>
                <span className="font-medium">
                  {ticket.assignedAgentId ? "Support agent" : "Unassigned"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <CalendarClock className="size-3 text-slate-400" />
                  {formatDateShort(ticket.updatedAt)}
                </span>
              </div>
              <Separator className="my-1" />
              <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                Status changes and agent replies appear here as the support team works on your ticket.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="pt-4">
              <p className="text-[12.5px] font-semibold">Need faster help?</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                Ask the assistant to review this ticket with your order context.
              </p>
              <Button asChild size="sm" className="mt-2.5 w-full gap-1.5">
                <Link to="/support">
                  <Headset className="size-3.5" /> Open chat
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
