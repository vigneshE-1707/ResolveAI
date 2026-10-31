"""Application-wide constants."""
from __future__ import annotations

# Roles
ROLE_CUSTOMER = "CUSTOMER"
ROLE_SUPPORT_AGENT = "SUPPORT_AGENT"
ROLE_ADMIN = "ADMIN"
ALL_ROLES = {ROLE_CUSTOMER, ROLE_SUPPORT_AGENT, ROLE_ADMIN}

# Order statuses
ORDER_STATUSES = {"pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"}

# Shipment statuses
SHIPMENT_STATUSES = {"prepared", "in_transit", "out_for_delivery", "delivered", "exception"}

# Ticket statuses & priorities
TICKET_STATUSES = {"open", "in_progress", "pending_customer", "resolved", "closed"}
TICKET_PRIORITIES = {"low", "normal", "high", "urgent"}
TICKET_CATEGORIES = {
    "order_status", "delivery_issue", "wrong_item", "return_request",
    "cancellation", "refund", "billing", "product_quality", "other",
}

# Conversation
CONVERSATION_MODES = {"ai", "human_pending", "human"}
CONVERSATION_STATUSES = {"open", "escalated", "resolved", "closed"}

# Message roles
MESSAGE_ROLES = {"user", "assistant", "agent", "system", "tool"}
MESSAGE_CONTENT_TYPES = {"text", "card", "system_note"}

# Return request statuses
RETURN_STATUSES = {"requested", "approved", "rejected", "refunded", "closed"}
RETURN_REASON_CODES = {
    "wrong_item", "damaged", "not_as_described", "changed_mind", "late_delivery", "other",
}

# Knowledge
KNOWLEDGE_CATEGORIES = {"returns", "refunds", "shipping", "cancellation", "warranty", "faq"}
KNOWLEDGE_STATUSES = {"processing", "ready", "failed"}

# Loyalty tiers
LOYALTY_TIERS = {"standard", "premium", "vip"}

# Pagination defaults
DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
