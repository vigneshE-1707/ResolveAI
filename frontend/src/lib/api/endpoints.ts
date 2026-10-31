import type { Order, OrderSummary, Ticket, User } from "@/types"

import { apiRequest } from "./client"
import {
  mapAddress,
  mapAgent,
  mapAiRun,
  mapAuditLog,
  mapConversation,
  mapKnowledgeDocument,
  mapMessage,
  mapOrderDetail,
  mapOrderSummary,
  mapReturn,
  mapTicket,
  mapUser,
} from "./mappers"
import type {
  WireAddress,
  WireAdminSettings,
  WireAdminStats,
  WireAgent,
  WireAgentStats,
  WireAiRun,
  WireAuditLog,
  WireAuthResponse,
  WireConversation,
  WireKnowledgeDocument,
  WireList,
  WireMessage,
  WireOrderDetail,
  WireOrderSummary,
  WireReturn,
  WireReturnEligibility,
  WireTicket,
  WireUser,
} from "./types"

type QueryValue = string | number | boolean | undefined | null

function query(params: Record<string, QueryValue> = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

function listMeta<TWire, TOut>(wire: WireList<TWire>, map: (item: TWire) => TOut) {
  return {
    data: wire.data.map(map),
    page: wire.meta.page,
    pageSize: wire.meta.page_size,
    total: wire.meta.total,
  }
}

// ── Auth ───────────────────────────────────────────────────

export interface AuthSession {
  accessToken: string
  user: User
}

function toSession(wire: WireAuthResponse): AuthSession {
  return { accessToken: wire.access_token, user: mapUser(wire.user) }
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<WireAuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    }).then(toSession),

  register: (email: string, password: string, fullName: string) =>
    apiRequest<WireAuthResponse>("/auth/register", {
      method: "POST",
      body: { email, password, full_name: fullName },
      skipAuth: true,
    }).then(toSession),

  refresh: () =>
    apiRequest<WireAuthResponse>("/auth/refresh", {
      method: "POST",
      skipAuth: true,
    }).then(toSession),

  me: () => apiRequest<WireUser>("/auth/me").then(mapUser),

  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),
}

// ── Customer ───────────────────────────────────────────────

export interface ListParams {
  page?: number
  pageSize?: number
}

export interface OrderListParams extends ListParams {
  status?: string
  q?: string
}

export interface TicketListParams extends ListParams {
  status?: string
  priority?: string
  q?: string
}

export interface TicketCreateInput {
  subject: string
  category: string
  description?: string
  orderNumber?: string
}

