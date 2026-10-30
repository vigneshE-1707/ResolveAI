import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowRight,
  CheckCheck,
  CornerDownRight,
  Headset,
  Info,
  MessagesSquare,
  Search,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react"
import { toast } from "sonner"

import { ActivityTimeline } from "@/components/cards/activity-timeline"
import { ChatPanel, ConversationList } from "@/components/chat/chat-panel"
import { OrderCard } from "@/components/cards/order-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDemoChat } from "@/features/customer/use-demo-chat"
import { formatDateShort } from "@/lib/format"
import { conversationModeTone, conversationStatusTone } from "@/lib/status"
import { cn } from "@/lib/utils"
import {
  activity,
  agents,
  conversations,
  customerOrders,
  customers,
  findAgent,
  messagesByConversation,
} from "@/mocks/data"

const queueFilters = ["all", "escalated", "assigned"] as const

export function AgentWorkspacePage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<(typeof queueFilters)[number]>("all")
  const [query, setQuery] = useState("")

  const activeConversation =
    conversations.find((c) => c.id === conversationId) ?? conversations[0]
  const customer = customers.find((c) => c.id === activeConversation.customerId) ?? customers[0]
  const orders = customerOrders(customer.id)
  const agent = activeConversation.assignedAgentId
    ? findAgent(activeConversation.assignedAgentId)
    : null

  const seededMessages = useMemo(
    () => messagesByConversation[activeConversation.id] ?? [],
    [activeConversation.id]
  )
  const { messages, typing, send } = useDemoChat(activeConversation.id, seededMessages)

  const filtered = useMemo(() => {
    return conversations.filter((conversation) => {
      if (filter === "escalated" && conversation.status !== "escalated") return false
      if (filter === "assigned" && !conversation.assignedAgentId) return false
      if (query) {
        const q = query.toLowerCase()
        return (
          conversation.subject.toLowerCase().includes(q) ||
          conversation.lastMessagePreview.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [filter, query])

  const isHumanHandled = activeConversation.mode === "human"

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
            <span className="size-1.5 rounded-full bg-emerald-500" /> Maya · online
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("AI re-enable is wired in Milestone 7 (explicit, audited action)")}
          >
            <Headset className="size-3.5" /> Re-enable AI
          </Button>
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
            <ConversationList
              conversations={filtered}
              activeId={activeConversation.id}
              onSelect={(id) => navigate(`/agent/conversations/${id}`)}
            />
            {filtered.length === 0 && (
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
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-8">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[10.5px] font-semibold text-white">
                  {customer.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold leading-tight">{customer.fullName}</p>
                <p className="truncate text-[10.5px] text-muted-foreground">{activeConversation.subject}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusBadge tone={conversationModeTone[activeConversation.mode]} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="xs" className="gap-1" onClick={() => toast.success("Conversation claimed (demo)")}>
                    <UserRoundCheck className="size-3" /> Claim
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Assignment persists in Milestone 8</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="soft"
                    size="xs"
                    className="gap-1"
                    onClick={() => toast.success("Conversation resolved (demo)")}
                  >
                    <CheckCheck className="size-3" /> Resolve
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Resolution writes an audit event in Milestone 8</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <ChatPanel
            conversation={activeConversation}
            messages={messages}
            typing={typing}
            onSend={send}
            onSuggestion={send}
            orders={orders}
            className="min-h-0 flex-1"
            composerHint={
              isHumanHandled
                ? "You are replying as a human agent (demo)"
                : "Demo mode — transcript is from mock data until Milestone 4/8"
            }
          />
        </div>

        {/* Context rail */}
        <div className="scrollbar-slim hidden min-h-0 space-y-2.5 overflow-y-auto xl:block">
          {activeConversation.escalationReason && (
            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="pt-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
                  <ShieldAlert className="size-3.5" /> Escalation reason
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-amber-800">
                  {activeConversation.escalationReason}
                </p>
                <p className="mt-1.5 text-[10px] text-amber-700/80">
                  Escalated {formatDateShort(activeConversation.lastMessageAt)}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13.5px]">Customer</CardTitle>
              <Link to="/admin/customers" className="text-[10.5px] font-medium text-primary hover:underline">
                Profile
              </Link>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0 text-[11.5px]">
              <p className="font-semibold text-slate-800">{customer.fullName}</p>
              <p className="text-muted-foreground">{customer.email}</p>
              <p className="text-muted-foreground">{customer.phone}</p>
              <Separator className="my-1.5" />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Loyalty</span>
                <Badge variant="premium" className="capitalize">{customer.loyaltyTier}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total orders</span>
                <span className="font-semibold tabular">{customer.totalOrders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Open tickets</span>
                <span className="font-semibold tabular">{customer.activeTickets}</span>
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[12px] font-semibold">Related orders</p>
              <Link to="/admin/orders" className="text-[10.5px] text-primary hover:underline">
                All orders
              </Link>
            </div>
            <div className="space-y-2">
              {orders.slice(0, 2).map((order) => (
                <OrderCard key={order.id} order={order} compact />
              ))}
            </div>
          </div>

          <ActivityTimeline items={activity.slice(0, 3)} showViewAll={false} title="Recent activity" />

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
                  {agent ? agent.fullName : "Unassigned"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge tone={conversationStatusTone[activeConversation.status]} withDot={false} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Team</span>
                <span className="font-medium">{agent?.team ?? "—"}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-1 w-full gap-1.5 text-[11.5px]"
                onClick={() => toast.info("Assignment API lands in Milestone 8")}
              >
                <CornerDownRight className="size-3.5" /> Reassign
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Team online
              </p>
              <div className="mt-1.5 flex -space-x-1.5">
                {agents.map((item) => (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <Avatar className="size-7 ring-2 ring-white">
                        <AvatarFallback className="bg-slate-100 text-[9.5px] font-semibold text-slate-600">
                          {item.initials}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      {item.fullName} · {item.isOnline ? "online" : "offline"}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>
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
