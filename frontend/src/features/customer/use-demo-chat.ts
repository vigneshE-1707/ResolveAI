import { useCallback, useEffect, useRef, useState } from "react"

import { customers, orders, findOrder } from "@/mocks/data"
import type { ChatMessage } from "@/types"

/**
 * DEMO-ONLY chat simulator.
 *
 * This is NOT the AI backend. It produces deterministic, canned replies from the
 * mock dataset so the UI can be reviewed before Milestone 4 wires the SSE
 * endpoint to the LangGraph agent. The composer and topbar clearly label demo mode.
 * Delete this hook when the real chat client lands.
 */
interface DemoThread {
  messages: ChatMessage[]
  typing: boolean
}

export function useDemoChat(conversationId: string, initialMessages: ChatMessage[]) {
  // One transcript per conversation, so switching threads mid-reply keeps both
  // sides intact. Seeded messages stay a prop: a thread that was never touched
  // reads straight from `initialMessages` instead of being copied into state.
  const [threads, setThreads] = useState<Record<string, DemoThread>>({})
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
    }
  }, [])

  const activeThread = threads[conversationId]
  const messages = activeThread?.messages ?? initialMessages
  const typing = activeThread?.typing ?? false

  const mutateThread = useCallback(
    (id: string, seed: ChatMessage[], updater: (thread: DemoThread) => DemoThread) => {
      setThreads((prev) => {
        const current = prev[id] ?? { messages: seed, typing: false }
        return { ...prev, [id]: updater(current) }
      })
    },
    []
  )

  const send = useCallback(
    (value: string) => {
      const text = value.trim()
      if (!text) return

      const userMessage: ChatMessage = {
        id: `demo_user_${Date.now()}`,
        conversationId,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      }
      const seed = initialMessages
      mutateThread(conversationId, seed, (thread) => ({
        messages: [...thread.messages, userMessage],
        typing: true,
      }))

      const reply = setTimeout(() => {
        mutateThread(conversationId, seed, (thread) => ({
          messages: [...thread.messages, buildDemoReply(text, conversationId)],
          typing: false,
        }))
      }, 1150)
      timers.current.push(reply)
    },
    [conversationId, initialMessages, mutateThread]
  )

  const approve = useCallback(
    (approvalId: string, decision: "granted" | "denied") => {
      const seed = initialMessages
      mutateThread(conversationId, seed, (thread) => ({ ...thread, typing: true }))

      const reply = setTimeout(() => {
        mutateThread(conversationId, seed, (thread) => ({
          messages: [
            ...thread.messages,
            {
              id: `demo_decision_${Date.now()}`,
              conversationId,
              role: "assistant",
              content:
                decision === "granted"
                  ? "Thanks — your return request is approved. I've created the shipping label and emailed it to you. (Demo approval — the real run pauses in LangGraph and resumes in Milestone 7.)"
                  : "No problem — I haven't submitted anything. Let me know if you'd like to review the return policy first.",
              createdAt: new Date().toISOString(),
              authorName: "ResolveAI Assistant",
            },
          ],
          typing: false,
        }))
      }, 900)
      timers.current.push(reply)
      void approvalId
    },
    [conversationId, initialMessages, mutateThread]
  )

  return { messages, typing, send, approve }
}

function buildDemoReply(text: string, conversationId: string): ChatMessage {
  const lower = text.toLowerCase()
  const customer = customers[0]
  const base = {
    id: `demo_ai_${Date.now()}`,
    conversationId,
    role: "assistant" as const,
    createdAt: new Date().toISOString(),
    authorName: "ResolveAI Assistant",
  }

  if (/human|agent|person|specialist|talk to/.test(lower)) {
    return {
      ...base,
      content:
        "I've requested a human specialist for you. An agent will pick this up shortly — average wait is under 10 minutes. Your conversation history moves with you.",
      card: {
        kind: "escalation",
        reason: "Customer requested a human agent",
        queuePosition: 2,
        estimatedWait: "under 10 minutes",
      },
    }
  }

  if (/return|refund|exchange|send.*back/.test(lower)) {
    const order = orders.find((o) => o.returnEligible)
    if (!order) {
      return {
        ...base,
        content:
          "I checked your orders and none are currently within the return window. Would you like me to pull up the return policy details?",
        suggestions: ["Read Return Policy", "Talk to Agent"],
      }
    }
    return {
      ...base,
      content: `Order #${order.orderNumber} is still inside the 30-day return window (ends ${new Date(
        order.returnWindowEndsAt ?? ""
      ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}). The item must be unused and in its original packaging. Shall I start the return?`,
      suggestions: ["Start Return", "Read Return Policy"],
    }
  }

  if (/order|deliver|where|track|status|late|arrive/.test(lower)) {
    const order = findOrder("ORD-1024")
    if (order?.shipment) {
      return {
        ...base,
        content: `I've found order #${order.orderNumber}. It's currently in transit and expected to arrive by ${new Date(
          order.shipment.estimatedDelivery ?? order.shipment.shippedAt
        ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Would you like me to create a support ticket if it doesn't arrive?`,
        card: {
          kind: "order_status",
          orderNumber: order.orderNumber,
          status: order.status,
          carrier: order.shipment.carrier,
          trackingNumber: order.shipment.trackingNumber,
          estimatedDelivery: order.shipment.estimatedDelivery ?? "",
          steps: [
            { label: "Order Placed", at: "Oct 24", state: "done" },
            { label: "Shipped", at: "Oct 26", state: "done" },
            { label: "In Transit", at: "Oct 28", state: "current" },
            { label: "Delivery", at: "Nov 1", state: "upcoming" },
          ],
        },
        suggestions: ["Track Another Order", "Create Ticket", "Talk to Agent"],
      }
    }
  }

  if (/policy|warranty|shipping|faq|how long|window/.test(lower)) {
    return {
      ...base,
      content:
        "Here's what our policy library says: returns are accepted within 30 days of delivery for unused items in original packaging; refunds are issued to the original payment method within 5–7 business days after inspection. (This answer is grounded in the seeded knowledge base; live retrieval arrives in Milestone 6.)",
      suggestions: ["Start Return", "Talk to Agent"],
    }
  }

  return {
    ...base,
    content: `Thanks ${customer.fullName.split(" ")[0]} — I can look up orders, check return or cancellation eligibility, answer policy questions, or hand you to a human agent. Which would you like?`,
    suggestions: ["Where is my order?", "Can I return my product?", "What is your refund policy?", "Connect me with support"],
  }
}
