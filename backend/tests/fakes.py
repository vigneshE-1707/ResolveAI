"""Deterministic chat-model fakes for agent tests (no network, no API key)."""
from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
)
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from pydantic import Field

from app.agents.state import IntentDecision, SupportIntent


class FakeToolCallingModel(BaseChatModel):
    """Returns scripted messages and records every prompt it receives."""

    responses: list[AIMessage]
    index: int = 0
    calls: list[list[BaseMessage]] = Field(default_factory=list)

    @property
    def _llm_type(self) -> str:
        return "fake-tool-calling"

    def bind_tools(self, tools: Any, **kwargs: Any) -> "FakeToolCallingModel":
        return self

    def _next(self, messages: list[BaseMessage]) -> AIMessage:
        self.calls.append(list(messages))
        message = self.responses[min(self.index, len(self.responses) - 1)]
        self.index += 1
        return message

    def _generate(
        self, messages: list[BaseMessage], stop: Any = None, run_manager: Any = None, **kwargs: Any
    ) -> ChatResult:
        return ChatResult(generations=[ChatGeneration(message=self._next(messages))])

    def _stream(
        self, messages: list[BaseMessage], stop: Any = None, run_manager: Any = None, **kwargs: Any
    ) -> Iterator[ChatGenerationChunk]:
        message = self._next(messages)
        if message.tool_calls:
            yield ChatGenerationChunk(
                message=AIMessageChunk(
                    content="",
                    tool_call_chunks=[
                        {
                            "name": call["name"],
                            "args": json.dumps(call["args"]),
                            "id": call["id"],
                            "index": index,
                        }
                        for index, call in enumerate(message.tool_calls)
                    ],
                )
            )
            return
        if not message.content:
            yield ChatGenerationChunk(message=AIMessageChunk(content=""))
            return
        for char in message.content:
            yield ChatGenerationChunk(message=AIMessageChunk(content=char))


class KeywordClassifier:
    """Small stand-in for the LLM classifier: orders when ORD- appears."""

    async def __call__(self, messages: list[BaseMessage]) -> IntentDecision:
        text = ""
        for message in reversed(messages):
            if isinstance(message, HumanMessage):
                text = str(message.content)
                break
        if "ORD-" in text.upper():
            start = text.upper().index("ORD-")
            number = text[start : start + 8]
            return IntentDecision(
                intent=SupportIntent.ORDER_STATUS, order_number=number.upper()
            )
        return IntentDecision(intent=SupportIntent.GENERAL)


def tool_call_message(order_number: str) -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[
            {
                "name": "get_order_status",
                "args": {"order_number": order_number},
                "id": "call_1",
            }
        ],
    )
