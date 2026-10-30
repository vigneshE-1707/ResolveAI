"""Import all models so Alembic and Base.metadata can discover them."""
from app.models.user import User, Customer, SupportAgent, CustomerAddress
from app.models.product import Product
from app.models.order import Order, OrderItem, Shipment, ReturnRequest
from app.models.ticket import SupportTicket
from app.models.conversation import Conversation, Message, ConversationEvent
from app.models.knowledge import KnowledgeDocument, KnowledgeChunk
from app.models.audit import AiRun, IdempotencyKey, AuditLog

__all__ = [
    "User", "Customer", "SupportAgent", "CustomerAddress",
    "Product",
    "Order", "OrderItem", "Shipment", "ReturnRequest",
    "SupportTicket",
    "Conversation", "Message", "ConversationEvent",
    "KnowledgeDocument", "KnowledgeChunk",
    "AiRun", "IdempotencyKey", "AuditLog",
]
