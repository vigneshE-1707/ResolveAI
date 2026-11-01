import { initialsOf } from "@/lib/format"
import type {
  Agent,
  ChatMessage,
  Conversation,
  ConversationMode,
  ConversationStatus,
  KnowledgeDocument,
  MessageRole,
  Order,
  OrderStatus,
  OrderSummary,
  Shipment,
  ShipmentEvent,
  ShipmentStatus,
  Ticket,
  TicketPriority,
  TicketStatus,
  User,
} from "@/types"

import type {
  WireAddress,
  WireAgent,
  WireAiRun,
  WireAuditLog,
  WireConversation,
  WireKnowledgeDocument,
  WireMessage,
  WireOrderDetail,
  WireOrderSummary,
  WireReturn,
  WireTicket,
  WireUser,
} from "./types"

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
]

const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "prepared",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
]

const TICKET_STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "pending_customer",
  "resolved",
  "closed",
]

const TICKET_PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"]

const TICKET_CATEGORIES: Ticket["category"][] = [
  "order_status",
  "delivery_issue",
  "wrong_item",
  "return_request",
  "cancellation",
  "refund",
  "product_quality",
  "other",
]

const CONVERSATION_MODES: ConversationMode[] = ["ai", "human_pending", "human"]
const CONVERSATION_STATUSES: ConversationStatus[] = ["open", "escalated", "resolved", "closed"]
const MESSAGE_ROLES: MessageRole[] = ["user", "assistant", "agent", "system"]

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function mapUser(wire: WireUser): User {
  return {
    id: wire.id,
    fullName: wire.full_name,
    email: wire.email,
    role: wire.role,
    initials: initialsOf(wire.full_name),
    customerId: wire.customer_id ?? undefined,
    agentId: wire.agent_id ?? undefined,
  }
}

export function mapOrderSummary(wire: WireOrderSummary): OrderSummary {
  return {
    id: wire.id,
    orderNumber: wire.order_number,
    status: oneOf(wire.status, ORDER_STATUSES, "pending"),
    placedAt: wire.placed_at,
    totalCents: wire.total_cents,
    currency: wire.currency,
    itemCount: wire.item_count,
    lineCount: wire.line_count,
    firstItemName: wire.first_item_name,
    customerName: wire.customer_name,
    shipment: wire.shipment
      ? {
          carrier: wire.shipment.carrier,
          trackingNumber: wire.shipment.tracking_number,
          status: oneOf(wire.shipment.status, SHIPMENT_STATUSES, "prepared"),
          estimatedDeliveryAt: wire.shipment.estimated_delivery_at,
          lastEventDesc: wire.shipment.last_event_desc,
        }
      : null,
  }
}

function buildShipment(wire: NonNullable<WireOrderDetail["shipment"]>): Shipment {
  const events: ShipmentEvent[] = []
  if (wire.shipped_at) {
    events.push({ at: wire.shipped_at, label: "Shipped", completed: true })
  }
  if (wire.last_event_at && wire.last_event_desc) {
    events.push({ at: wire.last_event_at, label: wire.last_event_desc, completed: true })
  }
  if (wire.delivered_at) {
    events.push({ at: wire.delivered_at, label: "Delivered", completed: true })
  }
  // Newest first: the timeline marks the first event as the current step.
  events.reverse()

  return {
    carrier: wire.carrier,
    trackingNumber: wire.tracking_number,
    status: oneOf(wire.status, SHIPMENT_STATUSES, "prepared"),
    shippedAt: wire.shipped_at ?? wire.last_event_at ?? "",
    estimatedDelivery: wire.estimated_delivery_at,
    deliveredAt: wire.delivered_at,
    events,
  }
}

export function mapOrderDetail(wire: WireOrderDetail): Order {
  return {
    id: wire.id,
    orderNumber: wire.order_number,
    customerId: wire.customer_id,
    status: oneOf(wire.status, ORDER_STATUSES, "pending"),
    placedAt: wire.placed_at,
    items: wire.items.map((item) => ({
      id: item.id,
      sku: item.sku ?? "—",
      name: item.name_snapshot,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    })),
    subtotalCents: wire.subtotal_cents,
    shippingCents: wire.shipping_cents,
    taxCents: wire.tax_cents,
    totalCents: wire.total_cents,
    currency: wire.currency,
    // The API does not expose the shipping address on the order yet.
    shippingCity: "",
    shippingCountry: "",
    shipment: wire.shipment ? buildShipment(wire.shipment) : null,
    returnEligible: wire.return_eligible,
    returnWindowEndsAt: wire.return_window_end,
  }
}

