import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"

import { App } from "./App"
import { RoleProvider } from "./app/role-context"
import { NotFoundPage } from "./features/shared/not-found-page"

function withProviders(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider>{children}</RoleProvider>
    </QueryClientProvider>
  )
}

describe("App routing", () => {
  it("redirects the index route to the customer support console", async () => {
    window.history.pushState({}, "", "/")

    render(withProviders(<App />))

    // Lazy route chunks are fetched on demand, so allow a generous timeout.
    expect(
      await screen.findByRole(
        "heading",
        { name: "AI-Powered Customer Support, Made Easy" },
        { timeout: 10000 }
      )
    ).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /Customer Support/i }).length).toBeGreaterThan(0)
  }, 25000)
})

describe("NotFoundPage", () => {
  it("offers the customer and agent entry points", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    )

    expect(screen.getByText("This page drifted away")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Customer support/i })).toHaveAttribute(
      "href",
      "/support"
    )
    expect(screen.getByRole("link", { name: /Agent console/i })).toHaveAttribute("href", "/agent")
  })
})
