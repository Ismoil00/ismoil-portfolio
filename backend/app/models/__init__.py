"""Every table, imported in one place so Base.metadata knows them all (Alembic, tests)."""

from app.models import links
from app.models.auth import AdminSession, AdminUser, LoginAttempt
from app.models.content import Certificate, ContactMessage, Experience, Project, Testimonial
from app.models.media import Media
from app.models.sections import About, Contacts, Hero, OtherLink
from app.models.selectors import (
    Company,
    DevelopmentField,
    Institute,
    Instrument,
    LinkPlatform,
    Position,
    ProductType,
    TechStack,
)

__all__ = [
    "About",
    "AdminSession",
    "AdminUser",
    "Certificate",
    "Company",
    "ContactMessage",
    "Contacts",
    "DevelopmentField",
    "Experience",
    "Hero",
    "Institute",
    "Instrument",
    "LinkPlatform",
    "LoginAttempt",
    "Media",
    "OtherLink",
    "Position",
    "ProductType",
    "Project",
    "TechStack",
    "Testimonial",
    "links",
]
