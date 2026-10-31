import { useState } from "react"
import { Activity, Check, Copy, RefreshCw, Search, Timer, TriangleAlert, Wrench } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/layout/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminAiRuns, useAdminAuditLogs } from "@/lib/api/hooks"
import { duration, formatDateShort, timeAgo } from "@/lib/format"

const runStatusTone = {
  succeeded: { label: "Succeeded", variant: "success", dot: "bg-emerald-500" },
  failed: { label: "Failed", variant: "danger", dot: "bg-red-500" },
  interrupted: { label: "Interrupted", variant: "warning", dot: "bg-amber-500" },
  escalated: { label: "Escalated", variant: "violet", dot: "bg-violet-500" },
} as const

export function AdminMonitoringPage() {
  const [query, setQuery] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  const runsQuery = useAdminAiRuns({ pageSize: 100 })
  const auditQuery = useAdminAuditLogs({ pageSize: 20 })

  const runs = runsQuery.data?.data ?? []
  const failedRun = runs.find((run) => run.status === "failed")

  const visible = runs.filter((run) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      run.traceId.toLowerCase().includes(q) ||
      run.conversationId.toLowerCase().includes(q) ||
      run.model.toLowerCase().includes(q)
    )
  })

  const avgLatency = runs.length
    ? Math.round(runs.reduce((sum, run) => sum + run.latencyMs, 0) / runs.length)
    : 0

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Intelligence"
        title="AI monitoring"
        description="Per-turn executions with latency and token usage, plus the audit trail."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              void runsQuery.refetch()
              void auditQuery.refetch()
            }}
            disabled={runsQuery.isFetching}
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Executions" value={runs.length} icon={Activity} tone="blue" hint="loaded rows" />
        <StatCard
          label="Failed"
          value={runs.filter((run) => run.status === "failed").length}
          icon={TriangleAlert}
          tone="rose"
          hint="model or tool error"
        />
        <StatCard label="Avg latency" value={duration(avgLatency)} icon={Timer} tone="emerald" hint="wall clock per turn" />
        <StatCard
          label="Tokens"
          value={runs.reduce((sum, run) => sum + run.promptTokens + run.completionTokens, 0)}
          icon={Wrench}
          tone="violet"
          hint="prompt + completion"
        />
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter by trace, conversation, model..."
                  className="h-8 pl-8 text-[12px]"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {runsQuery.data?.total ?? runs.length} executions
              </p>
            </div>

            {runsQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 rounded-md" />
                ))}
              </div>
            ) : runsQuery.isError ? (
              <p className="py-8 text-center text-[12px] text-muted-foreground">
                Could not load AI executions.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trace</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="flex items-center gap-1 font-mono text-[10px] text-slate-500 hover:text-primary"
                          onClick={async () => {
                            await navigator.clipboard?.writeText(run.traceId)
                            setCopied(run.id)
                            setTimeout(() => setCopied(null), 1500)
                          }}
                        >
                          {run.traceId.slice(0, 10)}…
                          {copied === run.id ? (
                            <Check className="size-2.5 text-emerald-500" />
                          ) : (
                            <Copy className="size-2.5" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{run.model || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge tone={runStatusTone[run.status]} />
                      </TableCell>
                      <TableCell className="text-right text-[10.5px] tabular text-muted-foreground">
                        {run.promptTokens + run.completionTokens}
                      </TableCell>
                      <TableCell className="text-right text-[11px] tabular">{duration(run.latencyMs)}</TableCell>
                      <TableCell className="text-right text-[10.5px] text-muted-foreground">
                        {formatDateShort(run.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!runsQuery.isLoading && visible.length === 0 && (
              <p className="py-8 text-center text-[12px] text-muted-foreground">
                {runsQuery.isError ? "Could not load executions." : "No executions match that filter."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3.5">
          <Card className="border-rose-200 bg-rose-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-[13.5px] text-rose-900">
                <TriangleAlert className="size-4" /> Failure investigation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0 text-[11.5px] text-rose-900/90">
              {failedRun ? (
                <>
                  <p className="font-mono text-[10.5px]">{failedRun.traceId}</p>
                  <p>
                    <span className="font-semibold">Status:</span> {failedRun.status} · model{" "}
                    {failedRun.model || "unknown"}
                  </p>
                  <p>
                    <span className="font-semibold">Retry:</span> safe read-only turn; the customer
                    message is preserved and no business action executed.
                  </p>
                  <p className="text-[10.5px] opacity-80">
                    LangSmith deep-links arrive when tracing is enabled.
                  </p>
                </>
              ) : (
                <p>No failures recorded.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13.5px]">Audit trail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {auditQuery.isLoading ? (
                <>
                  <Skeleton className="h-8 rounded-md" />
                  <Skeleton className="h-8 rounded-md" />
                  <Skeleton className="h-8 rounded-md" />
                </>
              ) : auditQuery.isError ? (
                <p className="text-[11px] text-muted-foreground">Could not load audit logs.</p>
              ) : (auditQuery.data?.data.length ?? 0) === 0 ? (
                <p className="text-[11px] text-muted-foreground">No audit entries recorded yet.</p>
              ) : (
                auditQuery.data?.data.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-2 text-[11px]">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{log.action}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {log.actorRole ?? "system"} · {log.entityType}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(log.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13.5px]">Trace hygiene</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0 text-[11px] leading-relaxed text-muted-foreground">
              <p>• Trace IDs correlate app logs with LangSmith runs.</p>
              <p>• Tool-call arguments are not yet returned by the AI runs endpoint.</p>
              <p>• Customer message bodies are excluded from exported traces.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
