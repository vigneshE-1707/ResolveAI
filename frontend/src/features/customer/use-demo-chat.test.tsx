import { act, renderHook } from "@testing-library/react"

import type { ChatMessage } from "@/types"

import { useDemoChat } from "./use-demo-chat"

const seedA: ChatMessage[] = [
  {
    id: "seed_a",
    conversationId: "conv_a",
    role: "user",
    content: "Hi, I need help with an order.",
    createdAt: "2026-10-26T09:00:00.000Z",
  },
]

const seedB: ChatMessage[] = [
  {
    id: "seed_b",
    conversationId: "conv_b",
    role: "user",
    content: "My return was rejected.",
    createdAt: "2026-10-27T09:00:00.000Z",
  },
]

describe("useDemoChat", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("appends the user message immediately and the canned reply after the delay", () => {
    const { result } = renderHook(() => useDemoChat("conv_a", seedA))

    act(() => result.current.send("Where is my order?"))
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]?.role).toBe("user")
    expect(result.current.typing).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1200)
    })

    expect(result.current.typing).toBe(false)
    expect(result.current.messages).toHaveLength(3)
    expect(result.current.messages[2]?.role).toBe("assistant")
    expect(result.current.messages[2]?.conversationId).toBe("conv_a")
  })

  it("ignores blank submissions", () => {
    const { result } = renderHook(() => useDemoChat("conv_a", seedA))

    act(() => result.current.send("   "))

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.typing).toBe(false)
  })

  it("keeps transcripts separate per conversation", () => {
    const { result, rerender } = renderHook(
      ({ id, seed }: { id: string; seed: ChatMessage[] }) => useDemoChat(id, seed),
      { initialProps: { id: "conv_a", seed: seedA } }
    )

    act(() => result.current.send("Where is my order?"))
    expect(result.current.messages).toHaveLength(2)

    rerender({ id: "conv_b", seed: seedB })
    expect(result.current.messages).toEqual(seedB)

    rerender({ id: "conv_a", seed: seedA })
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]?.content).toBe("Where is my order?")
  })

  it("resolves a pending reply on the conversation that asked, even after switching", () => {
    const { result, rerender } = renderHook(
      ({ id, seed }: { id: string; seed: ChatMessage[] }) => useDemoChat(id, seed),
      { initialProps: { id: "conv_a", seed: seedA } }
    )

    act(() => result.current.send("Can I return my product?"))
    rerender({ id: "conv_b", seed: seedB })

    act(() => {
      vi.advanceTimersByTime(1200)
    })
    expect(result.current.messages).toEqual(seedB)

    rerender({ id: "conv_a", seed: seedA })
    expect(result.current.messages).toHaveLength(3)
    expect(result.current.typing).toBe(false)
  })
})
