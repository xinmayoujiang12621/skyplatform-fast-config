from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import FastAPI, Request
import jwt
from config import ADMIN_JWT_SECRET, JWT_CLOCK_SKEW
from schemas.response import unauthorized

EXEMPT_PATHS_PREFIX = [
    "/api/health",
    "/api/v1/auth/login",
    "/api/v1/pull",
    "/docs",
    "/openapi.json",
]

class AdminAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method.upper() == "OPTIONS":
            return await call_next(request)
        path = request.url.path
        for p in EXEMPT_PATHS_PREFIX:
            if path.startswith(p):
                return await call_next(request)
        auth = request.headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return unauthorized("authorization header missing or not bearer")
        token = auth.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token,
                ADMIN_JWT_SECRET,
                algorithms=["HS256"],
                options={"require": ["exp", "iat", "aud", "sub"]},
                audience="fast_config_admin",
                leeway=JWT_CLOCK_SKEW,
            )
        except Exception as e:
            return unauthorized(f"invalid admin token: {str(e)}")
        request.state.admin = payload
        return await call_next(request)

def register_admin_auth(app: FastAPI):
    app.add_middleware(AdminAuthMiddleware)
