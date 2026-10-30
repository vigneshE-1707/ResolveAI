import { render, screen } from "@testing-library/react"
import { Activity } from "lucide-react"

import { StatCard } from "./stat-card"

describe("StatCard", () => {
  it("renders the label, value and hint", () => {
    render(<StatCard label="Open conversations" value={12} hint="oldest 9m" icon={Activity} />)

    expect(screen.getByText("Open conversations")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("oldest 9m")).toBeInTheDocument()
  })

  it("shows a positive delta with an up arrow", () => {
    render(
      <StatCard
        label="Requests"
        value="1,666"
        icon={Activity}
        delta={{ value: "+8.2%", direction: "up" }}
      />
    )

    expect(screen.getByText("+8.2%")).toHaveClass("text-emerald-600")
  })

  it("flags a negative delta in rose", () => {
    render(
      <StatCard
        label="Escalations"
        value="144"
        icon={Activity}
        delta={{ value: "+3%", direction: "up", positive: false }}
      />
    )

    expect(screen.getByText("+3%")).toHaveClass("text-rose-600")
  })
})
