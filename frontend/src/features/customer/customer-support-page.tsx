import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, MessageSquarePlus, ShieldCheck } from "lucide-react"

import { ActivityTimeline } from "@/components/cards/activity-timeline"
import { CustomerProfileCard } from "@/components/cards/customer-profile-card"
import { OrderCard } from "@/components/cards/order-card"
import { QuickActions } from "@/components/cards/quick-actions"
import { ChatPanel, ConversationList } from "@/components/chat/chat-panel"
import { HeroBanner } from "@/components/chat/hero-banner"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useRole } from "@/app/auth-context"
import { useConversationMessages, useMyAddresses, useMyConversations, useMyOrders, useMyTickets } from "@/lib/api/hooks"
import { useDemoChat } from "@/features/customer/use-demo-chat"
import { timeAgo } from "@/lib/format"
import { conversationModeTone } from "@/lib/status"
import type { ActivityItem, Conversation, Customer } from "@/types"

const DRAFT_CONVERSATION: Omit<Conversation, "customerId"> = {
  id: "draft",
  subject: "New conversation",
  mode: "ai",
  status: "open",
  assignedAgentId: null,
  escalationReason: null,
  lastMessagePreview: "Start a conversation with the assistant",
  lastMessageAt: new Date().toISOString(),
  unread: false,
  aiHandled: true,
  messageCount: 0,
}

export function CustomerSupportPage() {
  const { user } = useRole()
  const ordersQuery = useMyOrders()
  const ticketsQuery = useMyTickets()
  const conversationsQuery = useMyConversations()
  const addresses = useMyAddresses()

  const orders = ordersQuery.data?.data ?? []
  const tickets = ticketsQuery.data?.data ?? []
  const conversations = conversationsQuery.data?.data ?? []
  const defaultAddress = addresses.data?.find((address) => address.isDefault) ?? addresses.data?.[0]

  const [activeConversationId, setActiveConversationId] = useState<string | undefined>()
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0]
  const conversation: Conversation = activeConversation ?? {
    ...DRAFT_CONVERSATION,
    customerId: user.customerId ?? user.id,
  }
  const isDraft = !activeConversation
  const messagesQuery = useConversationMessages(activeConversation?.id)
  const seededMessages = useMemo(() => messagesQuery.data?.data ?? [], [messagesQuery.data])
  const { messages, typing, send } = useDemoChat(conversation.id, seededMessages)
  const [orderUpdates, setOrderUpdates] = useState(true)

  const profile: Customer = {
    id: user.customerId ?? user.id,
    fullName: user.fullName,
    email: user.email,
    phone: "",
    initials: user.initials,
    loyaltyTier: "standard",
    memberSince: "",
    totalOrders: ordersQuery.data?.total ?? orders.length,
    activeTickets: tickets.filter((ticket) =>
      ["open", "in_progress", "pending_customer"].includes(ticket.status)
    ).length,
    city: defaultAddress?.city ?? "",
    country: defaultAddress?.country ?? "",
  }

  const activity: ActivityItem[] = [
    ...orders.slice(0, 2).map((order) => ({
      id: `order-${order.id}`,
      icon: "order" as const,
      label: `Order ${order.orderNumber} · ${order.status}`,
      timestamp: timeAgo(order.placedAt),
      minutesAgo: 0,
      href: `/orders/${order.orderNumber}`,
    })),
    ...tickets.slice(0, 2).map((ticket) => ({
      id: `ticket-${ticket.id}`,
      icon: "ticket" as const,
      label: `${ticket.ticketNumber} · ${ticket.subject}`,
      timestamp: timeAgo(ticket.createdAt),
      minutesAgo: 0,
      href: `/tickets/${ticket.ticketNumber}`,
    })),
  ]

  return (
    <div>
      <HeroBanner />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <ChatPanel
            conversation={conversation}
            messages={messages}
            typing={typing}
            onSend={send}
            onSuggestion={send}
            orders={orders}
            tickets={tickets}
            className="h-[620px]"
            headerExtra={
              <StatusBadge
                tone={{ label: "Simulated replies", variant: "warning", dot: "bg-amber-500" }}
                className="hidden md:flex"
              />
            }
            footerNote="Demo mode · replies are simulated from local data until the LangGraph agent is connected in Milestone 4"
          />

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <MessageSquarePlus className="size-4 text-slate-400" /> Your conversations
              </CardTitle>
              <Link
                to="/tickets"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                View tickets <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              {conversationsQuery.isLoading ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : conversations.length > 0 ? (
                <ConversationList
                  conversations={conversations}
                  activeId={conversation.id}
                  onSelect={setActiveConversationId}
                />
              ) : (
                <p className="py-4 text-center text-[12px] text-muted-foreground">
                  No conversations yet — start one above.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <CustomerProfileCard customer={profile} lastOrderAt={orders[0]?.placedAt} />
          <QuickActions />
          {activity.length > 0 && <ActivityTimeline items={activity} showViewAll={false} />}

          <Card>
            <CardContent className="flex items-center justify-between gap-3 pt-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 text-emerald-500" />
                <div>
                  <Label htmlFor="order-updates" className="text-[12px] font-semibold">
                    Proactive order updates
                  </Label>
                  <p className="text-[10.5px] leading-snug text-muted-foreground">
                    Let the agent message you about delays.
                  </p>
                </div>
              </div>
              <Switch
                id="order-updates"
                checked={orderUpdates}
                onCheckedChange={setOrderUpdates}
                aria-label="Toggle proactive order updates"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Recent orders</h2>
          <Button asChild variant="link" size="sm" className="h-auto p-0 text-[12px]">
            <Link to="/orders" className="gap-1">
              View all <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
        {ordersQuery.isLoading ? (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[88px] rounded-xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-3 py-4 text-center text-[12px] text-muted-foreground">
            No orders on your account yet.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {orders.slice(0, 3).map((order) => (
              <OrderCard key={order.id} order={order} compact />
            ))}
          </div>
        )}
      </div>

      {!isDraft && (
        <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <ShieldCheck className="size-3" />
          AI actions are scoped to your account. Business operations require confirmation.
          <StatusBadge
            tone={conversationModeTone[conversation.mode]}
            withDot={false}
            className="ml-1 h-4 px-1.5 text-[9.5px]"
          />
        </p>
      )}
    </div>
  )
}
