"""Request/response bodies of the auth endpoints."""

from pydantic import Field

from app.schemas.common import InputModel, OutputModel


class LoginIn(InputModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=1024)


class MeOut(OutputModel):
    username: str


class LoginOut(MeOut):
    csrf_token: str
