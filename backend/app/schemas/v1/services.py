from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from typing import Literal


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

class TokenMonitorItemOut(BaseModel):
    id: int
    service_code: str
    env: str
    created_at: datetime
    expires_at: datetime

class TokenMonitorOut(BaseModel):
    total: int
    soon: int
    items: list[TokenMonitorItemOut]


class CredentialOut(BaseModel):
    ak: str
    status: str
    created_at: datetime
    last_rotated_at: Optional[datetime] = None


class CredentialRotateOut(BaseModel):
    ak: str
    sk: str


class AllowIPCreate(BaseModel):
    cidr: str
    env: Optional[str] = None
    note: Optional[str] = None


class AllowIPOut(BaseModel):
    id: int
    cidr: str
    env: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
