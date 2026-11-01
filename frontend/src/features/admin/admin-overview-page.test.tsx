import { screen } from "@testing-library/react"
import { vi } from "vitest"

import { renderWithProviders } from "@/test/utils"

import { AdminOverviewPage } from "./admin-overview-page"

vi.mock("@/lib/api/hooks", () => ({
  useAdminStats: () => ({
    data: {
      total_conversations: 42,
      active_conversations: 12,
      escalated: 3,
      open_tickets: 7,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useAdminKnowledge: () => ({
    data: {
      data: [
        {
          id: "doc-1",
          title: "Returns policy",
          category: "returns",
          status: "ready",
          chunkCount: 12,
          version: 1,
          updatedAt: "2026-10-20T10:00:00Z",
          embeddingModel: "not reported",
        },
      ],
      page: 1,
      pageSize: 4,
      total: 1,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useAdminAiRuns: () => ({
    data: {
      data: [
        {
          id: "run-1",
          conversationId: "conv-1",
          traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
          model: "gpt-4.1-mini",
          status: "succeeded",
          latencyMs: 1200,
          promptTokens: 800,
          completionTokens: 120,
          toolCalls: [],
          createdAt: "2026-10-31T09:00:00Z",
        },
      ],
      page: 1,
      pageSize: 5,
      total: 1,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

describe("AdminOverviewPage", () => {
  it("shows live KPI counts from the admin stats endpoint", () => {
    renderWithProviders(<AdminOverviewPage />, { role: "ADMIN" })

    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
  })

  it("flags the demo charts and lists recent AI executions", () => {
    renderWithProviders(<AdminOverviewPage />, { role: "ADMIN" })

    expect(screen.getByText("Charts · demo data")).toBeInTheDocument()
    expect(screen.getByText("Recent AI executions")).toBeInTheDocument()
    expect(screen.getByText("4bf92f3577b3…")).toBeInTheDocument()
  })
})
