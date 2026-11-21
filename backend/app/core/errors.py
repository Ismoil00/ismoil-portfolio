"""Application errors and their JSON form.

Every error the API returns looks like one of:
  {"detail": "Human-readable message", "code": "not_found", ...extra}
  {"detail": [{"loc": ["body", "title", "en"], "msg": "...", "type": "..."}]}   (422, field errors)
The second shape is FastAPI's own validation format, so the admin panel maps both kinds of
field errors (schema checks and business rules) to form fields the same way.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, **extra: Any) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        self.extra = extra


class NotFound(AppError):
    status_code = 404
    code = "not_found"


class Conflict(AppError):
    status_code = 409
    code = "conflict"


class Unauthorized(AppError):
    status_code = 401
    code = "unauthorized"


class Forbidden(AppError):
    status_code = 403
    code = "forbidden"


class PayloadTooLarge(AppError):
    status_code = 413
    code = "payload_too_large"


class UnsupportedMediaType(AppError):
    status_code = 415
    code = "unsupported_media_type"


class TooManyRequests(AppError):
    status_code = 429
    code = "too_many_requests"

    def __init__(self, message: str, *, retry_after: int, code: str | None = None) -> None:
        super().__init__(message, code=code, retry_after=retry_after)
        self.retry_after = retry_after


class ServiceUnavailable(AppError):
    status_code = 503
    code = "service_unavailable"


class FieldErrors(AppError):
    """Business-rule failures tied to form fields (422, same shape as schema validation)."""

    status_code = 422
    code = "validation_error"

    def __init__(self, errors: list[tuple[tuple[str | int, ...], str]]) -> None:
        super().__init__("Validation failed")
        self.errors = [{"loc": ["body", *loc], "msg": msg, "type": "value_error"} for loc, msg in errors]

    @classmethod
    def single(cls, loc: tuple[str | int, ...], msg: str) -> "FieldErrors":
        return cls([(loc, msg)])


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(FieldErrors)
    async def _field_errors(_: Request, exc: FieldErrors) -> JSONResponse:
        return JSONResponse({"detail": exc.errors}, status_code=exc.status_code)

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = {"Retry-After": str(exc.retry_after)} if isinstance(exc, TooManyRequests) else None
        body = {"detail": exc.message, "code": exc.code, **exc.extra}
        return JSONResponse(body, status_code=exc.status_code, headers=headers)
