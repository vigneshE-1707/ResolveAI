import type { Role } from "@/types"

/** Wire shapes returned by the FastAPI backend (snake_case, as documented). */

export interface WireUser {
  id: string
  email: string
  full_name: string
  role: Role
  customer_id: string | null
  agent_id: string | null
}

export interface WireAuthResponse {
  access_token: string
  token_type: string
  user: WireUser
}

export interface WireMeta {
  page: number
  page_size: number
  total: number
}

export interface WireList<T> {
  data: T[]
  meta: WireMeta
}

export interface WireShipmentSummary {
  carrier: string
  tracking_number: string
  status: string
  estimated_delivery_at: string | null
  last_event_desc: string | null
}

export interface WireOrderSummary {
  id: string
  order_number: string
  status: string
  placed_at: string
  total_cents: number
  currency: string
  item_count: number
  line_count: number
  first_item_name: string | null
  customer_name: string | null
  shipment: WireShipmentSummary | null
}

export interface WireOrderItem {
  id: string
  sku: string | null
  name_snapshot: string
  quantity: number
  unit_price_cents: number
}

export interface WireShipment {
  carrier: string
  tracking_number: string
  status: string
  shipped_at: string | null
  estimated_delivery_at: string | null
  delivered_at: string | null
  last_event_desc: string | null
  last_event_at: string | null
}

export interface WireOrderDetail {
  id: string
  order_number: string
  customer_id: string
  status: string
  placed_at: string
  subtotal_cents: number
  shipping_cents: number
  tax_cents: number
  total_cents: number
  currency: string
  items: WireOrderItem[]
  shipment: WireShipment | null
  return_eligible: boolean
  return_window_end: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

export interface WireReturnEligibility {
  eligible: boolean
  reason: string
  order_number: string
  order_status: string
  return_window_end: string | null
}

export interface WireReturn {
  id: string
  order_id: string
  customer_id: string
  reason_code: string
  reason_text: string | null
  status: string
  requested_at: string
  decided_at: string | null
  refund_amount_cents: number | null
}

export interface WireTicket {
  id: string
  ticket_number: string
  customer_id: string
  order_id: string | null
  order_number: string | null
  subject: string
  category: string
  description: string | null
  status: string
  priority: string
  assigned_agent_id: string | null
  escalation_reason: string | null
  created_at: string
  updated_at: string
  first_response_at: string | null
  resolved_at: string | null
  resolution_note: string | null
}

export interface WireConversation {
  id: string
  customer_id: string
  subject: string
  channel: string
  mode: string
  status: string
  assigned_agent_id: string | null
  escalation_reason: string | null
  created_at: string
  updated_at: string
  escalated_at: string | null
  resolved_at: string | null
  closed_at: string | null
}

export interface WireMessage {
  id: string
  conversation_id: string
  role: string
  content: string
  content_type: string
  card: Record<string, unknown> | null
  sources: Record<string, unknown> | null
  seq: number
  created_at: string
}

export interface WireAddress {
  id: string
  label: string
  line1: string
  line2: string | null
  city: string
  region: string | null
  postal_code: string
  country: string
  is_default: boolean
}

export interface WireAdminStats {
  total_conversations: number
  active_conversations: number
  escalated: number
  open_tickets: number
}

export interface WireAgentStats {
  open_conversations: number
  pending_conversations: number
  my_active: number
}

export interface WireAgent {
  id: string
  display_name: string
  team: string
  is_active: boolean
}

export interface WireKnowledgeDocument {
  id: string
  title: string
  category: string
  status: string
  version: number
  chunk_count: number
  updated_at: string
}

export interface WireAiRun {
  id: string
  conversation_id: string
  trace_id: string
  model_name: string
  status: string
  latency_ms: number
  prompt_tokens: number
  completion_tokens: number
  created_at: string
}

export interface WireAuditLog {
  id: string
  actor_user_id: string | null
  actor_role: string | null
  action: string
  entity_type: string
  created_at: string
}

export interface WireAdminSettings {
  app_env: string
  llm_model: string
  llm_provider: string
  langsmith_tracing: boolean
}
