from datetime import datetime
from pydantic import BaseModel
from typing import Optional, Literal


class ConfigCreate(BaseModel):
    service_code: str
    env: str
    format: Literal["json"]
    content: str
    schema_def: Optional[str] = None


class ConfigUpdate(BaseModel):
    content: str
    schema_def: Optional[str] = None
    version: int
    updated_by: Optional[str] = None


class ConfigOut(BaseModel):
    id: int
    service_id: int
    env: str
    format: Literal["json"]
    content: str
    schema_def: Optional[str]
    version: int
    updated_by: Optional[str]
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class ConfigVersionOut(BaseModel):
    version: int
    summary: Optional[str]
    created_by: Optional[str]
    created_at: datetime


class RollbackReq(BaseModel):
    version: int
    summary: Optional[str] = None
