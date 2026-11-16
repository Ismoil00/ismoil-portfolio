"""Database access for the admin panel's settings (one row)."""

from app.models import AdminSettings
from app.repositories.base import Repository


class SettingsRepository(Repository):
    async def get(self) -> AdminSettings | None:
        return await self.session.get(AdminSettings, 1)

    async def add(self, row: AdminSettings) -> None:
        self.session.add(row)
        await self.session.flush()
