import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { RoleProvider } from "@/app/role-context"
import { AdminOverviewPage } from "./admin-overview-page"

function renderPage() {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <AdminOverviewPage />
      </RoleProvider>
    </MemoryRouter>
  )
}

describe("AdminOverviewPage", () => {
  it("derives the KPI numbers from the demo series instead of hardcoding them", () => {
    renderPage()

    // requestSeries totals: 1,666 requests, 1,188 AI resolutions (71%), 144 escalations (8.6%).
    expect(screen.getByText("1,666")).toBeInTheDocument()
    expect(screen.getByText("71%")).toBeInTheDocument()
    expect(screen.getByText("8.6%")).toBeInTheDocument()
  })

  it("flags the demo dataset and lists recent AI executions", () => {
    renderPage()

    expect(screen.getByText(/Last 14 days · demo data/)).toBeInTheDocument()
    expect(screen.getByText("Failed AI executions")).toBeInTheDocument()
    expect(screen.getByText("4bf92f3577b3…")).toBeInTheDocument()
  })
})
