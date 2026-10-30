import { Mail, Star, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { agents } from "@/mocks/data"

export function AdminAgentsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Admin · Operations"
        title="Support agents"
        description="Team roster, live workload, and satisfaction scores."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => toast.info("Agent invitations arrive with the API in Milestone 3")}>
            <UserPlus className="size-3.5" /> Invite agent
          </Button>
        }
      />

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
                  {agent.isOnline ? "Online" : "Offline"}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                <div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-muted-foreground">Active conversations</span>
                    <span className="font-semibold tabular">{agent.activeConversations}</span>
                  </div>
                  <Progress value={agent.activeConversations * 20} className="mt-1 h-1" />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Resolved today</span>
                  <span className="font-semibold tabular">{agent.resolvedToday}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">CSAT</span>
                  <span className="inline-flex items-center gap-1 font-semibold tabular">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    {agent.csat?.toFixed(1) ?? "—"}
                  </span>
                </div>
              </div>

              <Button asChild variant="outline" size="sm" className="mt-3 w-full gap-1.5 text-[11.5px]">
                <a href={`mailto:${agent.email}`}>
                  <Mail className="size-3.5" /> Contact
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-3.5">
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px]">Coverage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-[11.5px] sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-slate-50/60 p-2.5">
            <p className="text-muted-foreground">Online now</p>
            <p className="mt-0.5 text-[18px] font-semibold tabular">
              {agents.filter((a) => a.isOnline).length}/{agents.length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-slate-50/60 p-2.5">
            <p className="text-muted-foreground">Open conversations</p>
            <p className="mt-0.5 text-[18px] font-semibold tabular">
              {agents.reduce((sum, a) => sum + a.activeConversations, 0)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-slate-50/60 p-2.5">
            <p className="text-muted-foreground">Resolved today</p>
            <p className="mt-0.5 text-[18px] font-semibold tabular">
              {agents.reduce((sum, a) => sum + a.resolvedToday, 0)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
