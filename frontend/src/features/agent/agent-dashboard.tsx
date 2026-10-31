import { Link } from "react-router-dom"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Headset,
  MessageSquare,
  ShieldAlert,
} from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { StatCard } from "@/components/layout/stat-card"
import { PageHeader } from "@/components/layout/page-header"
import { RequestsAreaChart, ChartCard, EscalationsBarChart, LatencyLineChart } from "@/components/charts/chart-cards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/feedback/states"
import { useAgentConversations, useAgentStats, useAgentTickets } from "@/lib/api/hooks"
import { latencySeries, requestSeries } from "@/mocks/data"
import { conversationModeTone, priorityTone, ticketCategoryLabel, ticketStatusTone } from "@/lib/status"
import { formatDateShort, timeAgo } from "@/lib/format"

export function AgentDashboardPage() {
  const stats = useAgentStats()
  const escalated = useAgentConversations({ status: "escalated", pageSize: 5 })

  return (
    <div>
      <PageHeader
        eyebrow="Agent console"
        title="Support operations"
        description="Live queue health and your active workload."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/admin/analytics">
                Analytics <ArrowRight className="size-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/agent/conversations">
                <MessageSquare className="size-3.5" /> Open queue
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatCard
          label="Open conversations"
          value={stats.data?.open_conversations ?? 0}
          icon={MessageSquare}
          tone="blue"
          hint="not yet resolved"
        />
        <StatCard
          label="Awaiting agent"
          value={stats.data?.pending_conversations ?? 0}
          icon={Clock3}
          tone="amber"
          hint="handed over by the assistant"
        />
        <StatCard
          label="My active"
          value={stats.data?.my_active ?? 0}
          icon={CheckCircle2}
          tone="emerald"
          hint="assigned to you"
        />
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3.5">
          <ChartCard
            title="Conversation volume"
            description="Requests vs. AI-resolved · last 14 days · demo data"
            action={
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-blue-600" /> Requests
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-violet-600" /> AI resolved
                </span>
              </div>
            }
          >
            <RequestsAreaChart data={requestSeries} />
          </ChartCard>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <ChartCard title="Escalations" description="Daily handovers · demo data">
              <EscalationsBarChart data={requestSeries} />
            </ChartCard>
            <ChartCard title="Agent latency" description="First token response, ms · demo data">
              <LatencyLineChart data={latencySeries} />
            </ChartCard>
          </div>
        </div>

        <div className="space-y-3.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5">
                <ShieldAlert className="size-4 text-amber-500" /> Escalation queue
              </CardTitle>
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-[11px]">
                <Link to="/agent/conversations" className="gap-1">
                  View all <ArrowRight className="size-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {escalated.isLoading ? (
                <>
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </>
              ) : escalated.isError ? (
                <p className="py-3 text-center text-[11.5px] text-muted-foreground">
                  Could not load the escalation queue.
                </p>
              ) : (escalated.data?.data.length ?? 0) === 0 ? (
                <p className="py-3 text-center text-[11.5px] text-muted-foreground">
                  No escalated conversations right now.
                </p>
              ) : (
                escalated.data?.data.map((conversation) => (
                  <Link
                    key={conversation.id}
                    to={`/agent/conversations/${conversation.id}`}
                    className="block rounded-lg border border-border bg-white p-2.5 transition-colors hover:border-amber-200 hover:bg-amber-50/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-semibold text-slate-800">{conversation.subject}</p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-amber-800">
                      {conversation.escalationReason ?? "Escalated"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <StatusBadge tone={conversationModeTone[conversation.mode]} withDot={false} className="h-4 px-1.5 text-[9.5px]" />
                      <span className="text-[10px] text-muted-foreground">
                        {conversation.assignedAgentId ? "Assigned" : "Unassigned"}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5">
                <Bot className="size-4 text-slate-400" /> Team workload
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11.5px] leading-relaxed text-muted-foreground">
              Per-agent workload and CSAT are not exposed by the API yet. Use the conversation queue to
              see assignment state.
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-blue-50/50">
            <CardContent className="pt-4">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                <Headset className="size-3.5 text-blue-600" /> AI is paused on escalation
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                When a conversation is escalated, the assistant stops making customer-facing
                decisions until an agent explicitly re-enables it. (Enforced in Milestone 7.)
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function AgentTicketsPage() {
  const ticketsQuery = useAgentTickets()

  return (
    <div>
      <PageHeader
        eyebrow="Agent console"
        title="Tickets"
        description="Requests requiring human ownership, with SLA context."
        actions={
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/agent/conversations">
              <MessageSquare className="size-3.5" /> Conversation queue
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          {ticketsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-9 rounded-md" />
              ))}
            </div>
          ) : ticketsQuery.isError ? (
            <EmptyState
              icon={ShieldAlert}
              title="Could not load tickets"
              description="The ticket service did not respond."
              action={
                <Button size="sm" variant="outline" onClick={() => void ticketsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (ticketsQuery.data?.data.length ?? 0) === 0 ? (
            <EmptyState icon={ShieldAlert} title="No tickets" description="No support tickets match this view." />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Ticket</th>
                  <th className="px-4 py-2.5 font-semibold">Subject</th>
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Priority</th>
                  <th className="px-4 py-2.5 font-semibold">Assigned</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {ticketsQuery.data?.data.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-border/60 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-[11px]">{ticket.ticketNumber}</td>
                    <td className="max-w-[260px] truncate px-4 py-2.5 font-medium">{ticket.subject}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {ticketCategoryLabel[ticket.category]}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={ticketStatusTone[ticket.status]} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={priorityTone[ticket.priority]} withDot={false} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {ticket.assignedAgentId ? "Support agent" : "Unassigned"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-muted-foreground">
                      {formatDateShort(ticket.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
