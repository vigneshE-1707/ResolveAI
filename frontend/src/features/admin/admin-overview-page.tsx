import { Link } from "react-router-dom"
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Clock3,
  Headset,
  RefreshCw,
  ShieldAlert,
  Timer,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react"

import {
  CategoryDonut,
  ChartCard,
  EscalationsBarChart,
  LatencyLineChart,
  LegendDots,
  RequestsAreaChart,
} from "@/components/charts/chart-cards"
import { StatCard } from "@/components/layout/stat-card"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  aiRuns,
  categoryBreakdown,
  knowledgeDocuments,
  latencySeries,
  requestSeries,
} from "@/mocks/data"
import { duration } from "@/lib/format"
import { cn } from "@/lib/utils"

function summarize() {
  const requests = requestSeries.reduce((sum, point) => sum + point.requests, 0)
  const aiResolved = requestSeries.reduce((sum, point) => sum + point.aiResolved, 0)
  const escalated = requestSeries.reduce((sum, point) => sum + point.escalated, 0)
  return {
    requests,
    aiResolved,
    escalated,
    aiRate: Math.round((aiResolved / requests) * 100),
    escalationRate: ((escalated / requests) * 100).toFixed(1),
  }
}

const runStatusTone = {
  succeeded: "success",
  failed: "danger",
  interrupted: "warning",
  escalated: "violet",
} as const

export function AdminOverviewPage() {
  const stats = summarize()
  const failedRuns = aiRuns.filter((r) => r.status === "failed").length

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Platform overview"
        description="Support performance across the demo dataset — every number is derived from stored records."
        actions={
          <>
            <Badge variant="warning">Last 14 days · demo data</Badge>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/admin/analytics">
                <BarChart3 className="size-3.5" /> Full analytics
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Support requests" value={stats.requests.toLocaleString()} icon={Headset} tone="blue" delta={{ value: "+8.2%", direction: "up" }} hint="14-day total" />
        <StatCard label="AI resolution rate" value={`${stats.aiRate}%`} icon={Bot} tone="violet" delta={{ value: "+4.1pt", direction: "up" }} hint="vs. prior period" />
        <StatCard label="Escalation rate" value={`${stats.escalationRate}%`} icon={ShieldAlert} tone="amber" delta={{ value: "-1.3pt", direction: "down" }} hint="lower is better" />
        <StatCard label="Avg first response" value="1.9s" icon={Timer} tone="emerald" delta={{ value: "-0.4s", direction: "down" }} hint="AI first token" />
        <StatCard label="Avg ticket resolution" value="6.4h" icon={Clock3} tone="slate" hint="human-handled" />
        <StatCard label="Failed AI executions" value={failedRuns} icon={RefreshCw} tone="rose" hint="last 14 days" />
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <ChartCard
          title="Support volume & automation"
          description="Requests, AI resolutions, and escalations per day"
          action={
            <LegendDots
              items={[
                { label: "Requests", color: "#2563eb" },
                { label: "AI resolved", color: "#7c3aed" },
                { label: "Escalated", color: "#f59e0b" },
              ]}
            />
          }
        >
          <RequestsAreaChart data={requestSeries} height={230} />
        </ChartCard>

        <ChartCard title="Request categories" description="Share of conversations by intent">
          <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-2">
            <CategoryDonut data={categoryBreakdown} height={170} />
            <ul className="space-y-1.5">
              {categoryBreakdown.map((item) => (
                <li key={item.name} className="flex items-center gap-1.5 text-[11px]">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
                  <span className="font-semibold tabular">{item.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-3">
        <ChartCard title="Escalations" description="Daily human handovers">
          <EscalationsBarChart data={requestSeries} />
        </ChartCard>
        <ChartCard title="Agent latency" description="p50 / p95 first token">
          <LatencyLineChart data={latencySeries} />
        </ChartCard>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5">
              <Activity className="size-4 text-slate-400" /> Knowledge readiness
            </CardTitle>
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-[11px]">
              <Link to="/admin/knowledge" className="gap-1">
                Manage <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {knowledgeDocuments.slice(0, 4).map((doc) => (
              <div key={doc.id}>
                <div className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="truncate font-medium text-slate-700">{doc.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {doc.status === "ready" ? `${doc.chunkCount} chunks` : doc.status}
                  </span>
                </div>
                <Progress
                  value={doc.status === "ready" ? 100 : 35}
                  className="mt-1 h-1"
                  indicatorClassName={cn(
                    doc.status === "ready" ? "bg-emerald-500" : "bg-amber-500"
                  )}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1.5">
              <Wrench className="size-4 text-slate-400" /> Recent AI executions
            </CardTitle>
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-[11px]">
              <Link to="/admin/monitoring" className="gap-1">
                Monitor <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-y border-border bg-slate-50/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Trace</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Tools</th>
                  <th className="px-3 py-2 text-right font-semibold">Latency</th>
                </tr>
              </thead>
              <tbody>
                {aiRuns.slice(0, 5).map((run) => (
                  <tr key={run.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 font-mono text-[10.5px] text-slate-500">
                      {run.traceId.slice(0, 12)}…
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        tone={{
                          label: run.status,
                          variant: runStatusTone[run.status],
                          dot:
                            run.status === "succeeded"
                              ? "bg-emerald-500"
                              : run.status === "failed"
                                ? "bg-red-500"
                                : run.status === "escalated"
                                  ? "bg-violet-500"
                                  : "bg-amber-500",
                        }}
                        className="capitalize"
                      />
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 font-mono text-[10.5px] text-muted-foreground">
                      {run.toolCalls.length ? run.toolCalls.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-muted-foreground">
                      {duration(run.latencyMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5">
              <TrendingUp className="size-4 text-slate-400" /> Operational notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-[11.5px] leading-relaxed text-muted-foreground">
            <div className="rounded-lg border border-border bg-slate-50/60 px-2.5 py-2">
              <p className="font-semibold text-slate-800">Demo dataset</p>
              <p>
                Records are seeded fixtures in <span className="font-mono text-[10.5px]">src/mocks/data.ts</span>.
                Nothing here is generated by a live model yet.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-slate-50/60 px-2.5 py-2">
              <p className="font-semibold text-slate-800">Next data source</p>
              <p>
                Milestone 3 replaces these aggregates with SQL over{" "}
                <span className="font-mono text-[10.5px]">ai_runs</span>,{" "}
                <span className="font-mono text-[10.5px]">support_tickets</span>, and{" "}
                <span className="font-mono text-[10.5px]">conversations</span>.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Users className="size-3.5" />
              <span>4 agents · 3 online</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
