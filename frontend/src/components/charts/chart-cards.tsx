import type { ReactNode } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { CategoryPoint, LatencyPoint, SeriesPoint } from "@/types"

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-1">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn("pt-2", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>
  label?: string | number
  suffix?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-white px-2.5 py-1.5 shadow-raised">
      {label !== undefined && <p className="mb-1 text-[10.5px] font-semibold text-slate-500">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey ?? entry.name} className="flex items-center gap-1.5 text-[11px] text-slate-700">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="capitalize text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-semibold tabular">
            {entry.value}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  )
}

const axisProps = {
  tick: { fontSize: 10, fill: "#94a3b8" },
  axisLine: false,
  tickLine: false,
} as const

export function RequestsAreaChart({ data, height = 210 }: { data: SeriesPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-requests" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="grad-resolved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} width={44} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} />
        <Area
          type="monotone"
          dataKey="requests"
          name="Requests"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#grad-requests)"
          activeDot={{ r: 3 }}
        />
        <Area
          type="monotone"
          dataKey="aiResolved"
          name="AI resolved"
          stroke="#7c3aed"
          strokeWidth={2}
          fill="url(#grad-resolved)"
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function EscalationsBarChart({ data, height = 190 }: { data: SeriesPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} width={44} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
        <Bar dataKey="escalated" name="Escalations" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CategoryDonut({ data, height = 190 }: { data: CategoryPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="86%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip suffix="%" />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function LatencyLineChart({ data, height = 190 }: { data: LatencyPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={44} />
        <Tooltip content={<ChartTooltip suffix=" ms" />} />
        <Line type="monotone" dataKey="p50" name="p50" stroke="#10b981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="p95" name="p95" stroke="#7c3aed" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function LegendDots({
  items,
}: {
  items: { label: string; color: string; value?: string }[]
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
          {item.value && <span className="font-semibold text-slate-600 tabular">{item.value}</span>}
        </li>
      ))}
    </ul>
  )
}
