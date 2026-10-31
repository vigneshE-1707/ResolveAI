import { Link } from "react-router-dom"
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock3,
  Headset,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
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
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminAiRuns, useAdminKnowledge, useAdminStats } from "@/lib/api/hooks"
import { categoryBreakdown, latencySeries, requestSeries } from "@/mocks/data"
import { duration } from "@/lib/format"
import { cn } from "@/lib/utils"

const runStatusTone = {
  succeeded: "success",
  failed: "danger",
  interrupted: "warning",
  escalated: "violet",
} as const

export function AdminOverviewPage() {
  const statsQuery = useAdminStats()
  const knowledge = useAdminKnowledge({ pageSize: 4 })
  const aiRuns = useAdminAiRuns({ pageSize: 5 })
  const stats = statsQuery.data

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Platform overview"
        description="Live counts from the support database; charts remain demo series until analytics aggregates land."
        actions={
          <>
            <Badge variant="warning">Charts · demo data</Badge>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/admin/analytics">
                <BarChart3 className="size-3.5" /> Full analytics
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total conversations"
          value={stats?.total_conversations ?? 0}
          icon={MessageSquare}
          tone="blue"
          hint="all time"
        />
        <StatCard
          label="Active conversations"
          value={stats?.active_conversations ?? 0}
          icon={Headset}
          tone="violet"
          hint="not resolved or closed"
        />
        <StatCard
          label="Escalated"
          value={stats?.escalated ?? 0}
          icon={ShieldAlert}
          tone="amber"
          hint="awaiting a human"
        />
        <StatCard
          label="Open tickets"
          value={stats?.open_tickets ?? 0}
          icon={Clock3}
          tone="emerald"
          hint="status open"
        />
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <ChartCard
          title="Support volume & automation"
          description="Requests, AI resolutions, and escalations per day · demo data"
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

        <ChartCard title="Request categories" description="Share of conversations by intent · demo data">
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
        <ChartCard title="Escalations" description="Daily human handovers · demo data">
          <EscalationsBarChart data={requestSeries} />
        </ChartCard>
        <ChartCard title="Agent latency" description="p50 / p95 first token · demo data">
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
            {knowledge.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-6 rounded-md" />
              ))
            ) : knowledge.isError ? (
              <p className="text-[11.5px] text-muted-foreground">Could not load knowledge documents.</p>
            ) : (knowledge.data?.data.length ?? 0) === 0 ? (
              <p className="text-[11.5px] text-muted-foreground">No knowledge documents yet.</p>
            ) : (
              knowledge.data?.data.slice(0, 4).map((doc) => (
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
              ))
            )}
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
            {aiRuns.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-6 rounded-md" />
                ))}
              </div>
            ) : aiRuns.isError ? (
              <p className="px-4 py-4 text-[11.5px] text-muted-foreground">
                Could not load AI executions.
              </p>
            ) : (aiRuns.data?.data.length ?? 0) === 0 ? (
              <p className="px-4 py-4 text-[11.5px] text-muted-foreground">
                No AI executions recorded yet. They appear once the LangGraph agent is connected.
              </p>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-y border-border bg-slate-50/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 font-semibold">Trace</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Model</th>
                    <th className="px-3 py-2 text-right font-semibold">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {aiRuns.data?.data.map((run) => (
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
                      <td className="max-w-[180px] truncate px-3 py-2 font-mono text-[10.5px] text-muted-foreground">
                        {run.model || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular text-muted-foreground">
                        {duration(run.latencyMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
              <p className="font-semibold text-slate-800">Live counts</p>
              <p>
                KPI cards, knowledge readiness, and AI executions come from the API. Time-series and
                category charts still use <span className="font-mono text-[10.5px]">src/mocks/data.ts</span>.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-slate-50/60 px-2.5 py-2">
              <p className="font-semibold text-slate-800">Next data source</p>
              <p>
                Analytics aggregates over{" "}
                <span className="font-mono text-[10.5px]">ai_runs</span>,{" "}
                <span className="font-mono text-[10.5px]">support_tickets</span>, and{" "}
                <span className="font-mono text-[10.5px]">conversations</span> are not implemented yet.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <RefreshCw className="size-3.5" />
              <span>Stats refresh when the page is opened.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
