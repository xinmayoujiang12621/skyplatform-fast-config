from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class ServiceCreate(BaseModel):
    code: str
    name: str
    owner: Optional[str] = None


class ServiceOut(BaseModel):
    id: int
    code: str
    name: str
    owner: Optional[str]
    active: bool

    class Config:
        from_attributes = True


class ServiceTokenOut(BaseModel):
    id: int
    token: str
    env: str
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    token: str


class CredentialOut(BaseModel):
    ak: str
    status: str
    created_at: datetime
    last_rotated_at: Optional[datetime] = None


class CredentialRotateOut(BaseModel):
    ak: str
    sk: str
