import { fireEvent, render, screen } from "@testing-library/react"

import { ChatMessageBubble, TypingIndicator } from "./chat-message"
import type { ChatMessage } from "@/types"

const assistantMessage: ChatMessage = {
  id: "m1",
  conversationId: "conv_01",
  role: "assistant",
  content: "I found order ORD-1024. It is in transit.",
  createdAt: "2026-10-30T10:24:00Z",
  authorName: "ResolveAI Assistant",
  card: {
    kind: "order_status",
    orderNumber: "ORD-1024",
    status: "shipped",
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    estimatedDelivery: "2026-11-01T20:00:00Z",
    steps: [
      { label: "Order Placed", at: "Oct 24", state: "done" },
      { label: "Shipped", at: "Oct 26", state: "done" },
      { label: "In Transit", at: "Oct 28", state: "current" },
      { label: "Delivery", at: "Nov 1", state: "upcoming" },
    ],
  },
  suggestions: ["Create Ticket", "Talk to Agent"],
}

describe("ChatMessageBubble", () => {
  it("renders the grounded order card with tracking steps", () => {
    render(<ChatMessageBubble message={assistantMessage} />)

    expect(screen.getByText("ResolveAI Assistant")).toBeInTheDocument()
    expect(screen.getByText("#ORD-1024")).toBeInTheDocument()
    expect(screen.getByText("In Transit")).toBeInTheDocument()
    expect(screen.getByText(/get_order_info/)).toBeInTheDocument()
  })

  it("passes suggestion clicks to the handler", () => {
    const onSuggestion = vi.fn()
    render(<ChatMessageBubble message={assistantMessage} onSuggestion={onSuggestion} />)

    fireEvent.click(screen.getByRole("button", { name: "Talk to Agent" }))
    expect(onSuggestion).toHaveBeenCalledWith("Talk to Agent")
  })

  it("renders a user bubble with a timestamp", () => {
    render(
      <ChatMessageBubble
        message={{
          id: "m2",
          conversationId: "conv_01",
          role: "user",
          content: "Where is my order?",
          createdAt: "2026-10-30T10:23:00Z",
        }}
      />
    )

    expect(screen.getByText("Where is my order?")).toBeInTheDocument()
    // Local time formatting is timezone-dependent, so assert the shape only.
    expect(screen.getByText(/^\d{1,2}:\d{2}\s(AM|PM)$/)).toBeInTheDocument()
  })
})

describe("TypingIndicator", () => {
  it("announces that the agent is working", () => {
    render(<TypingIndicator />)
    expect(screen.getByText("Checking your account…")).toBeInTheDocument()
  })
})
