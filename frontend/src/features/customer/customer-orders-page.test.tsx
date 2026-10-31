import { fireEvent, screen } from "@testing-library/react"
import { vi } from "vitest"

import { renderWithProviders } from "@/test/utils"
import type { OrderSummary } from "@/types"

import { CustomerOrdersPage } from "./customer-orders-page"

vi.mock("@/lib/api/hooks", () => {
  const orders: OrderSummary[] = [
    {
      id: "order-1",
      orderNumber: "ORD-1024",
      status: "shipped",
      placedAt: "2026-10-24T09:12:00Z",
      totalCents: 89900,
      currency: "USD",
      itemCount: 1,
      lineCount: 1,
      firstItemName: "Nimbus Phone X2 — 128GB",
      customerName: "John Doe",
      shipment: {
        carrier: "UPS",
        trackingNumber: "TRACK-1024",
        status: "in_transit",
        estimatedDeliveryAt: "2026-11-01T00:00:00Z",
        lastEventDesc: "Departed facility",
      },
    },
    {
      id: "order-2",
      orderNumber: "ORD-1019",
      status: "delivered",
      placedAt: "2026-10-09T16:40:00Z",
      totalCents: 24900,
      currency: "USD",
      itemCount: 1,
      lineCount: 1,
      firstItemName: "AeroPods Pro",
      customerName: "John Doe",
      shipment: null,
    },
    {
      id: "order-3",
      orderNumber: "ORD-1007",
      status: "cancelled",
      placedAt: "2026-09-24T08:05:00Z",
      totalCents: 12900,
      currency: "USD",
      itemCount: 1,
      lineCount: 1,
      firstItemName: "Atlas Commuter Backpack",
      customerName: "John Doe",
      shipment: null,
    },
  ]

  return {
    useMyOrders: () => ({
      data: { data: orders, page: 1, pageSize: 20, total: orders.length },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  }
})

describe("CustomerOrdersPage", () => {
  it("lists the customer's orders", () => {
    renderWithProviders(<CustomerOrdersPage />)
    expect(screen.getByRole("heading", { name: "My Orders" })).toBeInTheDocument()
    expect(screen.getByText("Nimbus Phone X2 — 128GB")).toBeInTheDocument()
    expect(screen.getByText("AeroPods Pro")).toBeInTheDocument()
  })

  it("filters to delivered orders", () => {
    renderWithProviders(<CustomerOrdersPage />)
    fireEvent.click(screen.getByRole("button", { name: /Delivered/ }))

    expect(screen.getByText("AeroPods Pro")).toBeInTheDocument()
    expect(screen.queryByText("Nimbus Phone X2 — 128GB")).not.toBeInTheDocument()
  })

  it("narrows the list to cancelled orders only", () => {
    renderWithProviders(<CustomerOrdersPage />)
    fireEvent.click(screen.getByRole("button", { name: /Cancelled/ }))

    expect(screen.getByText("Atlas Commuter Backpack")).toBeInTheDocument()
    expect(screen.queryByText("Nimbus Phone X2 — 128GB")).not.toBeInTheDocument()
    expect(screen.queryByText("AeroPods Pro")).not.toBeInTheDocument()
  })

  it("keeps the 'In transit' filter aligned with shipped and processing orders", () => {
    renderWithProviders(<CustomerOrdersPage />)
    fireEvent.click(screen.getByRole("button", { name: /In transit/ }))

    expect(screen.getByText("Nimbus Phone X2 — 128GB")).toBeInTheDocument()
    expect(screen.queryByText("Atlas Commuter Backpack")).not.toBeInTheDocument()
  })
})
