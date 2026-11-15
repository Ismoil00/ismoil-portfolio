"""Writing many-to-many links: the old set is replaced, and `position` keeps the given order."""

import uuid

from sqlalchemy import Table, delete, insert
from sqlalchemy.ext.asyncio import AsyncSession


async def replace_links(
    session: AsyncSession, table: Table, owner_col: str, owner_id: uuid.UUID, target_col: str, target_ids: list
) -> None:
    await session.execute(delete(table).where(table.c[owner_col] == owner_id))
    if target_ids:
        rows = [{owner_col: owner_id, target_col: target, "position": i} for i, target in enumerate(target_ids)]
        await session.execute(insert(table), rows)
