import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Headset, MessageSquare, Package, Search, Ticket, type LucideIcon } from "lucide-react"

import { ChatMessageBubble, MessageComposer, TypingIndicator } from "@/components/chat/chat-message"
import { OrderCard } from "@/components/cards/order-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { conversationModeTone } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { ChatMessage, Conversation, Order, Ticket as TicketType } from "@/types"
import { TicketCard } from "@/components/cards/ticket-card"

type ChatTab = "chat" | "tickets" | "orders"

interface ChatPanelProps {
  conversation: Conversation
  messages: ChatMessage[]
  typing?: boolean
  onSend: (value: string) => void
  onSuggestion?: (value: string) => void
  orders?: Order[]
  tickets?: TicketType[]
  className?: string
  composerHint?: string
  headerExtra?: ReactNode
  footerNote?: string
}

export function ChatPanel({
  conversation,
  messages,
  typing = false,
  onSend,
  onSuggestion,
  orders = [],
  tickets = [],
  className,
  composerHint,
  headerExtra,
  footerNote,
}: ChatPanelProps) {
  const [tab, setTab] = useState<ChatTab>("chat")
  const [orderQuery, setOrderQuery] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const filteredOrders = useMemo(() => {
    if (!orderQuery.trim()) return orders
    const q = orderQuery.toLowerCase()
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.items.some((item) => item.name.toLowerCase().includes(q))
    )
  }, [orderQuery, orders])

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, typing, tab])

  const tabs: { id: ChatTab; label: string; icon: LucideIcon; count?: number }[] = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "tickets", label: "Tickets", icon: Ticket, count: tickets.length },
    { id: "orders", label: "Order Lookup", icon: Package },
  ]

  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex items-center gap-0.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "relative flex h-11 items-center gap-1.5 px-2.5 text-[13px] font-medium transition-colors",
                tab === item.id
                  ? "text-primary after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
              {typeof item.count === "number" && item.count > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {headerExtra}
          <StatusBadge tone={conversationModeTone[conversation.mode]} className="hidden sm:flex" />
        </div>
      </div>

      {/* Chat tab */}
      {tab === "chat" && (
        <>
          <div ref={scrollRef} className="scrollbar-slim min-h-0 flex-1 space-y-3.5 overflow-y-auto px-3.5 py-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50">
                  <Headset className="size-6 text-indigo-500" />
                </div>
                <p className="text-[14px] font-semibold">Start a conversation</p>
                <p className="max-w-xs text-[12px] text-muted-foreground">
                  Ask about an order, a return, or a policy — the assistant will look it up in your
                  account.
                </p>
              </div>
            )}
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} onSuggestion={onSuggestion} />
            ))}
            {typing && <TypingIndicator />}
          </div>
          <MessageComposer onSend={onSend} placeholder="Type your message..." hint={composerHint} />
          {footerNote && (
            <p className="border-t border-border bg-slate-50/60 px-3 py-1.5 text-center text-[10px] text-muted-foreground">
              {footerNote}
            </p>
          )}
        </>
      )}

      {/* Tickets tab */}
      {tab === "tickets" && (
        <div className="scrollbar-slim min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {tickets.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <Ticket className="size-6 text-slate-300" />
              <p className="text-[13px] font-medium">No tickets yet</p>
              <p className="text-[11.5px] text-muted-foreground">
                Tickets created from chat appear here.
              </p>
            </div>
          ) : (
            tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} compact />)
          )}
        </div>
      )}

      {/* Order lookup tab */}
      {tab === "orders" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={orderQuery}
                onChange={(event) => setOrderQuery(event.target.value)}
                placeholder="Search by order number or product..."
                className="h-8 pl-8 text-[12px]"
              />
            </div>
          </div>
          <div className="scrollbar-slim min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {filteredOrders.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-muted-foreground">No matching orders.</p>
            ) : (
              filteredOrders.map((order) => <OrderCard key={order.id} order={order} compact />)
            )}
          </div>
          <div className="border-t border-border px-3 py-2">
            <Button
              variant="soft"
              size="sm"
              className="w-full gap-1.5 text-[12px]"
              onClick={() => setTab("chat")}
            >
              <MessageSquare className="size-3.5" /> Ask the assistant instead
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  className,
}: {
  conversations: Conversation[]
  activeId?: string
  onSelect?: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {conversations.map((conversation) => {
        const active = conversation.id === activeId
        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelect?.(conversation.id)}
            className={cn(
              "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
              active
                ? "border-blue-200 bg-blue-50/70"
                : "border-transparent hover:border-border hover:bg-slate-50"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[12.5px] font-semibold text-slate-800">
                {conversation.subject}
              </p>
              {conversation.unread && <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {conversation.lastMessagePreview}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <StatusBadge tone={conversationModeTone[conversation.mode]} withDot={false} className="h-4 px-1.5 text-[9.5px]" />
              {conversation.assignedAgentId && (
                <Badge variant="violet" className="h-4 px-1.5 text-[9.5px]">
                  Assigned
                </Badge>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
