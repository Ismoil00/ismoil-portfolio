"""Settings page rules: which translator the admin panel offers (Claude only once its API key is set), and
the public site's AI assistant switch (only once GROQ_API_KEY is set)."""

from app.core.errors import FieldErrors
from app.models import AdminSettings
from app.models.enums import Translator
from app.repositories.settings import SettingsRepository

DEFAULT_TRANSLATOR = Translator.MANUAL


class PanelSettingsService:
    def __init__(self, repo: SettingsRepository, *, claude_ready: bool, assistant_ready: bool = False) -> None:
        self.repo = repo
        # True when the backend started with ANTHROPIC_API_KEY (app.state.translator exists).
        self.claude_ready = claude_ready
        # True when the backend started with GROQ_API_KEY (app.state.chat_model exists).
        self.assistant_ready = assistant_ready

    async def translator(self) -> Translator:
        row = await self.repo.get()
        return Translator(row.translator) if row else DEFAULT_TRANSLATOR

    async def assistant_enabled(self) -> bool:
        row = await self.repo.get()
        return bool(row and row.assistant_enabled)

    async def _row(self) -> AdminSettings:
        row = await self.repo.get()
        if row is None:
            row = AdminSettings(id=1, translator=DEFAULT_TRANSLATOR.value, assistant_enabled=False)
            await self.repo.add(row)
        return row

    async def set_translator(self, translator: Translator) -> Translator:
        if translator == Translator.CLAUDE and not self.claude_ready:
            raise FieldErrors.single(
                ("translator",), "Add ANTHROPIC_API_KEY to backend/.env and restart the backend first"
            )
        row = await self._row()
        row.translator = translator.value
        await self.repo.commit()
        return translator

    async def set_assistant(self, enabled: bool) -> bool:
        if enabled and not self.assistant_ready:
            raise FieldErrors.single(
                ("assistant_enabled",), "Add GROQ_API_KEY to backend/.env and restart the backend first"
            )
        row = await self._row()
        row.assistant_enabled = enabled
        await self.repo.commit()
        return enabled
