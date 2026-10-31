import { screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { vi } from "vitest"

import { App } from "./App"
import { NotFoundPage } from "./features/shared/not-found-page"
import { renderWithProviders } from "./test/utils"

vi.mock("@/lib/api/hooks", () => {
  const list = () => ({
    data: { data: [], page: 1, pageSize: 20, total: 0 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
  return {
    useMyOrders: list,
    useMyTickets: list,
    useMyConversations: list,
    useMyAddresses: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
    useConversationMessages: list,
  }
})

describe("App routing", () => {
  it("redirects an authenticated customer to the support console", async () => {
    window.history.pushState({}, "", "/")

    renderWithProviders(<App />, { role: "CUSTOMER", router: false })

    expect(
      await screen.findByRole(
        "heading",
        { name: "AI-Powered Customer Support, Made Easy" },
        { timeout: 20000 }
      )
    ).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /Customer Support/i }).length).toBeGreaterThan(0)
  }, 25000)
})

describe("NotFoundPage", () => {
  it("offers the customer and agent entry points", () => {
    renderWithProviders(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
      { router: false }
    )

    expect(screen.getByText("This page drifted away")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Customer support/i })).toHaveAttribute(
      "href",
      "/support"
    )
    expect(screen.getByRole("link", { name: /Agent console/i })).toHaveAttribute("href", "/agent")
  })
})
