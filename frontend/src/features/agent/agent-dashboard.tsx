import { Link } from "react-router-dom"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Headset,
  MessageSquare,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { StatCard } from "@/components/layout/stat-card"
import { PageHeader } from "@/components/layout/page-header"
import { RequestsAreaChart, ChartCard, EscalationsBarChart, LatencyLineChart } from "@/components/charts/chart-cards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { agents, conversations, escalationQueue, latencySeries, requestSeries } from "@/mocks/data"
import { conversationModeTone } from "@/lib/status"
import { timeAgo } from "@/lib/format"

export function AgentDashboardPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Agent console"
        title="Support operations"
        description="Live queue health, AI coverage, and your team's workload."
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

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Open conversations"
          value={12}
          icon={MessageSquare}
          tone="blue"
          delta={{ value: "+3", direction: "up" }}
          hint="vs. yesterday"
        />
        <StatCard
          label="Awaiting agent"
          value={3}
          icon={Clock3}
          tone="amber"
          hint="oldest 9m"
        />
        <StatCard
          label="Resolved today"
          value={24}
          icon={CheckCircle2}
          tone="emerald"
          delta={{ value: "+12%", direction: "up" }}
        />
        <StatCard
          label="AI-handled"
          value="68%"
          icon={Bot}
          tone="violet"
          hint="of all conversations"
        />
        <StatCard
          label="CSAT (7d)"
          value="4.7"
          icon={Star}
          tone="slate"
          hint="142 ratings"
        />
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3.5">
          <ChartCard
            title="Conversation volume"
            description="Requests vs. AI-resolved · last 14 days"
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
            <ChartCard title="Escalations" description="Daily handovers to humans">
              <EscalationsBarChart data={requestSeries} />
            </ChartCard>
            <ChartCard title="Agent latency" description="First token response, ms">
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
              {escalationQueue.map((conversation) => (
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
                      {conversation.assignedAgentId ? "Assigned · Maya" : "Unassigned"}
                    </span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5">
                <Users className="size-4 text-slate-400" /> Team load
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-2.5">
                  <div className="relative">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-slate-100 text-[10.5px] font-semibold text-slate-600">
                        {agent.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${
                        agent.isOnline ? "bg-emerald-400" : "bg-slate-300"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{agent.fullName}</p>
                    <p className="text-[10px] text-muted-foreground">{agent.team}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-semibold tabular">{agent.activeConversations}</p>
                    <p className="text-[9.5px] text-muted-foreground">active</p>
                  </div>
                </div>
              ))}
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
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Ticket</th>
                <th className="px-4 py-2.5 font-semibold">Subject</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Priority</th>
                <th className="px-4 py-2.5 font-semibold">Assigned</th>
                <th className="px-4 py-2.5 text-right font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => (
                <tr key={conversation.id} className="border-b border-border/60 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-[11px]">TKT-{conversation.id.slice(-2).toUpperCase()}</td>
                  <td className="max-w-[260px] truncate px-4 py-2.5 font-medium">{conversation.subject}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge tone={conversationModeTone[conversation.mode]} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">Normal</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {conversation.assignedAgentId ? "Maya Fernandez" : "Unassigned"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] text-muted-foreground">
                    {timeAgo(conversation.lastMessageAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
