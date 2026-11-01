"""Compile the support agent graph."""
from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph

from app.agents.nodes import (
    Classifier,
    HistoryLoader,
    LLMClassifier,
    make_classify_node,
    make_compose_node,
    make_load_context_node,
    make_tools_node,
    route_intent,
)
from app.agents.state import SupportState


async def _no_history(_conversation_id: str):
    return []


def build_graph(
    *,
    llm: BaseChatModel,
    tools: list[BaseTool],
    classifier: Classifier | None = None,
    history_loader: HistoryLoader | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
):
    """Build a per-request graph.

    Tools and the history loader are closures over the caller's DB session, so
    the compiled graph is request-scoped. Compilation is cheap; the checkpointer
    (and therefore multi-turn memory) is shared across requests.
    """
    builder = StateGraph(SupportState)
    resolved_classifier = classifier if classifier is not None else LLMClassifier(llm)

    builder.add_node("load_context", make_load_context_node(history_loader or _no_history))
    builder.add_node("classify_intent", make_classify_node(resolved_classifier))
    builder.add_node("run_tools", make_tools_node(llm, tools))
    builder.add_node("compose_response", make_compose_node(llm))

    builder.add_edge(START, "load_context")
    builder.add_edge("load_context", "classify_intent")
    builder.add_conditional_edges(
        "classify_intent",
        route_intent,
        {"run_tools": "run_tools", "compose_response": "compose_response"},
    )
    builder.add_edge("run_tools", "compose_response")
    builder.add_edge("compose_response", END)

    return builder.compile(checkpointer=checkpointer)
