import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { Order, OrderSummary, Ticket } from "@/types"

import {
  adminApi,
  agentApi,
  customerApi,
  type AgentConversationParams,
  type ListParams,
  type OrderListParams,
  type TicketCreateInput,
  type TicketListParams,
} from "./endpoints"

/**
 * Query keys are centralised so mutations can invalidate exactly the lists they
 * affect. Keys are plain arrays so they can be built outside React.
 */
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  customer: {
    orders: (params: OrderListParams = {}) => ["customer", "orders", params] as const,
    order: (orderNumber: string) => ["customer", "order", orderNumber] as const,
    tickets: (params: TicketListParams = {}) => ["customer", "tickets", params] as const,
    ticket: (ticketNumber: string) => ["customer", "ticket", ticketNumber] as const,
    conversations: (params: ListParams = {}) => ["customer", "conversations", params] as const,
    messages: (conversationId: string, params: ListParams = {}) =>
      ["conversation", conversationId, "messages", params] as const,
    addresses: ["customer", "addresses"] as const,
    returns: (params: ListParams = {}) => ["customer", "returns", params] as const,
    returnEligibility: (orderNumber: string) =>
      ["customer", "return-eligibility", orderNumber] as const,
  },
  agent: {
    stats: ["agent", "stats"] as const,
    conversations: (params: AgentConversationParams = {}) =>
      ["agent", "conversations", params] as const,
    conversation: (conversationId: string) =>
      ["agent", "conversation", conversationId] as const,
    messages: (conversationId: string, params: ListParams = {}) =>
      ["agent", "conversation", conversationId, "messages", params] as const,
    tickets: (params: TicketListParams = {}) => ["agent", "tickets", params] as const,
  },
  admin: {
    stats: ["admin", "stats"] as const,
    orders: (params: OrderListParams = {}) => ["admin", "orders", params] as const,
    order: (orderNumber: string) => ["admin", "order", orderNumber] as const,
    agents: (params: ListParams = {}) => ["admin", "agents", params] as const,
    tickets: (params: TicketListParams = {}) => ["admin", "tickets", params] as const,
    knowledge: (params: ListParams & { category?: string } = {}) =>
      ["admin", "knowledge", params] as const,
    aiRuns: (params: ListParams & { status?: string; traceId?: string } = {}) =>
      ["admin", "ai-runs", params] as const,
    auditLogs: (params: ListParams & { action?: string; entityType?: string } = {}) =>
      ["admin", "audit-logs", params] as const,
    settings: ["admin", "settings"] as const,
  },
}

// ── Customer ───────────────────────────────────────────────

export function useMyOrders(params: OrderListParams = {}) {
  return useQuery({
    queryKey: queryKeys.customer.orders(params),
    queryFn: () => customerApi.orders(params),
  })
}

export function useMyOrder(orderNumber: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customer.order(orderNumber ?? ""),
    queryFn: () => customerApi.order(orderNumber as string),
    enabled: Boolean(orderNumber),
  })
}

export function useMyTickets(params: TicketListParams = {}) {
  return useQuery({
    queryKey: queryKeys.customer.tickets(params),
    queryFn: () => customerApi.tickets(params),
  })
}

export function useMyTicket(ticketNumber: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customer.ticket(ticketNumber ?? ""),
    queryFn: () => customerApi.ticket(ticketNumber as string),
    enabled: Boolean(ticketNumber),
  })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TicketCreateInput) =>
      customerApi.createTicket(input, crypto.randomUUID()),
    onSuccess: (ticket: Ticket) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "tickets"] })
      queryClient.setQueryData(queryKeys.customer.ticket(ticket.ticketNumber), ticket)
    },
  })
}

export function useMyConversations(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.customer.conversations(params),
    queryFn: () => customerApi.conversations(params),
  })
}

export function useConversationMessages(conversationId: string | undefined, params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.customer.messages(conversationId ?? "", params),
    queryFn: () => customerApi.messages(conversationId as string, params),
    enabled: Boolean(conversationId),
  })
}

export function useMyAddresses() {
  return useQuery({
    queryKey: queryKeys.customer.addresses,
    queryFn: () => customerApi.addresses(),
  })
}

export function useMyReturns(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.customer.returns(params),
    queryFn: () => customerApi.returns(params),
  })
}

export function useReturnEligibility(orderNumber: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customer.returnEligibility(orderNumber ?? ""),
    queryFn: () => customerApi.returnEligibility(orderNumber as string),
    enabled: Boolean(orderNumber),
  })
}

