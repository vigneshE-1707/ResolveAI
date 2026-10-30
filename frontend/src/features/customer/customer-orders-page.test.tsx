import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { RoleProvider } from "@/app/role-context"
import { CustomerOrdersPage } from "./customer-orders-page"

function renderPage() {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <CustomerOrdersPage />
      </RoleProvider>
    </MemoryRouter>
  )
}

describe("CustomerOrdersPage", () => {
  it("lists the customer's orders", () => {
    renderPage()
    expect(screen.getByRole("heading", { name: "My Orders" })).toBeInTheDocument()
    expect(screen.getByText("Nimbus Phone X2 — 128GB")).toBeInTheDocument()
    expect(screen.getByText("AeroPods Pro")).toBeInTheDocument()
  })

  it("filters to delivered orders", () => {
    renderPage()
    const filters = screen.getByRole("button", { name: /Delivered/ })
    fireEvent.click(filters)

    expect(screen.getByText("AeroPods Pro")).toBeInTheDocument()
    expect(screen.queryByText("Nimbus Phone X2 — 128GB")).not.toBeInTheDocument()
  })

  it("narrows the list to cancelled orders only", () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /Cancelled/ }))

    expect(screen.getByText("Atlas Commuter Backpack")).toBeInTheDocument()
    expect(screen.queryByText("Nimbus Phone X2 — 128GB")).not.toBeInTheDocument()
    expect(screen.queryByText("AeroPods Pro")).not.toBeInTheDocument()
  })

  it("keeps the 'In transit' filter aligned with shipped and processing orders", () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /In transit/ }))

    expect(screen.getByText("Nimbus Phone X2 — 128GB")).toBeInTheDocument()
    expect(screen.queryByText("Atlas Commuter Backpack")).not.toBeInTheDocument()
  })
})
