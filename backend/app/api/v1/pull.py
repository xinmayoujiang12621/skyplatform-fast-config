from fastapi import APIRouter, Depends, Header, Request, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from middleware.logging import get_logger
from models.v1.configs import Config
from models.v1.services import Service, ServiceIpAllow
from utils.jwt_utils import verify_bearer
from utils.ip_allow import extract_client_ip, is_ip_allowed
from fastapi.responses import Response, JSONResponse
from schemas.response import ok, unauthorized, not_found, internal_error, bad_request
import json
import ipaddress

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/pull", tags=["pull"])


@router.get("/{service_code}/{env}")
def pull_config(service_code: str, env: str, request: Request,
                authorization: str | None = Header(default=None, alias="Authorization"),
                if_none_match: str | None = Header(default=None, alias="If-None-Match"), db: Session = Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        return unauthorized("authorization header missing or not bearer")
    token = authorization.split(" ", 1)[1]
    verify_bearer(token, db, service_code, env)
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        return not_found(f"service '{service_code}' not found")
    client_ip = extract_client_ip(request)
    logger.info(client_ip)
    if not is_ip_allowed(db, s.id, env, client_ip):
        raise HTTPException(status_code=403, detail="ip not allowed")
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
        parsed = json.loads(c.content)
    except Exception:
        return internal_error("content parse failed")
    str_map = {}
    if isinstance(parsed, dict):
        for k, v in parsed.items():
            if isinstance(v, (dict, list)):
                str_map[k] = json.dumps(v, ensure_ascii=False)
            else:
                str_map[k] = str(v)
    else:
        return internal_error("content must be object")
    payload = {
        "service_code": service_code,
        "env": env,
        "format": c.format,
        "version": c.version,
        "media_type": ct,
        "etag": etag,
        "content": str_map,
    }
    return JSONResponse(content=ok(payload), headers={"ETag": etag})
