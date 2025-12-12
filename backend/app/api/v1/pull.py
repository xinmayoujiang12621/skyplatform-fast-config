from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.v1.configs import Config
from app.models.v1.services import Service
from app.utils.jwt_verify import verify_bearer
from fastapi.responses import Response, JSONResponse
from app.schemas.response import ok, unauthorized, not_found, internal_error, bad_request
import json

router = APIRouter(prefix="/api/v1/pull", tags=["pull"])


@router.get("/{service_code}/{env}")
def pull_config(service_code: str, env: str, authorization: str | None = Header(default=None, alias="Authorization"),
                if_none_match: str | None = Header(default=None, alias="If-None-Match"), db: Session = Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        return unauthorized("authorization header missing or not bearer")
    token = authorization.split(" ", 1)[1]
    verify_bearer(token, db, service_code, env)
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        return not_found(f"service '{service_code}' not found")
    c = db.query(Config).filter(Config.service_id == s.id, Config.env == env).first()
    if not c:
        return not_found(f"config not found for service '{service_code}' env '{env}'")
    etag = str(c.version)
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})
    ct = "application/json"
    if c.format != "json":
        return bad_request("format must be json")
    try:
        parsed_content = json.loads(c.content)
    except Exception:
        return internal_error("content parse failed")
    payload = {
        "service_code": service_code,
        "env": env,
        "format": c.format,
        "version": c.version,
        "media_type": ct,
        "etag": etag,
        "content": parsed_content,
    }
    return JSONResponse(content=ok(payload), headers={"ETag": etag})
