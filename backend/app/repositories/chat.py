"""Database access for the AI assistant: usage counters and the questions for "Top questions"."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import InstrumentedAttribute

from app.models import ChatQuestion, ChatUsage
from app.repositories.base import Repository


@dataclass(frozen=True)
class ModelUse:
    """What one model has used: requests and tokens in the last day, tokens in the last hour, requests and
    tokens in the last minute."""

    requests_day: int
    tokens_day: int
    tokens_hour: int
    requests_minute: int
    tokens_minute: int


class ChatRepository(Repository):
    async def add_usage(self, row: ChatUsage) -> None:
        self.session.add(row)
        await self.session.flush()

    async def finish_usage(self, usage_id: uuid.UUID, model: str, tokens: int) -> None:
        row = await self.session.get(ChatUsage, usage_id)
        if row is not None:
            row.model, row.tokens = model, tokens

    async def times_since(self, column: InstrumentedAttribute, value: str, since: datetime) -> list[datetime]:
        """When the questions with this key were asked (oldest first), like MessagesRepository.sent_since."""
        query = select(ChatUsage.created_at).where(column == value, ChatUsage.created_at >= since)
        return list(await self.session.scalars(query.order_by(ChatUsage.created_at)))

    async def model_use(self, model: str, *, day: datetime, hour: datetime, minute: datetime) -> ModelUse:
        def tokens_since(since: datetime):
            return func.coalesce(func.sum(ChatUsage.tokens).filter(ChatUsage.created_at >= since), 0)

        row = (
            await self.session.execute(
                select(
                    func.count(),
                    tokens_since(day),
                    tokens_since(hour),
                    func.count().filter(ChatUsage.created_at >= minute),
                    tokens_since(minute),
                ).where(ChatUsage.model == model, ChatUsage.created_at >= day)
            )
        ).one()
        return ModelUse(*(int(v) for v in row))

    async def add_question(self, row: ChatQuestion) -> None:
        self.session.add(row)
        await self.session.flush()

    async def top_questions(self, since: datetime, limit: int) -> list[tuple[str, int]]:
        """The most asked questions (same wording up to case, spacing and closing punctuation). Each is shown
        in one of its wordings, preferring capitals ("What has he built?" over "what has he built")."""
        rows = await self.session.execute(
            select(func.min(ChatQuestion.question.collate("C")), func.count())
            .where(ChatQuestion.created_at >= since)
            .group_by(ChatQuestion.normalized)
            .order_by(func.count().desc(), ChatQuestion.normalized)
            .limit(limit)
        )
        return [(question, count) for question, count in rows]

    async def forget(self, *, usage_before: datetime, questions_before: datetime) -> None:
        await self.session.execute(delete(ChatUsage).where(ChatUsage.created_at < usage_before))
        await self.session.execute(delete(ChatQuestion).where(ChatQuestion.created_at < questions_before))
