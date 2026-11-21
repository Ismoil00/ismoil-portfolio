"""The AI assistant's rules without a database or Groq: visitor limits, the free-quota guard and its model
fallback, what the model is told, and what's kept of a question."""

import json

import anyio
import anyio.lowlevel
import pytest

from app.core.errors import AppError, ServiceUnavailable, TooManyRequests
from app.schemas.chat import ChatIn
from app.services.chat import Asker, ChatService, normalize, redact
from app.services.chat_prompt import RULES, build_messages
from tests.unit.fakes import FakeChatModel, FakeChatRepository, FakeClock

FACTS = "FACTS (the website's content)\n\n## Person\nName: Ismoil Sharifov"
MODELS = ["model-a", "model-b", "model-c"]
VISITOR = Asker(ip_hash="ip-1", net_hash="net-1", session_hash="cookie-1")


@pytest.fixture
def chat_settings(settings):
    return settings.model_copy(
        update={
            "chat_models": MODELS,
            "chat_model_tokens_per_day": 100_000,
            "chat_model_requests_per_day": 50,
            "chat_model_tokens_per_minute": 20_000,
            "chat_hour_share": 4,
            "chat_max_per_10_minutes": 6,
            "chat_max_per_day": 20,
            "chat_max_per_network_per_day": 40,
            "chat_max_turns": 12,
            "chat_answer_max_tokens": 400,
        }
    )


def make(chat_settings, model=None, *, enabled=True, repo=None, clock=None, paused=None):
    return ChatService(
        repo or FakeChatRepository(),
        chat_settings,
        model if model is not None else FakeChatModel(),
        enabled=enabled,
        paused=paused,
        clock=clock or FakeClock(),
    )


def ask(question="What has he built?", *, history=(), locale="en", page=None, save=False) -> ChatIn:
    messages = [{"role": role, "content": text} for role, text in history] + [{"role": "user", "content": question}]
    return ChatIn(messages=messages, locale=locale, page=page, save_question=save)


async def facts() -> str:
    return FACTS


async def run(service: ChatService, data: ChatIn, asker: Asker = VISITOR) -> tuple[list[dict], list[tuple]]:
    """Asks, reads the whole stream, returns its lines and what was recorded at the end."""
    recorded: list[tuple] = []

    async def record(usage_id, model, tokens):
        recorded.append((usage_id, model, tokens))
        await service.repo.finish_usage(usage_id, model, tokens)  # as the endpoint does, in a new session

    answer = await service.start(data, asker, facts)
    lines = [json.loads(line) async for line in service.stream(answer, record)]
    return lines, recorded


def text_of(lines: list[dict]) -> str:
    return "".join(line["text"] for line in lines if line["type"] == "text")


# --- on, off and the answer -----------------------------------------------------------------------


async def test_off_without_a_model_or_when_switched_off(chat_settings):
    for service in (
        make(chat_settings, enabled=False),
        ChatService(FakeChatRepository(), chat_settings, None, enabled=True),
    ):
        with pytest.raises(ServiceUnavailable) as error:
            await service.start(ask(), VISITOR, facts)
        assert error.value.code == "chat_off"


async def test_the_answer_streams_in_pieces_and_its_tokens_are_recorded(chat_settings):
    repo, model = FakeChatRepository(), FakeChatModel(tokens=950)
    lines, recorded = await run(make(chat_settings, model, repo=repo), ask())
    assert text_of(lines) == model.answer
    assert sum(line["type"] == "text" for line in lines) > 1
    assert lines[-1] == {"type": "done"}
    assert [(m, t) for _, m, t in recorded] == [("model-a", 950)]
    assert repo.usage[0].ip_hash == "ip-1" and repo.usage[0].net_hash == "net-1"
    assert repo.usage[0].session_hash == "cookie-1"
    assert model.calls[0][0] == "model-a" and model.calls[0][2] == 400


# --- what the model is told ---------------------------------------------------------------------


