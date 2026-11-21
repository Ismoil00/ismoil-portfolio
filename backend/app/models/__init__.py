"""Every table, imported in one place so Base.metadata knows them all (Alembic, tests)."""

from app.models import links
from app.models.analytics import VisitEvent
from app.models.auth import AdminSession, AdminUser, LoginAttempt
from app.models.chat import ChatQuestion, ChatUsage
from app.models.content import Certificate, ContactMessage, Experience, Project, Testimonial
from app.models.media import Media
from app.models.sections import About, Contacts, Hero, OtherLink
from app.models.selectors import (
    Company,
    DevelopmentField,
    Institute,
    Instrument,
    LinkPlatform,
    ProductType,
    TechStack,
)
from app.models.settings import AdminSettings

__all__ = [
    "About",
    "AdminSession",
    "AdminSettings",
    "AdminUser",
    "Certificate",
    "ChatQuestion",
    "ChatUsage",
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
    "ProductType",
    "Project",
    "TechStack",
    "Testimonial",
    "VisitEvent",
    "links",
]