export const customerApi = {
  updateProfile: (input: { fullName?: string; phone?: string }) =>
    apiRequest<{ message: string }>("/me", {
      method: "PATCH",
      body: {
        ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    }),

  addresses: () => apiRequest<WireAddress[]>("/me/addresses").then((rows) => rows.map(mapAddress)),

  orders: (params: OrderListParams = {}) =>
    apiRequest<WireList<WireOrderSummary>>(
      `/me/orders${query({
        status: params.status,
        q: params.q,
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapOrderSummary) as { data: OrderSummary[]; page: number; pageSize: number; total: number }),

  order: (orderNumber: string) =>
    apiRequest<WireOrderDetail>(`/me/orders/${encodeURIComponent(orderNumber)}`).then(mapOrderDetail) as Promise<Order>,

  tickets: (params: TicketListParams = {}) =>
    apiRequest<WireList<WireTicket>>(
      `/me/tickets${query({
        status: params.status,
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapTicket) as { data: Ticket[]; page: number; pageSize: number; total: number }),

  ticket: (ticketNumber: string) =>
    apiRequest<WireTicket>(`/me/tickets/${encodeURIComponent(ticketNumber)}`).then(mapTicket),

  createTicket: (input: TicketCreateInput, idempotencyKey: string) =>
    apiRequest<WireTicket>("/me/tickets", {
      method: "POST",
      idempotencyKey,
      body: {
        subject: input.subject,
        category: input.category,
        description: input.description,
        order_number: input.orderNumber || undefined,
      },
    }).then(mapTicket),

  conversations: (params: ListParams = {}) =>
    apiRequest<WireList<WireConversation>>(
      `/me/conversations${query({ page: params.page, page_size: params.pageSize })}`
    ).then((wire) => listMeta(wire, mapConversation)),

  messages: (conversationId: string, params: ListParams = {}) =>
    apiRequest<WireList<WireMessage>>(
      `/conversations/${encodeURIComponent(conversationId)}/messages${query({
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapMessage)),

  returns: (params: ListParams = {}) =>
    apiRequest<WireList<WireReturn>>(
      `/me/returns${query({ page: params.page, page_size: params.pageSize })}`
    ).then((wire) => listMeta(wire, mapReturn)),

  createReturn: (
    input: { orderNumber: string; reasonCode: string; reasonText?: string },
    idempotencyKey: string
  ) =>
    apiRequest<WireReturn>("/me/returns", {
      method: "POST",
      idempotencyKey,
      body: {
        order_number: input.orderNumber,
        reason_code: input.reasonCode,
        reason_text: input.reasonText,
      },
    }).then(mapReturn),

  returnEligibility: (orderNumber: string) =>
    apiRequest<WireReturnEligibility>(
      `/returns/eligibility/${encodeURIComponent(orderNumber)}`
    ),
}

// ── Agent ──────────────────────────────────────────────────

export interface AgentConversationParams extends ListParams {
  mode?: string
  status?: string
  assigned?: string
  unassigned?: boolean
  q?: string
}

export const agentApi = {
  stats: () => apiRequest<WireAgentStats>("/agent/stats"),

  conversations: (params: AgentConversationParams = {}) =>
    apiRequest<WireList<WireConversation>>(
      `/agent/conversations${query({
        mode: params.mode,
        status: params.status,
        assigned: params.assigned,
        unassigned: params.unassigned,
        q: params.q,
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapConversation)),

  conversation: (conversationId: string) =>
    apiRequest<WireConversation>(`/agent/conversations/${encodeURIComponent(conversationId)}`).then(
      mapConversation
    ),

  messages: (conversationId: string, params: ListParams = {}) =>
    apiRequest<WireList<WireMessage>>(
      `/conversations/${encodeURIComponent(conversationId)}/messages${query({
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapMessage)),

  reply: (conversationId: string, content: string) =>
    apiRequest<WireMessage>(`/agent/conversations/${encodeURIComponent(conversationId)}/replies`, {
      method: "POST",
      body: { content },
    }).then(mapMessage),

  assign: (conversationId: string, agentId: string | null) =>
    apiRequest<{ message: string }>(
      `/agent/conversations/${encodeURIComponent(conversationId)}/assign`,
      { method: "POST", body: { agent_id: agentId } }
    ),

  takeover: (conversationId: string) =>
    apiRequest<{ message: string }>(
      `/agent/conversations/${encodeURIComponent(conversationId)}/takeover`,
      { method: "POST" }
    ),

  resolve: (conversationId: string, note?: string) =>
    apiRequest<{ message: string }>(
      `/agent/conversations/${encodeURIComponent(conversationId)}/resolve`,
      { method: "POST", body: { resolution_note: note } }
    ),

  reopen: (conversationId: string) =>
    apiRequest<{ message: string }>(
      `/agent/conversations/${encodeURIComponent(conversationId)}/reopen`,
      { method: "POST" }
    ),

  tickets: (params: TicketListParams = {}) =>
    apiRequest<WireList<WireTicket>>(
      `/agent/tickets${query({
        status: params.status,
        priority: params.priority,
        q: params.q,
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapTicket)),

  updateTicket: (
    ticketNumber: string,
    input: { status?: string; priority?: string; assignedAgentId?: string | null; resolutionNote?: string }
  ) =>
    apiRequest<WireTicket>(`/agent/tickets/${encodeURIComponent(ticketNumber)}`, {
      method: "PATCH",
      body: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.assignedAgentId !== undefined ? { assigned_agent_id: input.assignedAgentId } : {}),
        ...(input.resolutionNote !== undefined ? { resolution_note: input.resolutionNote } : {}),
      },
    }).then(mapTicket),
}

// ── Admin ──────────────────────────────────────────────────

export const adminApi = {
  stats: () => apiRequest<WireAdminStats>("/admin/stats"),

  orders: (params: OrderListParams = {}) =>
    apiRequest<WireList<WireOrderSummary>>(
      `/admin/orders${query({
        status: params.status,
        q: params.q,
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapOrderSummary)),

  order: (orderNumber: string) =>
    apiRequest<WireOrderDetail>(`/admin/orders/${encodeURIComponent(orderNumber)}`).then(
      mapOrderDetail
    ),

  updateOrderStatus: (orderId: string, status: string, reason?: string) =>
    apiRequest<{ id: string; status: string }>(`/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: { status, reason },
    }),

  agents: (params: ListParams = {}) =>
    apiRequest<WireList<WireAgent>>(
      `/admin/agents${query({ page: params.page, page_size: params.pageSize })}`
    ).then((wire) => listMeta(wire, mapAgent)),

  tickets: (params: TicketListParams = {}) =>
    apiRequest<WireList<WireTicket>>(
      `/admin/tickets${query({
        status: params.status,
        priority: params.priority,
        q: params.q,
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapTicket)),

  knowledge: (params: { category?: string } & ListParams = {}) =>
    apiRequest<WireList<WireKnowledgeDocument>>(
      `/admin/knowledge${query({
        category: params.category,
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapKnowledgeDocument)),

  uploadKnowledge: (input: { title: string; category: string; contentText: string }) =>
    apiRequest<{ id: string; title: string; status: string }>("/admin/knowledge/upload", {
      method: "POST",
      body: {
        title: input.title,
        category: input.category,
        content_text: input.contentText,
      },
    }),

  deleteKnowledge: (docId: string) =>
    apiRequest<void>(`/admin/knowledge/${encodeURIComponent(docId)}`, { method: "DELETE" }),

  aiRuns: (params: { status?: string; traceId?: string } & ListParams = {}) =>
    apiRequest<WireList<WireAiRun>>(
      `/admin/ai-runs${query({
        status: params.status,
        trace_id: params.traceId,
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapAiRun)),

  auditLogs: (params: { action?: string; entityType?: string } & ListParams = {}) =>
    apiRequest<WireList<WireAuditLog>>(
      `/admin/audit-logs${query({
        action: params.action,
        entity_type: params.entityType,
        page: params.page,
        page_size: params.pageSize,
      })}`
    ).then((wire) => listMeta(wire, mapAuditLog)),

  settings: () => apiRequest<WireAdminSettings>("/admin/settings"),
}
