import { Link } from "react-router-dom"
import { ArrowUpRight, CalendarClock, Headset } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { formatDateShort } from "@/lib/format"
import { priorityTone, ticketCategoryLabel, ticketStatusTone } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { Ticket } from "@/types"

export function TicketCard({ ticket, compact = false }: { ticket: Ticket; compact?: boolean }) {
  return (
    <Link
      to={`/tickets/${ticket.ticketNumber}`}
      className={cn(
        "group block rounded-xl border border-border bg-card shadow-card transition-all hover:border-blue-200 hover:shadow-raised",
        compact ? "p-3" : "p-3.5"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="font-mono text-[11.5px] font-semibold text-slate-500">{ticket.ticketNumber}</p>
          <span className="text-slate-300">•</span>
          <p className="truncate text-[11px] text-muted-foreground">
            {ticketCategoryLabel[ticket.category] ?? ticket.category}
          </p>
        </div>
        <StatusBadge tone={ticketStatusTone[ticket.status]} className="shrink-0" />
      </div>

      <p className="mt-1.5 truncate text-[13.5px] font-semibold text-slate-800">{ticket.subject}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {ticket.orderNumber && (
          <span className="font-mono text-[10.5px]">#{ticket.orderNumber}</span>
        )}
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3" /> {formatDateShort(ticket.createdAt)}
        </span>
        <StatusBadge tone={priorityTone[ticket.priority]} withDot={false} className="h-4 px-1.5 text-[9.5px]" />
        {ticket.escalationReason && (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <Headset className="size-3" /> Escalated
          </span>
        )}
      </div>

      {ticket.escalationReason && (
        <p className="mt-1.5 truncate rounded-md bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800">
          {ticket.escalationReason}
        </p>
      )}

      <ArrowUpRight className="mt-2 size-3.5 text-slate-300 transition-colors group-hover:text-blue-500" />
    </Link>
  )
}
