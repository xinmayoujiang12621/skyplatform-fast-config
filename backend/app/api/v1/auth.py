from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
import jwt
from config import ADMIN_JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

class LoginReq(BaseModel):
    username: str
    password: str

class TokenResp(BaseModel):
    token: str
    expires_at: datetime

@router.post("/login", response_model=TokenResp)
def login(payload: LoginReq):
    if payload.username != ADMIN_USERNAME or payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="invalid credentials")
    if not ADMIN_JWT_SECRET:
        raise HTTPException(status_code=500, detail="admin jwt secret not configured")
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=7)
    token = jwt.encode(
        {"sub": payload.username, "role": "admin", "aud": "fast_config_admin", "iat": now, "exp": exp},
        ADMIN_JWT_SECRET,
        algorithm="HS256",
    )
    return {"token": token, "expires_at": exp}
