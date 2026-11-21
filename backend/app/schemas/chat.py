"""The public site's AI assistant: what the site's server sends for each question."""

import uuid
from typing import Annotated, Literal

from pydantic import AfterValidator, Field, model_validator

from app.core.text import clean_multiline
from app.schemas.common import InputModel

QUESTION_MAX = 500
ANSWER_MAX = 4_000  # earlier answers sent back as history; only their start reaches the model


def _clean(value: str) -> str:
    return clean_multiline(value)


class ChatMessageIn(InputModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=ANSWER_MAX), AfterValidator(_clean)]

    @model_validator(mode="after")
    def _question_length(self) -> "ChatMessageIn":
        if not self.content:
            raise ValueError("A message can't be empty")
        if self.role == "user" and len(self.content) > QUESTION_MAX:
            raise ValueError(f"A question can be at most {QUESTION_MAX} characters")
        return self


class ChatIn(InputModel):
    # The conversation so far, ending with the new question. The browser keeps it; the server trims it.
    messages: list[ChatMessageIn] = Field(min_length=1, max_length=60)
    locale: Literal["en", "ru", "tg"]
    page: str | None = Field(None, pattern=r"^/", max_length=300)  # where the visitor is on the site
    session_id: uuid.UUID | None = None  # the chat cookie, set by the site's server
    save_question: bool = False  # the visitor accepted analytics cookies

    @model_validator(mode="after")
    def _ends_with_a_question(self) -> "ChatIn":
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be the visitor's question")
        return self

    @property
    def question(self) -> str:
        return self.messages[-1].content
