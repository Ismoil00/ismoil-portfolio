"""Fixed value lists stored as text (checked by the database and by the schemas)."""

from enum import StrEnum


class Availability(StrEnum):
    """Job-search status shown in the hero badge."""

    SEEKING = "seeking"  # actively looking (green)
    OPEN = "open"  # open to good offers (yellow)
    UNAVAILABLE = "unavailable"  # not looking (red)


class ClientKind(StrEnum):
    """Who a project was built for."""

    SELF = "self"  # my own project
    PRIVATE = "private"  # a client who stays anonymous
    COMPANY = "company"  # a company from the Companies selector


class Traffic(StrEnum):
    """Monthly users of a project, smallest to largest."""

    UNDER_100 = "under100"
    FROM_100 = "from100"
    FROM_1K = "from1k"
    FROM_10K = "from10k"
    FROM_100K = "from100k"
    OVER_1M = "over1m"


class MediaPurpose(StrEnum):
    """Where an uploaded file may be used; decides the allowed types and size."""

    RESUME = "resume"
    PROJECT_IMAGE = "project_image"
    PROJECT_VIDEO = "project_video"
    TESTIMONIAL_IMAGE = "testimonial_image"
    TESTIMONIAL_VIDEO = "testimonial_video"
    CERTIFICATE_IMAGE = "certificate_image"
    LOGO = "logo"
    POSTER = "poster"


def sql_in(enum: type[StrEnum], column: str) -> str:
    """CHECK constraint text: `column IN ('a', 'b', …)`."""
    values = ", ".join(f"'{member.value}'" for member in enum)
    return f"{column} IN ({values})"
