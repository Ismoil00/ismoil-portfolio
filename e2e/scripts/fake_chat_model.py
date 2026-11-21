"""A stand-in for Groq in the end-to-end tests: the real model is never called from tests.

It answers like the real one would (in pieces, as it's written), from the seeded content: a short answer
with a link to a seeded project page and a list. A question containing "slowly" is answered slowly (about
ten seconds), so the tests can press Stop while it's still being written.
"""

import asyncio

from app.repositories.chat_model import Usage

ANSWER = (
    "Ismoil built three projects, for example the [Banking and public-sector backend](/projects/bank-backend).\n\n"
    "- Government services platform\n"
    "- Search-heavy national portal"
)


class FakeChatModel:
    async def stream(self, model: str, messages: list[dict[str, str]], max_tokens: int):
        slow = "slowly" in messages[-1]["content"].lower()
        words = ANSWER.split(" ")
        pace = 10 / len(words) if slow else 0.02
        for i, word in enumerate(words):
            await asyncio.sleep(pace)
            yield word if i == 0 else f" {word}"
        yield Usage(tokens=50)
