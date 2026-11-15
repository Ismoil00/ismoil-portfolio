"""Sliding-window limits ("at most N events in the last T")."""

import math
from datetime import datetime, timedelta


def retry_after(times: list[datetime], limit: int, window: timedelta, now: datetime) -> int | None:
    """Seconds until another event is allowed, or None when the limit isn't reached.
    `times` = the events inside the window, oldest first."""
    if len(times) < limit:
        return None
    # Allowed again once enough events fall out of the window.
    return max(1, math.ceil((times[-limit] + window - now).total_seconds()))
