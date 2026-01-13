# FastAPI应用入口
from datetime import datetime

import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from settings import settings
from schemas.response import fail
from middleware.cors import register_cors
from middleware.admin_auth import register_admin_auth
from api.v1.services import router as services_router
from api.v1.configs import router as configs_router
from api.v1.pull import router as pull_router
from api.v1.auth import router as auth_router
from api.v1.meta import router as meta_router

app = FastAPI()

register_cors(app)
register_admin_auth(app)

app.include_router(services_router)
app.include_router(configs_router)
app.include_router(pull_router)
app.include_router(auth_router)
app.include_router(meta_router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    headers = getattr(exc, "headers", None)
    message = str(exc.detail) if exc.detail is not None else ""
    return JSONResponse(status_code=exc.status_code, content=fail(message=message, code=exc.status_code),
                        headers=headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content=fail(message="validation error", code=422, data=exc.errors()))


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content=fail(message="internal server error", code=500))


@app.get("/api/health")
async def health_check():
    """健康检查接口"""

    return JSONResponse(
        content={
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "agenterra-local-app-backend-v1",
            "version": settings.SERVICE_VERSION
        },
        status_code=200
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=9530, reload=True)
