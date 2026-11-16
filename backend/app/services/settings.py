"""Settings page rules: which translator the admin panel offers (Claude only once its API key is set)."""

from app.core.errors import FieldErrors
from app.models import AdminSettings
from app.models.enums import Translator
from app.repositories.settings import SettingsRepository

DEFAULT_TRANSLATOR = Translator.MANUAL


class PanelSettingsService:
    def __init__(self, repo: SettingsRepository, *, claude_ready: bool) -> None:
        self.repo = repo
        # True when the backend started with ANTHROPIC_API_KEY (app.state.translator exists).
        self.claude_ready = claude_ready

    async def translator(self) -> Translator:
        row = await self.repo.get()
        return Translator(row.translator) if row else DEFAULT_TRANSLATOR

    async def set_translator(self, translator: Translator) -> Translator:
        if translator == Translator.CLAUDE and not self.claude_ready:
            raise FieldErrors.single(
                ("translator",), "Add ANTHROPIC_API_KEY to backend/.env and restart the backend first"
            )
        row = await self.repo.get()
        if row is None:
            await self.repo.add(AdminSettings(id=1, translator=translator.value))
        else:
            row.translator = translator.value
        await self.repo.commit()
        return translator
