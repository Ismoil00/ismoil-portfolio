"""Settings page: the translator choice, the AI assistant switch, and the username and password changes."""

from pydantic import Field, model_validator

from app.models.enums import Translator
from app.schemas.common import InputModel, OutputModel


class PanelSettingsIn(InputModel):
    """Only the settings sent are changed."""

    translator: Translator | None = None
    assistant_enabled: bool | None = None

    @model_validator(mode="after")
    def _something(self) -> "PanelSettingsIn":
        if self.translator is None and self.assistant_enabled is None:
            raise ValueError("Send at least one setting")
        return self


class PanelSettingsOut(OutputModel):
    translator: Translator
    claude_ready: bool  # ANTHROPIC_API_KEY is set, so Claude can be chosen
    assistant_enabled: bool  # the public site shows the AI assistant (when it's also ready)
    assistant_ready: bool  # GROQ_API_KEY is set, so the assistant can be switched on


class PasswordChangeIn(InputModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(max_length=1024)  # length rules are checked by the service, per field


class UsernameChangeIn(InputModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_username: str = Field(max_length=254)  # the rules are checked by the service, per field
