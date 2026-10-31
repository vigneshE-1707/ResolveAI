import { UserPlus } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminAgents } from "@/lib/api/hooks"

export function AdminAgentsPage() {
  const agentsQuery = useAdminAgents({ pageSize: 100 })
  const agents = agentsQuery.data?.data ?? []
  const activeAgents = agents.filter((agent) => agent.isOnline)

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Operations"
        title="Support agents"
        description="Team roster and account status. Workload and satisfaction metrics are not available yet."
        actions={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("Agent invitations are not available yet")}
          >
            <UserPlus className="size-3.5" /> Invite agent
          </Button>
        }
      />

      {agentsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : agentsQuery.isError ? (
        <Card>
          <CardContent className="pt-4 text-[12px] text-muted-foreground">
            Could not load the agent roster.
          </CardContent>
        </Card>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="pt-4 text-[12px] text-muted-foreground">
            No support agents have been created yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[12px] font-semibold text-white">
                          {agent.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${
                          agent.isOnline ? "bg-emerald-400" : "bg-slate-300"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{agent.fullName}</p>
                      <p className="truncate text-[10.5px] text-muted-foreground">{agent.team}</p>
                    </div>
                  </div>
                  <Badge variant={agent.isOnline ? "success" : "outline"}>
                    {agent.isOnline ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Email, active conversations, and CSAT are not exposed by the agent endpoint yet.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-3.5">
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px]">Coverage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-[11.5px] sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-slate-50/60 p-2.5">
            <p className="text-muted-foreground">Active accounts</p>
            <p className="mt-0.5 text-[18px] font-semibold tabular">
              {activeAgents.length}/{agents.length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-slate-50/60 p-2.5">
            <p className="text-muted-foreground">Teams</p>
            <p className="mt-0.5 text-[18px] font-semibold tabular">
              {new Set(agents.map((agent) => agent.team)).size}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-slate-50/60 p-2.5">
            <p className="text-muted-foreground">Live workload</p>
            <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">Not available</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
