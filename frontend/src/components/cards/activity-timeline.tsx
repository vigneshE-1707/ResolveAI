import { Link } from "react-router-dom"
import {
  ArrowRight,
  BookOpen,
  Bot,
  Package,
  ShieldAlert,
  Ticket,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ActivityItem } from "@/types"

const iconMap: Record<ActivityItem["icon"], { icon: LucideIcon; className: string }> = {
  order: { icon: Package, className: "bg-amber-50 text-amber-600" },
  ticket: { icon: Ticket, className: "bg-indigo-50 text-indigo-600" },
  policy: { icon: BookOpen, className: "bg-sky-50 text-sky-600" },
  ai: { icon: Bot, className: "bg-violet-50 text-violet-600" },
  escalation: { icon: ShieldAlert, className: "bg-rose-50 text-rose-600" },
  agent: { icon: UserRound, className: "bg-emerald-50 text-emerald-600" },
}

export function ActivityTimeline({
  items,
  title = "Recent Activity",
  showViewAll = true,
  className,
}: {
  items: ActivityItem[]
  title?: string
  showViewAll?: boolean
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-1">
        <CardTitle>{title}</CardTitle>
        {showViewAll && (
          <Link
            to="/admin/monitoring"
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            View All <ArrowRight className="size-3" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="divide-y divide-border/70">
          {items.map((item) => {
            const meta = iconMap[item.icon]
            const content = (
              <div className="flex items-center gap-2.5 py-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    meta.className
                  )}
                >
                  <meta.icon className="size-3.5" strokeWidth={2.1} />
                </span>
                <p className="min-w-0 flex-1 truncate text-[12px] text-slate-700">{item.label}</p>
                <span className="shrink-0 text-[10.5px] text-muted-foreground">{item.timestamp}</span>
              </div>
            )
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link to={item.href} className="block rounded-md transition-colors hover:bg-slate-50">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
