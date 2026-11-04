"""Integration tests for agent answering policy questions with citations and honest fallback."""
from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from sqlalchemy import select

from app.agents.runner import AgentRunner
from app.db.session import async_session_factory
from app.knowledge.ingest import ingest_document
from app.models.conversation import Message
from app.models.knowledge import KnowledgeDocument
from app.models.user import Customer
from tests.fakes import FakeToolCallingModel, KeywordClassifier


class ScriptedModels:
    def __init__(self, scripts: list[list[AIMessage]]):
        self.scripts = scripts
        self.models: list[FakeToolCallingModel] = []

    def __call__(self) -> FakeToolCallingModel:
        script = self.scripts[min(len(self.models), len(self.scripts) - 1)]
        model = FakeToolCallingModel(responses=list(script))
        self.models.append(model)
        return model


@pytest.mark.asyncio
async def test_agent_answers_policy_question_with_citations(make_user):
    user_id = await make_user("CUSTOMER", "policy_customer@resolveai.app")

    async with async_session_factory() as session:
        stmt = select(Customer).where(Customer.user_id == user_id)
        customer = (await session.execute(stmt)).scalar_one()

        # 1. Ingest Return Policy
        doc = KnowledgeDocument(
            title="Returns & Exchanges Policy",
            category="returns",
            content_text=(
                "Items may be returned within 30 days of delivery, not from the order date.\n\n"
                "To be eligible, the item must be unused, in its original packaging, and include all accessories.\n\n"
                "Prepaid shipping labels are provided for approved returns."
            ),
            status="processing",
        )
        session.add(doc)
        await session.flush()
        await ingest_document(session, doc.id)
        await session.commit()

    async with async_session_factory() as session:
        # 2. Setup runner with scripted model
        reply_text = (
            "According to our [Returns & Exchanges Policy], items may be returned within 30 days of "
            "delivery provided they are unused and in original packaging."
        )
        models = ScriptedModels([[AIMessage(content=reply_text)]])
        runner = AgentRunner(
            session=session,
            llm_factory=models,
            classifier_factory=lambda _: KeywordClassifier(),
            checkpointer=InMemorySaver(),
        )

        conv = await runner.conversations.create_conversation(
            customer.id, "Return policy inquiry"
        )

        # 3. Stream turn
        frames = []
        async for frame in runner.stream_turn(
            conversation=conv,
            customer_id=customer.id,
            content="What is your return policy and how many days do I have?",
            turn_id="turn-policy-1",
        ):
            frames.append(frame)

        # 4. Verify stream completed
        token_frames = [f for f in frames if f["type"] == "token"]
        assert len(token_frames) > 0
        full_text = "".join(f["value"] for f in token_frames)
        assert "30 days" in full_text

        # 5. Verify persisted assistant message has citations in `sources`
        stmt = (
            select(Message)
            .where(Message.conversation_id == conv.id, Message.role == "assistant")
            .order_by(Message.seq.desc())
        )
        assistant_msg = (await session.execute(stmt)).scalar_one()
        assert assistant_msg.content == reply_text
        assert assistant_msg.sources is not None
        assert len(assistant_msg.sources) >= 1
        assert any(s.get("title") == "Returns & Exchanges Policy" for s in assistant_msg.sources)


@pytest.mark.asyncio
async def test_agent_honest_fallback_when_policy_not_found(make_user):
    user_id = await make_user("CUSTOMER", "fallback_customer@resolveai.app")

    async with async_session_factory() as session:
        stmt = select(Customer).where(Customer.user_id == user_id)
        customer = (await session.execute(stmt)).scalar_one()

        fallback_text = (
            "I could not find information regarding space travel in our store policies. "
            "Would you like me to connect you with a human agent?"
        )
        models = ScriptedModels([[AIMessage(content=fallback_text)]])
        runner = AgentRunner(
            session=session,
            llm_factory=models,
            classifier_factory=lambda _: KeywordClassifier(),
            checkpointer=InMemorySaver(),
        )

        conv = await runner.conversations.create_conversation(
            customer.id, "Unsupported question"
        )

        frames = []
        async for frame in runner.stream_turn(
            conversation=conv,
            customer_id=customer.id,
            content="Do your store policies allow trading space rockets for gift cards?",
            turn_id="turn-fallback-1",
        ):
            frames.append(frame)

        token_frames = [f for f in frames if f["type"] == "token"]
        full_text = "".join(f["value"] for f in token_frames)
        assert "store policies" in full_text
