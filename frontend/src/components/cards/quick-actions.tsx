import { Link } from "react-router-dom"
import { BookOpen, Package, RotateCcw, Ticket } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const actions = [
  {
    label: "Check Order Status",
    icon: Package,
    to: "/support",
    iconClass: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  },
  {
    label: "Return Request",
    icon: RotateCcw,
    to: "/support",
    iconClass: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  },
  {
    label: "Create Ticket",
    icon: Ticket,
    to: "/tickets",
    iconClass: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  },
  {
    label: "View Policy",
    icon: BookOpen,
    to: "/support",
    iconClass: "bg-sky-50 text-sky-600 group-hover:bg-sky-100",
  },
]

export function QuickActions({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-2 py-3 text-center transition-all hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm"
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-colors",
                action.iconClass
              )}
            >
              <action.icon className="size-4" strokeWidth={2.1} />
            </span>
            <span className="text-[11px] font-medium leading-tight text-slate-600 group-hover:text-slate-900">
              {action.label}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
