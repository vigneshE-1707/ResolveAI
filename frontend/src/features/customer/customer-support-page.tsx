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
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useRole } from "@/app/role-context"
import {
  activity,
  conversations,
  customerOrders,
  customerTickets,
  customers,
  messagesByConversation,
} from "@/mocks/data"
import { useDemoChat } from "@/features/customer/use-demo-chat"
import { conversationModeTone } from "@/lib/status"

export function CustomerSupportPage() {
  const { user } = useRole()
  const customerId = user.customerId ?? "cus_01"
  const customer = customers.find((c) => c.id === customerId) ?? customers[0]
  const myOrders = customerOrders(customer.id)
  const myTickets = customerTickets(customer.id)
  const myConversations = conversations.filter((c) => c.customerId === customer.id)
  const [activeConversationId, setActiveConversationId] = useState(myConversations[0]?.id ?? "conv_01")
  const activeConversation = myConversations.find((c) => c.id === activeConversationId) ?? myConversations[0]
  const conversationId = activeConversation?.id ?? "conv_01"
  const seededMessages = useMemo(
    () => messagesByConversation[conversationId] ?? [],
    [conversationId]
  )
  const { messages, typing, send } = useDemoChat(conversationId, seededMessages)
  const [orderUpdates, setOrderUpdates] = useState(true)

  return (
    <div>
      <HeroBanner />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <ChatPanel
            conversation={activeConversation}
            messages={messages}
            typing={typing}
            onSend={send}
            onSuggestion={send}
            orders={myOrders}
            tickets={myTickets}
            className="h-[620px]"
            headerExtra={
              <StatusBadge
                tone={{ label: "Live chat", variant: "success", dot: "bg-emerald-500" }}
                className="hidden md:flex"
              />
            }
            footerNote="Demo mode · replies are simulated from mock data until the LangGraph agent is connected in Milestone 4"
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
              {myConversations.length > 0 ? (
                <ConversationList
                  conversations={myConversations}
                  activeId={activeConversationId}
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
          <CustomerProfileCard customer={customer} />
          <QuickActions />
          <ActivityTimeline items={activity.slice(0, 4)} showViewAll={false} />

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
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {myOrders.slice(0, 3).map((order) => (
            <OrderCard key={order.id} order={order} compact />
          ))}
        </div>
      </div>

      {activeConversation && (
        <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <ShieldCheck className="size-3" />
          AI actions are scoped to your account. Business operations require confirmation.
          <StatusBadge tone={conversationModeTone[activeConversation.mode]} withDot={false} className="ml-1 h-4 px-1.5 text-[9.5px]" />
        </p>
      )}
    </div>
  )
}
