from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import FastAPI, Request
import jwt
import re

from schemas.response import unauthorized
from settings import settings
from utils.logging import get_logger

logger = get_logger(__name__)

EXEMPT_EXACT_PATHS = {
    "/api/health",
    "/api/v1/auth/login",
    "/docs",
    "/openapi.json",
}
PULL_PATH_RE = re.compile(r"^/api/v1/pull/[^/]+/[^/]+$")
META_BASE_PATH = "/api/v1/meta/backend-base"

class AdminAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method.upper() == "OPTIONS":
            return await call_next(request)
        path = request.url.path
        if (path in EXEMPT_EXACT_PATHS) or \
           (request.method.upper() == "GET" and PULL_PATH_RE.match(path)) or \
           (request.method.upper() == "GET" and path == META_BASE_PATH):
            return await call_next(request)
        auth = request.headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return unauthorized("authorization header missing or not bearer")
        token = auth.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token,
                settings.ADMIN_JWT_SECRET,
                algorithms=["HS256"],
                options={"require": ["exp", "iat", "aud", "sub"]},
                audience="fast_config_admin",
                leeway=int(settings.JWT_CLOCK_SKEW),
            )
        except Exception as e:
            logger.error(e)
            return unauthorized(f"invalid admin token: {str(e)}")
        request.state.admin = payload
        return await call_next(request)

def register_admin_auth(app: FastAPI):
    app.add_middleware(AdminAuthMiddleware)