export function mapTicket(wire: WireTicket): Ticket {
  return {
    id: wire.id,
    ticketNumber: wire.ticket_number,
    customerId: wire.customer_id,
    orderNumber: wire.order_number,
    subject: wire.subject,
    category: oneOf(wire.category, TICKET_CATEGORIES, "other"),
    description: wire.description ?? "",
    status: oneOf(wire.status, TICKET_STATUSES, "open"),
    priority: oneOf(wire.priority, TICKET_PRIORITIES, "normal"),
    assignedAgentId: wire.assigned_agent_id,
    escalationReason: wire.escalation_reason,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
    resolvedAt: wire.resolved_at,
  }
}

export function mapConversation(wire: WireConversation): Conversation {
  return {
    id: wire.id,
    customerId: wire.customer_id,
    subject: wire.subject,
    mode: oneOf(wire.mode, CONVERSATION_MODES, "ai"),
    status: oneOf(wire.status, CONVERSATION_STATUSES, "open"),
    assignedAgentId: wire.assigned_agent_id,
    escalationReason: wire.escalation_reason,
    // The list endpoint does not include message previews yet; surface the
    // escalation reason when present rather than inventing content.
    lastMessagePreview: wire.escalation_reason ?? "Open the thread to view messages",
    lastMessageAt: wire.updated_at,
    unread: false,
    aiHandled: wire.mode === "ai",
    messageCount: 0,
    updatedAt: wire.updated_at,
    escalatedAt: wire.escalated_at,
  }
}

export function mapMessage(wire: WireMessage): ChatMessage {
  return {
    id: wire.id,
    conversationId: wire.conversation_id,
    role: oneOf(wire.role, MESSAGE_ROLES, "assistant"),
    content: wire.content,
    createdAt: wire.created_at,
  }
}

export function mapAddress(wire: WireAddress) {
  return {
    id: wire.id,
    label: wire.label,
    line1: wire.line1,
    line2: wire.line2,
    city: wire.city,
    region: wire.region,
    postalCode: wire.postal_code,
    country: wire.country,
    isDefault: wire.is_default,
  }
}

export type Address = ReturnType<typeof mapAddress>

export function mapAgent(wire: WireAgent): Agent {
  return {
    id: wire.id,
    fullName: wire.display_name,
    initials: initialsOf(wire.display_name),
    team: wire.team,
    email: "",
    isOnline: wire.is_active,
    activeConversations: 0,
    resolvedToday: 0,
    csat: null,
  }
}

export function mapKnowledgeDocument(wire: WireKnowledgeDocument): KnowledgeDocument {
  return {
    id: wire.id,
    title: wire.title,
    category: oneOf(
      wire.category,
      ["returns", "refunds", "shipping", "cancellation", "warranty", "faq"] as const,
      "faq"
    ),
    status: oneOf(wire.status, ["processing", "ready", "failed"] as const, "processing"),
    chunkCount: wire.chunk_count,
    version: wire.version,
    updatedAt: wire.updated_at,
    embeddingModel: "not reported",
  }
}

export function mapAiRun(wire: WireAiRun) {
  return {
    id: wire.id,
    conversationId: wire.conversation_id,
    traceId: wire.trace_id,
    model: wire.model_name,
    status: oneOf(
      wire.status,
      ["succeeded", "failed", "interrupted", "escalated"] as const,
      "succeeded"
    ),
    latencyMs: wire.latency_ms,
    promptTokens: wire.prompt_tokens,
    completionTokens: wire.completion_tokens,
    toolCalls: [] as string[],
    createdAt: wire.created_at,
  }
}

export function mapAuditLog(wire: WireAuditLog) {
  return {
    id: wire.id,
    actorUserId: wire.actor_user_id,
    actorRole: wire.actor_role,
    action: wire.action,
    entityType: wire.entity_type,
    createdAt: wire.created_at,
  }
}

export function mapReturn(wire: WireReturn) {
  return {
    id: wire.id,
    orderId: wire.order_id,
    reasonCode: wire.reason_code,
    reasonText: wire.reason_text,
    status: wire.status,
    requestedAt: wire.requested_at,
    decidedAt: wire.decided_at,
    refundAmountCents: wire.refund_amount_cents,
  }
}

/**
 * Local view-model adapter for places that still hold a full `Order` (for
 * example the demo chat fixtures) but render the lightweight card surface.
 */
export function toOrderSummary(order: Order): OrderSummary {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.placedAt,
    totalCents: order.totalCents,
    currency: order.currency,
    itemCount,
    lineCount: order.items.length,
    firstItemName: order.items[0]?.name ?? null,
    customerName: null,
    shipment: order.shipment
      ? {
          carrier: order.shipment.carrier,
          trackingNumber: order.shipment.trackingNumber,
          status: order.shipment.status,
          estimatedDeliveryAt: order.shipment.estimatedDelivery,
          lastEventDesc: order.shipment.events[0]?.label ?? null,
        }
      : null,
  }
}
