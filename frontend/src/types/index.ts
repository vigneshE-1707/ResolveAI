export type Role = "CUSTOMER" | "SUPPORT_AGENT" | "ADMIN"

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"

export type ShipmentStatus = "prepared" | "in_transit" | "out_for_delivery" | "delivered" | "exception"

export type TicketStatus = "open" | "in_progress" | "pending_customer" | "resolved" | "closed"
export type TicketPriority = "low" | "normal" | "high" | "urgent"

export type ConversationMode = "ai" | "human_pending" | "human"
export type ConversationStatus = "open" | "escalated" | "resolved" | "closed"

export interface User {
  id: string
  fullName: string
  email: string
  role: Role
  initials: string
  avatarUrl?: string
  customerId?: string
  agentId?: string
}

export interface Customer {
  id: string
  fullName: string
  email: string
  phone: string
  initials: string
  loyaltyTier: "standard" | "premium" | "vip"
  memberSince: string
  totalOrders: number
  activeTickets: number
  city: string
  country: string
}

export interface OrderItem {
  id: string
  sku: string
  name: string
  quantity: number
  unitPriceCents: number
  imageTone?: string
}

export interface ShipmentEvent {
  at: string
  label: string
  location?: string
  completed: boolean
}

export interface Shipment {
  carrier: string
  trackingNumber: string
  status: ShipmentStatus
  shippedAt: string
  estimatedDelivery: string | null
  deliveredAt: string | null
  events: ShipmentEvent[]
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  status: OrderStatus
  placedAt: string
  items: OrderItem[]
  subtotalCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  currency: string
  shippingCity: string
  shippingCountry: string
  shipment: Shipment | null
  returnEligible: boolean
  returnWindowEndsAt: string | null
}

export interface ShipmentSummary {
  carrier: string
  trackingNumber: string
  status: ShipmentStatus
  estimatedDeliveryAt: string | null
  lastEventDesc: string | null
}

/** Lightweight order shape used by list/card surfaces. */
export interface OrderSummary {
  id: string
  orderNumber: string
  status: OrderStatus
  placedAt: string
  totalCents: number
  currency: string
  itemCount: number
  lineCount: number
  firstItemName: string | null
  customerName: string | null
  shipment: ShipmentSummary | null
}

export interface Ticket {
  id: string
  ticketNumber: string
  customerId: string
  orderNumber: string | null
  subject: string
  category:
    | "order_status"
    | "delivery_issue"
    | "wrong_item"
    | "return_request"
    | "cancellation"
    | "refund"
    | "product_quality"
    | "other"
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignedAgentId: string | null
  escalationReason: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export interface Agent {
  id: string
  fullName: string
  initials: string
  team: string
  email: string
  isOnline: boolean
  activeConversations: number
  resolvedToday: number
  csat: number | null
}

export type MessageRole = "user" | "assistant" | "agent" | "system"

export interface OrderCardData {
  kind: "order_status"
  orderNumber: string
  status: OrderStatus
  carrier: string
  trackingNumber: string
  estimatedDelivery: string
  steps: { label: string; at: string; state: "done" | "current" | "upcoming" }[]
}

export interface TicketCardData {
  kind: "ticket_created"
  ticketNumber: string
  subject: string
  status: TicketStatus
}

export interface ApprovalCardData {
  kind: "approval_request"
  action: string
  summary: string
  approvalId: string
}

export interface EscalationCardData {
  kind: "escalation"
  reason: string
  queuePosition: number
  estimatedWait: string
}

export type MessageCard = OrderCardData | TicketCardData | ApprovalCardData | EscalationCardData

export interface ChatMessage {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  createdAt: string
  authorName?: string
  card?: MessageCard
  suggestions?: string[]
  pending?: boolean
  failed?: boolean
}

export interface Conversation {
  id: string
  customerId: string
  subject: string
  mode: ConversationMode
  status: ConversationStatus
  assignedAgentId: string | null
  escalationReason: string | null
  lastMessagePreview: string
  lastMessageAt: string
  unread: boolean
  aiHandled: boolean
  messageCount: number
}

export interface ActivityItem {
  id: string
  icon: "order" | "ticket" | "policy" | "ai" | "escalation" | "agent"
  label: string
  timestamp: string
  minutesAgo: number
  href?: string
}

export interface KnowledgeDocument {
  id: string
  title: string
  category: "returns" | "refunds" | "shipping" | "cancellation" | "warranty" | "faq"
  status: "processing" | "ready" | "failed"
  chunkCount: number
  version: number
  updatedAt: string
  embeddingModel: string
}

export interface AiRun {
  id: string
  conversationId: string
  traceId: string
  model: string
  status: "succeeded" | "failed" | "interrupted" | "escalated"
  latencyMs: number
  promptTokens: number
  completionTokens: number
  toolCalls: string[]
  createdAt: string
}

export interface SeriesPoint {
  label: string
  requests: number
  aiResolved: number
  escalated: number
}

export interface CategoryPoint {
  name: string
  value: number
  color: string
}

export interface LatencyPoint {
  label: string
  p50: number
  p95: number
}
