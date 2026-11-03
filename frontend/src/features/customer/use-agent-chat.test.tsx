import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

import type { ChatMessage } from "@/types"
import type { SseFrame } from "@/lib/api/client"

import { useAgentChat } from "./use-agent-chat"

const chatStream = vi.fn()

vi.mock("@/lib/api/endpoints", () => ({
  customerApi: {
    chatStream: (...args: unknown[]) => chatStream(...args),
  },
}))

const seed: ChatMessage[] = [
  {
    id: "seed_1",
    conversationId: "conv_a",
    role: "user",
    content: "Hi, I need help with an order.",
    createdAt: "2026-10-26T09:00:00.000Z",
  },
]

function streamOf(...frames: SseFrame[]) {
  return (async function* generate() {
    for (const frame of frames) yield frame
  })()
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function renderChat(
  props: Partial<Parameters<typeof useAgentChat>[0]> = {}
) {
  return renderHook(
    () =>
      useAgentChat({
        conversationId: "conv_a",
        seedMessages: seed,
        ensureConversation: async () => "conv_new",
        ...props,
      }),
    { wrapper }
  )
}

describe("useAgentChat", () => {
  beforeEach(() => {
    chatStream.mockReset()
  })

  it("streams tokens into one assistant message", async () => {
    chatStream.mockImplementation(() =>
      streamOf(
        { type: "turn_status", value: "streaming" },
        { type: "token", value: "Your order " },
        { type: "token", value: "is in transit." },
        { type: "turn_status", value: "complete" },
        { type: "done", turn_id: "t1" }
      )
    )

    const { result } = renderChat()
    await act(async () => {
      await result.current.send("Where is my order?")
    })

    const [user, assistant] = result.current.messages.slice(-2)
    expect(user.content).toBe("Where is my order?")
    expect(assistant.role).toBe("assistant")
    expect(assistant.content).toBe("Your order is in transit.")
    expect(result.current.typing).toBe(false)
    expect(chatStream).toHaveBeenCalledTimes(1)
    expect(chatStream.mock.calls[0][0]).toBe("conv_a")
    expect(typeof chatStream.mock.calls[0][2]).toBe("string")
  })

  it("renders an order card frame from the documented shape", async () => {
    chatStream.mockImplementation(() =>
      streamOf(
        { type: "token", value: "It arrives tomorrow." },
        {
          type: "card",
          kind: "order_status",
          data: {
            kind: "order_status",
            orderNumber: "ORD-1024",
            status: "shipped",
            carrier: "UPS",
            trackingNumber: "1Z999",
            estimatedDelivery: "2026-11-02T00:00:00Z",
            steps: [],
          },
        },
        { type: "done", turn_id: "t1" }
      )
    )

    const { result } = renderChat()
    await act(async () => {
      await result.current.send("Where is ORD-1024?")
    })

    const assistant = result.current.messages.at(-1)
    const card = assistant?.card
    expect(card?.kind).toBe("order_status")
    if (card?.kind === "order_status") expect(card.orderNumber).toBe("ORD-1024")
  })

  it("creates a conversation for a draft thread before streaming", async () => {
    chatStream.mockImplementation(() => streamOf({ type: "token", value: "Hello!" }))
    const ensureConversation = vi.fn(async () => "conv_created")

    const { result } = renderChat({ conversationId: undefined, ensureConversation })
    await act(async () => {
      await result.current.send("My package is late")
    })

    expect(ensureConversation).toHaveBeenCalledWith("My package is late")
    expect(chatStream.mock.calls[0][0]).toBe("conv_created")
    expect(result.current.messages.at(-1)?.content).toBe("Hello!")
  })

  it("marks the reply failed when the server sends an error frame", async () => {
    chatStream.mockImplementation(() =>
      streamOf(
        { type: "error", code: "agent_error", message: "The assistant is unavailable." },
        { type: "done", turn_id: "t1" }
      )
    )

    const { result } = renderChat()
    await act(async () => {
      await result.current.send("Hello?")
    })

    const assistant = result.current.messages.at(-1)
    expect(assistant?.failed).toBe(true)
    expect(assistant?.content).toBe("The assistant is unavailable.")
  })

  it("shows the API error when the stream cannot be opened", async () => {
    chatStream.mockImplementation(() => {
      throw new Error("A human agent has taken over this conversation")
    })

    const { result } = renderChat()
    await act(async () => {
      await result.current.send("Hello?")
    })

    await waitFor(() => expect(result.current.typing).toBe(false))
    const assistant = result.current.messages.at(-1)
    expect(assistant?.failed).toBe(true)
    expect(assistant?.content).toBe("A human agent has taken over this conversation")
  })

  it("ignores blank submissions", async () => {
    const { result } = renderChat()

    await act(async () => {
      await result.current.send("   ")
    })

    expect(chatStream).not.toHaveBeenCalled()
    expect(result.current.messages).toEqual(seed)
  })
})
