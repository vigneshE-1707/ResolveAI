import { describe, expect, it } from "vitest"

import {
  duration,
  formatCompactCurrency,
  formatCurrency,
  initialsOf,
  pct,
} from "./format"

describe("formatCurrency", () => {
  it("renders cents as a currency amount", () => {
    expect(formatCurrency(70092)).toBe("$700.92")
    expect(formatCurrency(0)).toBe("$0.00")
  })

  it("honours the currency argument", () => {
    expect(formatCurrency(100000, "EUR")).toContain("1,000")
  })

  it("compacts large amounts", () => {
    expect(formatCompactCurrency(123456789)).toMatch(/^\$1\.2M$/)
  })
})

describe("pct", () => {
  it("rounds to the nearest integer percentage", () => {
    expect(pct(49, 71)).toBe(69)
    expect(pct(1, 3)).toBe(33)
  })

  it("returns 0 instead of NaN for an empty total", () => {
    expect(pct(5, 0)).toBe(0)
  })
})

describe("duration", () => {
  it("keeps sub-second latencies in milliseconds", () => {
    expect(duration(920)).toBe("920 ms")
  })

  it("switches to seconds with one decimal", () => {
    expect(duration(1840)).toBe("1.8 s")
    expect(duration(30000)).toBe("30.0 s")
  })
})

describe("initialsOf", () => {
  it("uses at most the first two name parts", () => {
    expect(initialsOf("Maya Fernandez")).toBe("MF")
    expect(initialsOf("Sofia Maria Almeida")).toBe("SM")
  })
})
