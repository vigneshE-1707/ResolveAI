import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowRight,
  CheckCheck,
  Headset,
  Info,
  MessagesSquare,
  Search,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react"
import { toast } from "sonner"

import { ChatPanel, ConversationList } from "@/components/chat/chat-panel"
import { EmptyState } from "@/components/feedback/states"
import { StatusBadge } from "@/components/shared/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useRole } from "@/app/auth-context"
import { ApiError } from "@/lib/api/client"
import {
  useAgentConversation,
  useAgentConversations,
  useAgentMessages,
  useAssignConversation,
  useReplyToConversation,
  useResolveConversation,
  useTakeoverConversation,
} from "@/lib/api/hooks"
import { agentApi } from "@/lib/api/endpoints"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { formatDateShort } from "@/lib/format"
import { conversationModeTone, conversationStatusTone } from "@/lib/status"
import { cn } from "@/lib/utils"

const queueFilters = ["all", "escalated", "mine"] as const

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function AgentWorkspacePage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const { user } = useRole()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<(typeof queueFilters)[number]>("all")
  const [query, setQuery] = useState("")

  const queue = useAgentConversations({
    q: query || undefined,
    status: filter === "escalated" ? "escalated" : undefined,
    assigned: filter === "mine" ? user.agentId : undefined,
    pageSize: 50,
  })

  const conversations = queue.data?.data ?? []
  const activeId = conversationId ?? conversations[0]?.id
  const conversationQuery = useAgentConversation(activeId)
  const messagesQuery = useAgentMessages(activeId)
  const activeConversation = conversationQuery.data

  const reply = useReplyToConversation(activeId ?? "")
  const assign = useAssignConversation(activeId ?? "")
  const takeover = useTakeoverConversation(activeId ?? "")
  const resolve = useResolveConversation(activeId ?? "")
  const reopen = useMutation({
    mutationFn: () => agentApi.reopen(activeId ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", "conversation", activeId ?? ""] })
      queryClient.invalidateQueries({ queryKey: ["agent", "conversations"] })
      toast.success("AI re-enabled for this conversation")
    },
    onError: (error) => toast.error(errorMessage(error, "Could not re-enable AI")),
  })

  const messages = useMemo(() => messagesQuery.data?.data ?? [], [messagesQuery.data])
  const isHumanHandled = activeConversation?.mode === "human"
  const isResolved =
    activeConversation?.status === "resolved" || activeConversation?.status === "closed"

  const send = (value: string) => {
    if (!activeId) return
    reply.mutate(value, {
      onError: (error) => toast.error(errorMessage(error, "Could not send the reply")),
    })
  }

  const claim = () => {
    if (!activeId) return
    if (!user.agentId) {
      toast.error("Your account has no agent profile to assign")
      return
    }
    assign.mutate(user.agentId, {
      onSuccess: () => toast.success("Conversation assigned to you"),
      onError: (error) => toast.error(errorMessage(error, "Could not claim the conversation")),
    })
  }

  const takeOver = () => {
    if (!activeId) return
    takeover.mutate(undefined, {
      onSuccess: () => toast.success("AI paused — you own this conversation"),
      onError: (error) => toast.error(errorMessage(error, "Could not take over")),
    })
  }

  const markResolved = () => {
    if (!activeId) return
    resolve.mutate(undefined, {
      onSuccess: () => toast.success("Conversation resolved"),
      onError: (error) => toast.error(errorMessage(error, "Could not resolve the conversation")),
    })
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[560px] flex-col">
      {/* Header */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
            Agent console
          </p>
          <h1 className="text-[19px] font-semibold leading-tight tracking-tight">
            Conversation workspace
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" /> {user.fullName}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!isHumanHandled || reopen.isPending}
                onClick={() => reopen.mutate()}
              >
                <Headset className="size-3.5" /> Re-enable AI
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isHumanHandled ? "Hand the thread back to the assistant" : "AI already handles this thread"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Queue */}
        <Card className="hidden min-h-0 flex-col overflow-hidden lg:flex">
          <div className="border-b border-border p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations..."
                className="h-8 pl-8 text-[12px]"
              />
            </div>
            <div className="mt-2 flex gap-1">
              {queueFilters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={cn(
                    "flex-1 rounded-md px-1.5 py-1 text-[10.5px] font-medium capitalize transition-colors",
                    filter === item
                      ? "bg-blue-50 text-primary"
                      : "text-muted-foreground hover:bg-slate-50"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto p-1.5">
            {queue.isLoading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                activeId={activeId}
                onSelect={(id) => navigate(`/agent/conversations/${id}`)}
              />
            )}
            {!queue.isLoading && conversations.length === 0 && (
              <p className="py-6 text-center text-[11.5px] text-muted-foreground">Nothing in this view.</p>
            )}
          </div>
          <div className="border-t border-border p-2.5 text-[10px] text-muted-foreground">
            <p className="flex items-center gap-1">
              <Info className="size-3" /> AI is paused for escalated threads.
            </p>
          </div>
        </Card>

        {/* Transcript */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          {!activeConversation ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card">
              <EmptyState
                icon={MessagesSquare}
                title="No conversation selected"
                description="Pick a thread from the queue to see its transcript."
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[10.5px] font-semibold text-white">
                      CU
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold leading-tight">
                      {activeConversation.subject}
                    </p>
                    <p className="truncate text-[10.5px] text-muted-foreground">
                      Customer {activeConversation.customerId.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge tone={conversationModeTone[activeConversation.mode]} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="xs"
                        className="gap-1"
                        disabled={assign.isPending || activeConversation.assignedAgentId === user.agentId}
                        onClick={claim}
                      >
                        <UserRoundCheck className="size-3" /> Claim
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {activeConversation.assignedAgentId === user.agentId
                        ? "Already assigned to you"
                        : "Assign this conversation to you"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="soft"
                        size="xs"
                        className="gap-1"
                        disabled={resolve.isPending || isResolved}
                        onClick={markResolved}
                      >
                        <CheckCheck className="size-3" /> Resolve
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isResolved ? "Already resolved" : "Close the conversation as resolved"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <ChatPanel
                conversation={activeConversation}
                messages={messages}
                typing={messagesQuery.isLoading}
                onSend={send}
                className="min-h-0 flex-1"
                composerHint={
                  isHumanHandled
                    ? reply.isPending
                      ? "Sending reply…"
                      : "Replying as a human agent"
                    : "AI is handling this thread — take over before replying"
                }
              />
            </>
          )}
        </div>

        {/* Context rail */}
        <div className="scrollbar-slim hidden min-h-0 space-y-2.5 overflow-y-auto xl:block">
          {activeConversation?.escalationReason && (
            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="pt-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
                  <ShieldAlert className="size-3.5" /> Escalation reason
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-amber-800">
                  {activeConversation.escalationReason}
                </p>
                <p className="mt-1.5 text-[10px] text-amber-700/80">
                  Escalated{" "}
                  {formatDateShort(
                    activeConversation.escalatedAt ??
                      activeConversation.updatedAt ??
                      activeConversation.lastMessageAt
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13.5px]">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0 text-[11.5px]">
              <p className="font-mono text-[11px] text-slate-800">
                {activeConversation?.customerId ?? "—"}
              </p>
              <p className="text-muted-foreground">
                Customer profile details are not exposed to agents yet.
              </p>
            </CardContent>
          </Card>

          {activeConversation && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13.5px]">
                  <MessagesSquare className="size-3.5 text-slate-400" /> Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0 text-[11.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="font-medium">
                    {activeConversation.assignedAgentId === user.agentId
                      ? "You"
                      : activeConversation.assignedAgentId
                        ? "Another agent"
                        : "Unassigned"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge tone={conversationStatusTone[activeConversation.status]} withDot={false} />
                </div>
                <Separator className="my-1" />
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-[11px]"
                    disabled={takeover.isPending || isHumanHandled}
                    onClick={takeOver}
                  >
                    <Headset className="size-3.5" /> Take over
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-[11px]"
                    disabled
                    title="Reassigning to another agent is not available yet"
                  >
                    Reassign
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ShieldAlert className="size-3" />
          Sensitive actions require approval. AI cannot act on escalated threads.
        </span>
        <Link to="/agent" className="flex items-center gap-1 font-medium text-primary hover:underline">
          Back to console <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}
