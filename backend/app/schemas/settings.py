"""Settings page: the translator choice and the username and password changes."""

from pydantic import Field

from app.models.enums import Translator
from app.schemas.common import InputModel, OutputModel


class PanelSettingsIn(InputModel):
    translator: Translator


class PanelSettingsOut(OutputModel):
    translator: Translator
    claude_ready: bool  # ANTHROPIC_API_KEY is set, so Claude can be chosen


class PasswordChangeIn(InputModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(max_length=1024)  # length rules are checked by the service, per field


class UsernameChangeIn(InputModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_username: str = Field(max_length=254)  # the rules are checked by the service, per field
