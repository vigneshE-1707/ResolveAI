"""Turn orchestration: persistence, graph execution, SSE frames.

The runner is the only place that knows both the DB and the graph. Nodes stay
pure; identity is passed in from the verified JWT by the API layer.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections.abc import AsyncIterator, Callable
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AnyMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.checkpointer import checkpointer_manager
from app.agents.graph import build_graph
from app.agents.llm import get_chat_model
from app.agents.nodes import Classifier, LLMClassifier, message_text
from app.agents.tools import build_customer_tools
from app.core.config import settings
from app.core.errors import AppError, ModelUnavailableError
from app.models.audit import AiRun
from app.models.conversation import Conversation, Message
from app.repositories.analytics_repo import AiRunRepository
from app.repositories.conversation_repo import MessageRepository
from app.services.conversation_service import ConversationService

logger = logging.getLogger("resolveai.agent")

LLMFactory = Callable[[], BaseChatModel]
ClassifierFactory = Callable[[BaseChatModel], Classifier]
ToolFactory = Callable[[AsyncSession, uuid.UUID], list[BaseTool]]

ChatFrame = dict[str, Any]


def sse_frame(frame: ChatFrame) -> str:
    payload = json.dumps(frame, ensure_ascii=False, default=str)
    return f"event: frame\ndata: {payload}\n\n"


def _to_lc_message(message: Message) -> AnyMessage:
    if message.role == "user":
        return HumanMessage(content=message.content, id=str(message.id))
    if message.role == "system":
        return SystemMessage(content=message.content, id=str(message.id))
    if message.role == "agent":
        return AIMessage(content=message.content, id=str(message.id), name="support_agent")
    return AIMessage(content=message.content, id=str(message.id))


class AgentRunner:
    def __init__(
        self,
        session: AsyncSession,
        *,
        llm_factory: LLMFactory | None = None,
        classifier_factory: ClassifierFactory | None = None,
        tool_factory: ToolFactory | None = None,
        checkpointer: BaseCheckpointSaver | None = None,
    ) -> None:
        self.session = session
        self.conversations = ConversationService(session)
        self.messages = MessageRepository(session)
        self.ai_runs = AiRunRepository(session)
        self._llm_factory = llm_factory or get_chat_model
        self._classifier_factory = classifier_factory or LLMClassifier
        self._tool_factory = tool_factory or build_customer_tools
        self._checkpointer = checkpointer

    async def stream_turn(
        self,
        *,
        conversation: Conversation,
        customer_id: uuid.UUID,
        content: str,
        turn_id: str,
    ) -> AsyncIterator[ChatFrame]:
        existing = await self.messages.get_by_trace_id(conversation.id, turn_id)
        if existing is not None:
            # A retried request replays the stored answer instead of running
            # the model (and mutating anything) a second time.
            yield {"type": "token", "value": existing.content}
            if existing.card:
                yield {"type": "card", **existing.card}
            yield {"type": "turn_status", "value": "complete"}
            yield {"type": "done", "turn_id": turn_id}
            return

        user_message = await self.conversations.add_message(conversation.id, "user", content)

        run = AiRun(
            conversation_id=conversation.id,
            trace_id=turn_id,
            graph_version=settings.agent_graph_version,
            model_name=settings.llm_model,
            status="running",
        )
        await self.ai_runs.create(run)
        await self.session.commit()

        started = time.perf_counter()
        status = "success"
        error_code: str | None = None
        usage: dict[str, int] = {}
        tool_calls: list[dict[str, Any]] | None = None
        message_id: uuid.UUID | None = None

        yield {"type": "turn_status", "value": "streaming"}

        try:
            llm = self._llm_factory()
            checkpointer = await self._resolve_checkpointer()
            graph = build_graph(
                llm=llm,
                tools=self._tool_factory(self.session, customer_id),
                classifier=self._classifier_factory(llm),
                history_loader=self._history_loader,
                checkpointer=checkpointer,
            )
            config = {
                "configurable": {"thread_id": str(conversation.id)},
                "metadata": {"turn_id": turn_id, "conversation_id": str(conversation.id)},
            }
            input_state = {
                "conversation_id": str(conversation.id),
                "customer_id": str(customer_id),
                "turn_id": turn_id,
                "messages": [
                    HumanMessage(content=content, id=str(user_message.id))
                ],
                "tool_results": [],
                "errors": [],
                "reply": "",
                "card": None,
                "usage": {},
            }

            async with asyncio.timeout(settings.agent_turn_timeout_seconds):
                async for chunk, metadata in graph.astream(
                    input_state, config=config, stream_mode="messages"
                ):
                    if metadata.get("langgraph_node") != "compose_response":
                        continue
                    text = message_text(chunk.content)
                    if text:
                        yield {"type": "token", "value": text}

                snapshot = await graph.aget_state(config)

            values = snapshot.values if snapshot else {}
            reply = (values.get("reply") or "").strip()
            card = values.get("card")
            usage = values.get("usage") or {}
            tool_calls = [
                {"name": item.get("name"), "ok": bool((item.get("result") or {}).get("ok"))}
                for item in values.get("tool_results") or []
            ]

            if not reply:
                raise ModelUnavailableError("The assistant returned an empty response")

            latency_ms = int((time.perf_counter() - started) * 1000)
            assistant = await self.conversations.add_message(
                conversation.id,
                "assistant",
                reply,
                card=card,
                trace_id=turn_id,
                latency_ms=latency_ms,
                token_usage=usage or None,
            )
            message_id = assistant.id

            if card:
                yield {"type": "card", **card}
            yield {"type": "turn_status", "value": "complete"}
            yield {"type": "done", "turn_id": turn_id}

        except asyncio.CancelledError:
            status = "interrupted"
            error_code = "client_disconnected"
            raise
        except TimeoutError:
            status = "timeout"
            error_code = "turn_timeout"
            yield {
                "type": "error",
                "code": error_code,
                "message": "The assistant took too long to respond. Please try again.",
            }
            yield {"type": "done", "turn_id": turn_id}
        except AppError as exc:
            status = "error"
            error_code = exc.code
            yield {"type": "error", "code": exc.code, "message": exc.message}
            yield {"type": "done", "turn_id": turn_id}
        except Exception as exc:
            status = "error"
            error_code = "agent_error"
            logger.exception(
                "Agent turn failed",
                extra={"event": "agent_turn_failed", "turn_id": turn_id},
            )
            yield {
                "type": "error",
                "code": error_code,
                "message": "The assistant is temporarily unavailable. Please try again.",
            }
            yield {"type": "done", "turn_id": turn_id}
        finally:
            await self._finish_run(
                run.id,
                status=status,
                error_code=error_code,
                latency_ms=int((time.perf_counter() - started) * 1000),
                usage=usage,
                tool_calls=tool_calls,
                message_id=message_id,
            )

    async def _resolve_checkpointer(self) -> BaseCheckpointSaver:
        if self._checkpointer is not None:
            return self._checkpointer
        return await checkpointer_manager.get()

    async def _history_loader(self, conversation_id: str) -> list[AnyMessage]:
        rows = await self.messages.list_recent(
            uuid.UUID(conversation_id), limit=settings.agent_history_messages
        )
        return [_to_lc_message(row) for row in rows if row.content]

    async def _finish_run(
        self,
        run_id: uuid.UUID,
        *,
        status: str,
        error_code: str | None,
        latency_ms: int,
        usage: dict[str, int],
        tool_calls: list[dict[str, Any]] | None,
        message_id: uuid.UUID | None,
    ) -> None:
        try:
            await self.ai_runs.update(
                run_id,
                status=status,
                error_code=error_code,
                latency_ms=latency_ms,
                prompt_tokens=int(usage.get("prompt_tokens", 0)),
                completion_tokens=int(usage.get("completion_tokens", 0)),
                tool_calls=tool_calls,
                message_id=message_id,
            )
            await self.session.commit()
        except Exception as exc:  # never mask the original turn outcome
            await self.session.rollback()
            logger.warning(
                "Could not finalise ai_run",
                extra={"event": "ai_run_finalize_failed", "error_type": type(exc).__name__},
            )
