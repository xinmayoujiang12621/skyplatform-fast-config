# FastAPI应用入口
import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.schemas.response import fail
from app.middleware.cors import register_cors
from app.api.v1.services import router as services_router
from app.api.v1.configs import router as configs_router
from app.api.v1.pull import router as pull_router

app = FastAPI()

register_cors(app)

app.include_router(services_router)
app.include_router(configs_router)
app.include_router(pull_router)


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


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=9530, reload=True)
