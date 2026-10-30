import { useState } from "react"
import { Activity, Check, Copy, RefreshCw, Search, Timer, TriangleAlert, Wrench } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/layout/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { aiRuns } from "@/mocks/data"
import { duration, formatDateShort } from "@/lib/format"
import { cn } from "@/lib/utils"

const runStatusTone = {
  succeeded: { label: "Succeeded", variant: "success", dot: "bg-emerald-500" },
  failed: { label: "Failed", variant: "danger", dot: "bg-red-500" },
  interrupted: { label: "Interrupted", variant: "warning", dot: "bg-amber-500" },
  escalated: { label: "Escalated", variant: "violet", dot: "bg-violet-500" },
} as const

export function AdminMonitoringPage() {
  const [query, setQuery] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  const failedRun = aiRuns.find((run) => run.status === "failed")

  const visible = aiRuns.filter((run) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      run.traceId.toLowerCase().includes(q) ||
      run.conversationId.toLowerCase().includes(q) ||
      run.toolCalls.some((tool) => tool.toLowerCase().includes(q))
    )
  })

  const avgLatency = Math.round(aiRuns.reduce((sum, run) => sum + run.latencyMs, 0) / aiRuns.length)

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Intelligence"
        title="AI monitoring"
        description="Per-turn executions with latency, token usage, tool calls, and trace correlation."
        actions={<Badge variant="warning">Demo data</Badge>}
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Executions (14d)" value={aiRuns.length} icon={Activity} tone="blue" hint="sampled rows" />
        <StatCard label="Failed" value={aiRuns.filter((r) => r.status === "failed").length} icon={TriangleAlert} tone="rose" hint="model timeout" />
        <StatCard label="Avg latency" value={duration(avgLatency)} icon={Timer} tone="emerald" hint="wall clock per turn" />
        <StatCard label="Tool calls" value={aiRuns.reduce((sum, r) => sum + r.toolCalls.length, 0)} icon={Wrench} tone="violet" hint="MCP invocations" />
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
                  placeholder="Filter by trace, conversation, tool..."
                  className="h-8 pl-8 text-[12px]"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Live refresh arrives in Milestone 9")}>
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trace</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tools</TableHead>
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
                        {copied === run.id ? <Check className="size-2.5 text-emerald-500" /> : <Copy className="size-2.5" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{run.model}</TableCell>
                    <TableCell><StatusBadge tone={runStatusTone[run.status]} /></TableCell>
                    <TableCell className="max-w-[240px]">
                      <div className="flex flex-wrap gap-1">
                        {run.toolCalls.length ? (
                          run.toolCalls.map((tool, index) => (
                            <span
                              key={`${tool}-${index}`}
                              className={cn(
                                "rounded border border-border bg-slate-50 px-1 py-0.5 font-mono text-[9.5px] text-slate-500"
                              )}
                            >
                              {tool}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10.5px] text-muted-foreground">—</span>
                        )}
                      </div>
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
            {visible.length === 0 && (
              <p className="py-8 text-center text-[12px] text-muted-foreground">No executions match that filter.</p>
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
                    <span className="font-semibold">Cause:</span> model request timed out after 30s
                    (upstream 503).
                  </p>
                  <p>
                    <span className="font-semibold">Retry:</span> safe read-only turn; the customer
                    message is preserved and no business action executed.
                  </p>
                  <p className="text-[10.5px] opacity-80">
                    LangSmith trace deep-link is added in Milestone 9 when tracing is enabled.
                  </p>
                </>
              ) : (
                <p>No failures recorded.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13.5px]">Trace hygiene</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0 text-[11px] leading-relaxed text-muted-foreground">
              <p>• Trace IDs correlate app logs with LangSmith runs.</p>
              <p>• Customer message bodies are excluded from exported traces.</p>
              <p>• Tool arguments are logged with order numbers only, never addresses.</p>
              <p className="rounded-md border border-border bg-slate-50/60 px-2 py-1.5">
                Implementation lands in Milestone 4/9; this screen currently reads the demo fixture.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
