import { Link } from "react-router-dom"
import { AlertTriangle, ArrowRight, Clock, ShieldCheck, TicketCheck } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { ticketStatusTone } from "@/lib/status"
import type { ApprovalCardData, EscalationCardData, TicketCardData } from "@/types"

export function TicketCreatedCard({ data }: { data: TicketCardData }) {
  return (
    <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-2.5 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-emerald-600 shadow-sm">
        <TicketCheck className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-slate-800">
          Ticket {data.ticketNumber} created
        </p>
        <p className="truncate text-[10.5px] text-slate-500">{data.subject}</p>
      </div>
      <StatusBadge tone={ticketStatusTone[data.status]} className="shrink-0" />
    </div>
  )
}

export function EscalationCard({ data }: { data: EscalationCardData }) {
  return (
    <div className="mt-2.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900">
        <AlertTriangle className="size-3.5" /> Escalated to a human specialist
      </div>
      <p className="mt-0.5 text-[11px] text-amber-800/90">{data.reason}</p>
      <div className="mt-1.5 flex items-center gap-3 text-[10.5px] text-amber-800/80">
        <span className="flex items-center gap-1">
          <Clock className="size-3" /> {data.estimatedWait}
        </span>
        <span>Queue position #{data.queuePosition}</span>
      </div>
    </div>
  )
}

export function ApprovalRequestCard({
  data,
  onDecision,
}: {
  data: ApprovalCardData
  onDecision?: (decision: "granted" | "denied") => void
}) {
  return (
    <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-900">
        <ShieldCheck className="size-3.5" /> Confirmation required
      </div>
      <p className="mt-1 text-[12px] text-slate-700">{data.summary}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <Button size="xs" onClick={() => onDecision?.("granted")}>
          Confirm
        </Button>
        <Button size="xs" variant="outline" onClick={() => onDecision?.("denied")}>
          Cancel
        </Button>
        <span className="ml-auto text-[10px] text-slate-500">
          {data.action} · <span className="font-mono">{data.approvalId}</span>
        </span>
      </div>
    </div>
  )
}

export function OrderHelpLink({ orderNumber }: { orderNumber: string }) {
  return (
    <Button asChild variant="link" size="sm" className="h-auto p-0 text-[12px]">
      <Link to={`/orders/${orderNumber}`} className="gap-1">
        View order <ArrowRight className="size-3" />
      </Link>
    </Button>
  )
}
