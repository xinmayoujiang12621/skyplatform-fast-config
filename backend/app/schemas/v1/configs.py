from datetime import datetime
from pydantic import BaseModel
from typing import Optional, Literal


class ConfigCreate(BaseModel):
    service_code: str
    env: str
    format: Literal["json"]
    content: str
    schema_def: Optional[str] = None
    version: str


class ConfigUpdate(BaseModel):
    content: str
    schema_def: Optional[str] = None
    base_version: str
    version: str
    updated_by: Optional[str] = None


class ConfigOut(BaseModel):
    id: int
    service_id: int
    env: str
    format: Literal["json"]
    content: str
    schema_def: Optional[str]
    version: str
    updated_by: Optional[str]
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class ConfigVersionOut(BaseModel):
    version: str
    summary: Optional[str]
    created_by: Optional[str]
    created_at: datetime


class RollbackReq(BaseModel):
    version: str
    new_version: str
    summary: Optional[str] = None


class ImportTextReq(BaseModel):
    service_code: str
    env: str
    text: str
    overwrite: bool = True
    base_version: Optional[str] = None
    new_version: str
    updated_by: Optional[str] = None