def test_rules_and_facts_come_first_and_are_the_same_for_everyone():
    one = build_messages(FACTS, ask("Who is he?", locale="ru", page="/ru/projects/shop"))
    two = build_messages(FACTS, ask("Does he know Docker?", history=[("user", "Hi"), ("assistant", "Hello")]))
    assert one[0] == two[0] == {"role": "system", "content": f"{RULES}\n\n{FACTS}"}
    # The changing parts come last: the question with the site language and the page, without its language.
    assert one[-1] == {"role": "user", "content": "(Site language: Russian. Page: /projects/shop.)\nWho is he?"}
    assert two[1:3] == [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello"}]


def test_only_the_last_three_exchanges_go_along_and_long_answers_are_cut():
    history = [
        (r, f"{r} {i}" + ("x" * 2000 if r == "assistant" else "")) for i in range(5) for r in ("user", "assistant")
    ]
    messages = build_messages(FACTS, ask("Next?", history=history))
    assert len(messages) == 1 + 6 + 1
    assert messages[1]["content"] == "user 2"
    assert all(len(m["content"]) <= 800 for m in messages[1:-1])


async def test_a_long_conversation_has_to_start_over(chat_settings):
    history = [(r, "text") for _ in range(12) for r in ("user", "assistant")]
    with pytest.raises(AppError) as error:
        await make(chat_settings).start(ask(history=history), VISITOR, facts)
    assert error.value.code == "chat_turns"


# --- visitor limits -------------------------------------------------------------------------------


async def test_a_visitor_can_ask_six_questions_in_ten_minutes(chat_settings):
    clock = FakeClock()
    service = make(chat_settings, clock=clock)
    for _ in range(6):
        await run(service, ask())
        clock.advance(seconds=30)
    with pytest.raises(TooManyRequests) as error:
        await service.start(ask(), VISITOR, facts)
    assert error.value.code == "chat_limit"
    assert 0 < error.value.retry_after <= 600
    clock.advance(minutes=10)
    await run(service, ask())


async def test_a_new_cookie_doesnt_reset_the_limit_of_the_same_address(chat_settings):
    service = make(chat_settings)
    for i in range(6):
        await run(service, ask(), Asker(ip_hash="ip-1", net_hash="net-1", session_hash=f"cookie-{i}"))
    with pytest.raises(TooManyRequests):
        await service.start(ask(), Asker(ip_hash="ip-1", net_hash="net-1", session_hash="fresh"), facts)


async def test_a_new_address_doesnt_reset_the_limit_of_the_same_cookie(chat_settings):
    service = make(chat_settings)
    for i in range(6):
        await run(service, ask(), Asker(ip_hash=f"ip-{i}", net_hash=f"net-{i}", session_hash="cookie-1"))
    with pytest.raises(TooManyRequests):
        await service.start(ask(), Asker(ip_hash="ip-new", net_hash="net-new", session_hash="cookie-1"), facts)


async def test_a_visitor_can_ask_twenty_questions_a_day(chat_settings):
    clock = FakeClock()
    service = make(chat_settings, clock=clock)
    for _ in range(20):
        await run(service, ask())
        clock.advance(minutes=11)
    with pytest.raises(TooManyRequests) as error:
        await service.start(ask(), VISITOR, facts)
    assert error.value.retry_after > 600  # waiting ten minutes isn't enough


async def test_hopping_between_addresses_of_one_network_is_limited(chat_settings):
    service = make(chat_settings.model_copy(update={"chat_max_per_network_per_day": 3}))
    for i in range(3):
        await run(service, ask(), Asker(ip_hash=f"ip-{i}", net_hash="net-1", session_hash=None))
    with pytest.raises(TooManyRequests) as error:
        await service.start(ask(), Asker(ip_hash="ip-9", net_hash="net-1", session_hash=None), facts)
    assert error.value.code == "chat_limit"


# --- the free-quota guard -------------------------------------------------------------------------


def _many_visitors():
    for i in range(1000):
        yield Asker(ip_hash=f"ip-{i}", net_hash=f"net-{i}", session_hash=f"cookie-{i}")


async def test_the_next_model_answers_when_one_has_used_its_daily_share(chat_settings):
    repo, model = FakeChatRepository(), FakeChatModel()
    service = make(chat_settings.model_copy(update={"chat_model_requests_per_day": 2}), model, repo=repo)
    visitors = _many_visitors()
    used = []
    for _ in range(5):
        _, recorded = await run(service, ask(), next(visitors))
        used.append(recorded[0][1])
    assert used == ["model-a", "model-a", "model-b", "model-b", "model-c"]


async def test_one_hour_cant_use_more_than_its_slice_of_the_day(chat_settings):
    clock = FakeClock()
    # 100k a day, at most a quarter (25k) an hour per model. Each answer counts 12.5k, so two per model fit
    # in the hour: the third one's estimate goes over.
    service = make(
        chat_settings.model_copy(update={"chat_model_tokens_per_minute": 100_000}),
        FakeChatModel(tokens=12_500),
        clock=clock,
    )
    visitors = _many_visitors()
    for _ in range(6):
        await run(service, ask(), next(visitors))
    with pytest.raises(TooManyRequests) as error:
        await service.start(ask(), next(visitors), facts)
    assert error.value.code == "chat_busy" and error.value.retry_after == 600
    clock.advance(minutes=61)
    await run(service, ask(), next(visitors))


async def test_a_burst_waits_for_the_next_minute(chat_settings):
    clock = FakeClock()
    # 5k a minute per model; each answer counts 2.5k, so two per model fit.
    service = make(
        chat_settings.model_copy(update={"chat_model_tokens_per_minute": 5_000}),
        FakeChatModel(tokens=2_500),
        clock=clock,
    )
    visitors = _many_visitors()
    for _ in range(6):
        await run(service, ask(), next(visitors))
    with pytest.raises(TooManyRequests) as error:
        await service.start(ask(), next(visitors), facts)
    assert error.value.code == "chat_busy" and error.value.retry_after == 60
    clock.advance(seconds=61)
    await run(service, ask(), next(visitors))


async def test_a_model_groq_refuses_hands_over_to_the_next_and_rests(chat_settings):
    paused: dict = {}
    model = FakeChatModel(limited=("model-a",))
    lines, recorded = await run(make(chat_settings, model, paused=paused), ask())
    assert text_of(lines) == model.answer and lines[-1] == {"type": "done"}
    assert [call[0] for call in model.calls] == ["model-a", "model-b"]
    assert recorded[0][1] == "model-b"
    assert "model-a" in paused
    # While it rests, the next question doesn't even try it.
    model.calls.clear()
    await run(make(chat_settings, model, paused=paused), ask(), Asker(ip_hash="ip-2", net_hash="net-2"))
    assert [call[0] for call in model.calls] == ["model-b"]


async def test_when_every_model_refuses_the_visitor_is_told_its_busy(chat_settings):
    lines, recorded = await run(make(chat_settings, FakeChatModel(limited=tuple(MODELS))), ask())
    assert lines == [{"type": "error", "code": "chat_busy"}]
    assert recorded[0][2] == 0  # nothing was written: nothing counted


async def test_an_answer_cut_off_midway_isnt_restarted_and_counts_its_estimate(chat_settings):
    service = make(chat_settings, FakeChatModel(cut_after=1))
    lines, recorded = await run(service, ask())
    assert lines[0]["type"] == "text"
    assert lines[-1] == {"type": "error", "code": "chat_failed"}
    assert recorded[0][2] > 400  # the cautious estimate stays


async def test_a_refused_question_gets_an_error_line(chat_settings):
    lines, _ = await run(make(chat_settings, FakeChatModel(fail=True)), ask())
    assert lines == [{"type": "error", "code": "chat_failed"}]


# --- what's kept of a question --------------------------------------------------------------------


async def test_the_question_is_kept_only_with_analytics_consent_and_masked(chat_settings):
    repo = FakeChatRepository()
    service = make(chat_settings, repo=repo)
    await run(service, ask("Can he call me? I'm at anna@example.com, +992 93 123 45 67", save=True))
    await run(service, ask("Not kept", save=False), Asker(ip_hash="ip-2", net_hash="net-2"))
    assert [q.question for q in repo.questions] == ["Can he call me? I'm at [email], [phone]"]
    assert repo.questions[0].locale == "en"


@pytest.mark.parametrize(
    ("text", "masked"),
    [
        ("Write to me: a.b@mail.co", "Write to me: [email]"),
        ("See https://example.com/x?y=1 please", "See [link] please"),
        ("Call +7 (900) 123-45-67", "Call [phone]"),
        ("Projects from 2020-2024?", "Projects from 2020-2024?"),  # years aren't phone numbers
    ],
)
def test_masking(text, masked):
    assert redact(text) == masked


def test_the_same_question_is_grouped_whatever_its_case_spaces_and_punctuation():
    assert normalize("  What has he   BUILT?! ") == normalize("what has he built") == "what has he built"


async def test_an_answer_the_visitor_stops_still_counts_its_tokens(chat_settings):
    """Stop in the panel cancels the request on the server: the count must still be saved, whole."""

    class SlowModel:
        async def stream(self, model, messages, max_tokens):
            yield "Ismoil built"
            await anyio.sleep(30)  # the visitor presses Stop while the rest is being written
            yield " more"

    service = make(chat_settings, SlowModel())
    answer = await service.start(ask(), VISITOR, facts)
    recorded = []
    first_piece = anyio.Event()

    async def record(usage_id, model, tokens):
        await anyio.lowlevel.checkpoint()  # a real save waits on the database
        recorded.append((model, tokens))

    async def read():
        async for _ in service.stream(answer, record):
            first_piece.set()

    async with anyio.create_task_group() as group:
        group.start_soon(read)
        await first_piece.wait()
        group.cancel_scope.cancel()

    assert recorded == [("model-a", answer.estimate)]


async def test_the_minute_limit_counts_the_whole_prompt_as_groq_does(chat_settings):
    """Groq checks its per-minute limit against the whole prompt, even when most of it comes from its cache
    (and so isn't counted in the day's budget): a burst of small counted answers still has to wait."""
    estimate = int(sum(len(m["content"]) for m in build_messages(FACTS, ask())) / 3.5) + 400
    clock = FakeClock()
    service = make(
        chat_settings.model_copy(update={"chat_model_tokens_per_minute": int(estimate * 2.5)}),
        FakeChatModel(tokens=50),  # almost everything came from the cache
        clock=clock,
    )
    visitors = _many_visitors()
    for _ in range(6):  # two whole prompts per model fit in a minute
        await run(service, ask(), next(visitors))
    with pytest.raises(TooManyRequests) as error:
        await service.start(ask(), next(visitors), facts)
    assert error.value.code == "chat_busy" and error.value.retry_after == 60


async def test_a_model_that_cant_be_reached_hands_over_without_resting(chat_settings):
    """A failed connection says nothing about a model's quota: the next model is tried, none is set aside."""
    paused: dict = {}
    model = FakeChatModel(unreachable=("model-a", "model-b"))
    lines, recorded = await run(make(chat_settings, model, paused=paused), ask())
    assert lines[-1] == {"type": "done"} and recorded[0][1] == "model-c"
    assert paused == {}


async def test_when_no_model_can_be_reached_the_visitor_can_simply_try_again(chat_settings):
    lines, recorded = await run(make(chat_settings, FakeChatModel(unreachable=tuple(MODELS))), ask())
    assert lines == [{"type": "error", "code": "chat_failed"}]  # "try again", not "busy, come back later"
    assert recorded[0][2] == 0
