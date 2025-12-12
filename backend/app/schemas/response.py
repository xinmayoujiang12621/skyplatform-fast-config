from typing import Any, Optional
from time import time
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse


class Resp(BaseModel):
    code: int = 0
    message: str = "OK"
    data: Optional[Any] = None
    timestamp: int = Field(default_factory=lambda: int(time()))


def ok(data: Any = None, message: str = "OK", code: int = 0) -> dict:
    return Resp(code=code, message=message, data=data).model_dump()


def fail(message: str, code: int = 1, data: Any = None) -> dict:
    return Resp(code=code, message=message, data=data).model_dump()


class PageMeta(BaseModel):
    page: int
    size: int
    total: int
    pages: int


class PagePayload(BaseModel):
    items: list[Any]
    meta: PageMeta


class ListPayload(BaseModel):
    items: list[Any]
    count: Optional[int] = None


def page_ok(items: list[Any], total: int, page: int, size: int, message: str = "OK", code: int = 0) -> dict:
    pages = ((total + size - 1) // size) if size > 0 else 0
    payload = PagePayload(items=items, meta=PageMeta(page=page, size=size, total=total, pages=pages))
    return ok(payload.model_dump(), message=message, code=code)


def list_ok(items: list[Any], count: Optional[int] = None, message: str = "OK", code: int = 0) -> dict:
    payload = ListPayload(items=items, count=count)
    return ok(payload.model_dump(), message=message, code=code)


def error_json(status_code: int, message: str, data: Any = None, headers: Optional[dict] = None) -> JSONResponse:
    return JSONResponse(content=fail(message=message, code=status_code, data=data), status_code=status_code,
                        headers=headers)


def bad_request(message: str = "bad request", data: Any = None) -> JSONResponse:
    return error_json(400, message, data)


def unauthorized(message: str = "unauthorized", data: Any = None) -> JSONResponse:
    return error_json(401, message, data, headers={"WWW-Authenticate": "Bearer"})


def forbidden(message: str = "forbidden", data: Any = None) -> JSONResponse:
    return error_json(403, message, data)


def not_found(message: str = "not found", data: Any = None) -> JSONResponse:
    return error_json(404, message, data)


def internal_error(message: str = "internal server error", data: Any = None) -> JSONResponse:
    return error_json(500, message, data)
