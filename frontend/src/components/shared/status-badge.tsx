import { cn } from "@/lib/utils"
import type { BadgeVariant } from "@/components/ui/badge"
import { Badge } from "@/components/ui/badge"

export interface StatusTone {
  label: string
  variant: BadgeVariant
  dot: string
}

export function StatusBadge({
  tone,
  withDot = true,
  className,
}: {
  tone: StatusTone
  withDot?: boolean
  className?: string
}) {
  return (
    <Badge variant={tone.variant} className={cn("gap-1.5", className)}>
      {withDot && <span className={cn("size-1.5 rounded-full", tone.dot)} />}
      {tone.label}
    </Badge>
  )
}
