import {
  CategoryDonut,
  ChartCard,
  EscalationsBarChart,
  LatencyLineChart,
  LegendDots,
  RequestsAreaChart,
} from "@/components/charts/chart-cards"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/layout/stat-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Bot,
  Clock3,
  Headset,
  MessageSquareX,
  ShieldAlert,
  Timer,
} from "lucide-react"
import { categoryBreakdown, latencySeries, requestSeries } from "@/mocks/data"

export function AdminAnalyticsPage() {
  const requests = requestSeries.reduce((sum, p) => sum + p.requests, 0)
  const resolved = requestSeries.reduce((sum, p) => sum + p.aiResolved, 0)
  const escalated = requestSeries.reduce((sum, p) => sum + p.escalated, 0)

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Intelligence"
        title="Support analytics"
        description="Business metrics from conversation and ticket records. Demo dataset, 14-day window."
        actions={<Badge variant="warning">Demo data</Badge>}
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Requests" value={requests.toLocaleString()} icon={Headset} tone="blue" />
        <StatCard label="AI resolved" value={resolved.toLocaleString()} icon={Bot} tone="violet" hint={`${Math.round((resolved / requests) * 100)}% of total`} />
        <StatCard label="Escalated" value={escalated.toLocaleString()} icon={ShieldAlert} tone="amber" hint={`${((escalated / requests) * 100).toFixed(1)}% of total`} />
        <StatCard label="Avg first response" value="1.9s" icon={Timer} tone="emerald" />
        <StatCard label="Avg resolution" value="6.4h" icon={Clock3} tone="slate" />
        <StatCard label="Abandoned" value="23" icon={MessageSquareX} tone="rose" hint="customer left before reply" />
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title="Volume & automation"
          description="Daily requests vs. AI resolutions"
          action={
            <LegendDots
              items={[
                { label: "Requests", color: "#2563eb" },
                { label: "AI resolved", color: "#7c3aed" },
              ]}
            />
          }
        >
          <RequestsAreaChart data={requestSeries} height={250} />
        </ChartCard>
        <ChartCard title="Intent distribution" description="Share of support requests">
          <div className="grid grid-cols-[160px_minmax(0,1fr)] items-center">
            <CategoryDonut data={categoryBreakdown} height={190} />
            <ul className="space-y-1.5">
              {categoryBreakdown.map((item) => (
                <li key={item.name} className="text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-semibold tabular">{item.value}%</span>
                  </div>
                  <Progress value={item.value} className="mt-0.5 h-1" indicatorClassName="" />
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <ChartCard title="Escalation trend" description="Daily human handovers">
          <EscalationsBarChart data={requestSeries} height={210} />
        </ChartCard>
        <ChartCard title="Response latency" description="p50 / p95 first token (ms)">
          <LatencyLineChart data={latencySeries} height={210} />
        </ChartCard>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px]">Category performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-y border-border bg-slate-50/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 text-right font-semibold">Requests</th>
                  <th className="px-3 py-2 text-right font-semibold">AI resolved</th>
                  <th className="px-3 py-2 text-right font-semibold">Escalated</th>
                  <th className="px-4 py-2 text-right font-semibold">Automation</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map((item) => {
                  const count = Math.round((requests * item.value) / 100)
                  const aiResolved = Math.round(count * (item.value > 20 ? 0.78 : 0.55))
                  const escalatedCount = Math.max(1, Math.round(count * 0.09))
                  return (
                    <tr key={item.name} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2 font-medium">{item.name}</td>
                      <td className="px-3 py-2 text-right tabular">{count}</td>
                      <td className="px-3 py-2 text-right tabular">{aiResolved}</td>
                      <td className="px-3 py-2 text-right tabular">{escalatedCount}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular text-emerald-600">
                        {Math.round((aiResolved / count) * 100)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px]">Metric definitions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-[11px] leading-relaxed text-muted-foreground">
            <p><span className="font-semibold text-slate-700">AI resolution rate</span> — conversations closed without human handover.</p>
            <p><span className="font-semibold text-slate-700">Escalation rate</span> — conversations moved to a human queue.</p>
            <p><span className="font-semibold text-slate-700">First response</span> — time to first streamed token.</p>
            <p><span className="font-semibold text-slate-700">Resolution time</span> — ticket open → resolved timestamp.</p>
            <p className="rounded-md border border-border bg-slate-50/60 px-2 py-1.5">
              These definitions will be implemented as SQL aggregates in Milestone 9; the current values
              are computed from the demo fixture.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
