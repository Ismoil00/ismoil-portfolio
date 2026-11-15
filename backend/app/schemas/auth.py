"""Request/response bodies of the auth endpoints."""

from pydantic import EmailStr, Field

from app.schemas.common import InputModel, OutputModel


class LoginIn(InputModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=1024)


class MeOut(OutputModel):
    email: str


class LoginOut(MeOut):
    csrf_token: str
