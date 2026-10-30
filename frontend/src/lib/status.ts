import type { BadgeVariant } from "@/components/ui/badge"
import type {
  ConversationMode,
  ConversationStatus,
  OrderStatus,
  ShipmentStatus,
  TicketPriority,
  TicketStatus,
} from "@/types"

type Tone = { label: string; variant: BadgeVariant; dot: string }

export const orderStatusTone: Record<OrderStatus, Tone> = {
  pending: { label: "Pending", variant: "outline", dot: "bg-slate-400" },
  confirmed: { label: "Confirmed", variant: "info", dot: "bg-blue-500" },
  processing: { label: "Processing", variant: "warning", dot: "bg-amber-500" },
  shipped: { label: "In transit", variant: "info", dot: "bg-blue-500" },
  delivered: { label: "Delivered", variant: "success", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", variant: "danger", dot: "bg-red-500" },
  returned: { label: "Returned", variant: "violet", dot: "bg-violet-500" },
}

export const shipmentStatusTone: Record<ShipmentStatus, Tone> = {
  prepared: { label: "Prepared", variant: "outline", dot: "bg-slate-400" },
  in_transit: { label: "In transit", variant: "info", dot: "bg-blue-500" },
  out_for_delivery: { label: "Out for delivery", variant: "warning", dot: "bg-amber-500" },
  delivered: { label: "Delivered", variant: "success", dot: "bg-emerald-500" },
  exception: { label: "Exception", variant: "danger", dot: "bg-red-500" },
}

export const ticketStatusTone: Record<TicketStatus, Tone> = {
  open: { label: "Open", variant: "info", dot: "bg-blue-500" },
  in_progress: { label: "In progress", variant: "warning", dot: "bg-amber-500" },
  pending_customer: { label: "Pending customer", variant: "violet", dot: "bg-violet-500" },
  resolved: { label: "Resolved", variant: "success", dot: "bg-emerald-500" },
  closed: { label: "Closed", variant: "outline", dot: "bg-slate-400" },
}

export const priorityTone: Record<TicketPriority, Tone> = {
  low: { label: "Low", variant: "outline", dot: "bg-slate-400" },
  normal: { label: "Normal", variant: "info", dot: "bg-blue-500" },
  high: { label: "High", variant: "warning", dot: "bg-amber-500" },
  urgent: { label: "Urgent", variant: "danger", dot: "bg-red-500" },
}

export const conversationModeTone: Record<ConversationMode, Tone> = {
  ai: { label: "AI handling", variant: "info", dot: "bg-blue-500" },
  human_pending: { label: "Awaiting agent", variant: "warning", dot: "bg-amber-500" },
  human: { label: "Human agent", variant: "violet", dot: "bg-violet-500" },
}

export const conversationStatusTone: Record<ConversationStatus, Tone> = {
  open: { label: "Open", variant: "info", dot: "bg-blue-500" },
  escalated: { label: "Escalated", variant: "warning", dot: "bg-amber-500" },
  resolved: { label: "Resolved", variant: "success", dot: "bg-emerald-500" },
  closed: { label: "Closed", variant: "outline", dot: "bg-slate-400" },
}

export const ticketCategoryLabel: Record<string, string> = {
  order_status: "Order status",
  delivery_issue: "Delivery issue",
  wrong_item: "Wrong item",
  return_request: "Return request",
  cancellation: "Cancellation",
  refund: "Refund",
  product_quality: "Product quality",
  other: "Other",
}