export function useCreateReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { orderNumber: string; reasonCode: string; reasonText?: string }) =>
      customerApi.createReturn(input, crypto.randomUUID()),
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "returns"] })
      queryClient.invalidateQueries({
        queryKey: queryKeys.customer.returnEligibility(input.orderNumber),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.order(input.orderNumber) })
      queryClient.invalidateQueries({ queryKey: ["customer", "orders"] })
    },
  })
}

// ── Agent ──────────────────────────────────────────────────

export function useAgentStats() {
  return useQuery({ queryKey: queryKeys.agent.stats, queryFn: () => agentApi.stats() })
}

export function useAgentConversations(params: AgentConversationParams = {}) {
  return useQuery({
    queryKey: queryKeys.agent.conversations(params),
    queryFn: () => agentApi.conversations(params),
  })
}

export function useAgentConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agent.conversation(conversationId ?? ""),
    queryFn: () => agentApi.conversation(conversationId as string),
    enabled: Boolean(conversationId),
  })
}

export function useAgentMessages(conversationId: string | undefined, params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.agent.messages(conversationId ?? "", params),
    queryFn: () => agentApi.messages(conversationId as string, params),
    enabled: Boolean(conversationId),
  })
}

function useConversationMutation<TArgs>(
  conversationId: string,
  mutationFn: (args: TArgs) => Promise<unknown>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agent.conversation(conversationId) })
      queryClient.invalidateQueries({ queryKey: ["agent", "conversations"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.agent.stats })
    },
  })
}

export function useReplyToConversation(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => agentApi.reply(conversationId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.agent.messages(conversationId),
      })
      queryClient.invalidateQueries({ queryKey: ["agent", "conversations"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.agent.stats })
    },
  })
}

export function useAssignConversation(conversationId: string) {
  return useConversationMutation<string | null>(conversationId, (agentId) =>
    agentApi.assign(conversationId, agentId)
  )
}

export function useTakeoverConversation(conversationId: string) {
  return useConversationMutation(conversationId, () => agentApi.takeover(conversationId))
}

export function useResolveConversation(conversationId: string) {
  return useConversationMutation(conversationId, (note?: string) =>
    agentApi.resolve(conversationId, note)
  )
}

export function useAgentTickets(params: TicketListParams = {}) {
  return useQuery({
    queryKey: queryKeys.agent.tickets(params),
    queryFn: () => agentApi.tickets(params),
  })
}

export function useUpdateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      ticketNumber,
      ...input
    }: {
      ticketNumber: string
      status?: string
      priority?: string
      assignedAgentId?: string | null
      resolutionNote?: string
    }) => agentApi.updateTicket(ticketNumber, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", "tickets"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] })
    },
  })
}

// ── Admin ──────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({ queryKey: queryKeys.admin.stats, queryFn: () => adminApi.stats() })
}

export function useAdminOrders(params: OrderListParams = {}) {
  return useQuery({
    queryKey: queryKeys.admin.orders(params),
    queryFn: () => adminApi.orders(params),
  })
}

export function useAdminOrder(orderNumber: string | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.order(orderNumber ?? ""),
    queryFn: () => adminApi.order(orderNumber as string),
    enabled: Boolean(orderNumber),
  })
}

export function useAdminAgents(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.admin.agents(params),
    queryFn: () => adminApi.agents(params),
  })
}

export function useAdminTickets(params: TicketListParams = {}) {
  return useQuery({
    queryKey: queryKeys.admin.tickets(params),
    queryFn: () => adminApi.tickets(params),
  })
}

export function useAdminKnowledge(params: ListParams & { category?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.admin.knowledge(params),
    queryFn: () => adminApi.knowledge(params),
  })
}

export function useUploadKnowledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminApi.uploadKnowledge,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "knowledge"] }),
  })
}

export function useDeleteKnowledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminApi.deleteKnowledge,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "knowledge"] }),
  })
}

export function useAdminAiRuns(params: ListParams & { status?: string; traceId?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.admin.aiRuns(params),
    queryFn: () => adminApi.aiRuns(params),
  })
}

export function useAdminAuditLogs(
  params: ListParams & { action?: string; entityType?: string } = {}
) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(params),
    queryFn: () => adminApi.auditLogs(params),
  })
}

export function useAdminSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.admin.settings,
    queryFn: () => adminApi.settings(),
    enabled: options.enabled ?? true,
  })
}

export type { Order, OrderSummary }
