from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models.v1.configs import Config, ConfigVersion
from models.v1.services import Service
from schemas.v1.configs import ConfigCreate, ConfigUpdate, ConfigOut, ConfigVersionOut, RollbackReq, ImportTextReq
import difflib
import json
import re

router = APIRouter(prefix="/api/v1/configs", tags=["configs"])

def is_valid_version(v: str) -> bool:
    return bool(re.fullmatch(r"\d+\.\d+\.\d+", v))

@router.get("")
def list_configs(service: str = Query(None), env: str = Query(None), db: Session = Depends(get_db)):
    q = db.query(Config).join(Service)
    if service:
        q = q.filter(Service.code == service)
    if env:
        q = q.filter(Config.env == env)
    rows = q.all()
    return [{"id": r.id, "service_id": r.service_id, "env": r.env, "format": r.format, "content": r.content,
             "schema_def": r.schema_def, "version": r.version, "updated_by": r.updated_by,
             "updated_at": str(r.updated_at)} for r in rows]


@router.post("", response_model=ConfigOut)
def create_config(payload: ConfigCreate, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == payload.service_code).first()
    if not s:
        raise HTTPException(status_code=404)
    if payload.format != "json":
        raise HTTPException(status_code=400, detail="format must be json")
    try:
        obj = json.loads(payload.content)
    except Exception:
        raise HTTPException(status_code=400, detail="content must be valid json")
    if not is_valid_version(payload.version):
        raise HTTPException(status_code=400, detail="version must be x.y.z")
    exists = db.query(Config).filter(Config.service_id == s.id, Config.env == payload.env).first()
    if exists:
        raise HTTPException(status_code=409,
                            detail=f"Config for service '{payload.service_code}' and env '{payload.env}' already exists")
    str_map = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                str_map[k] = json.dumps(v, ensure_ascii=False)
            else:
                str_map[k] = str(v)
    else:
        raise HTTPException(status_code=400, detail="content must be object")
    content_str = json.dumps(str_map, ensure_ascii=False, indent=2)
    c = Config(service_id=s.id, env=payload.env, format=payload.format, content=content_str,
               schema_def=payload.schema_def, version=payload.version)
    db.add(c)
    db.commit()
    db.refresh(c)
    snap = ConfigVersion(config_id=c.id, version=payload.version, content=c.content)
    db.add(snap)
    db.commit()
    db.refresh(c)
    return c


@router.put("/{config_id}", response_model=ConfigOut)
def update_config(config_id: int, payload: ConfigUpdate, db: Session = Depends(get_db)):
    c = db.query(Config).filter(Config.id == config_id).first()
    if not c:
        raise HTTPException(status_code=404)
    if c.format != "json":
        raise HTTPException(status_code=400, detail="format must be json")
    try:
        obj = json.loads(payload.content)
    except Exception:
        raise HTTPException(status_code=400, detail="content must be valid json")
    if not is_valid_version(payload.version) or not is_valid_version(payload.base_version):
        raise HTTPException(status_code=400, detail="version must be x.y.z")
    if c.version != payload.base_version:
        raise HTTPException(status_code=409)
    dup = db.query(ConfigVersion).filter(ConfigVersion.config_id == c.id,
                                         ConfigVersion.version == payload.version).first()
    if dup:
        raise HTTPException(status_code=409, detail="version already exists")
    str_map = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                str_map[k] = json.dumps(v, ensure_ascii=False)
            else:
                str_map[k] = str(v)
    else:
        raise HTTPException(status_code=400, detail="content must be object")
    c.content = json.dumps(str_map, ensure_ascii=False, indent=2)
    c.schema_def = payload.schema_def
    c.updated_by = payload.updated_by
    snap = ConfigVersion(config_id=c.id, version=payload.version, content=c.content)
    c.version = payload.version
    db.add(snap)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


# 发布概念已移除

@router.get("/{config_id}/versions", response_model=list[ConfigVersionOut])
def list_versions(config_id: int, db: Session = Depends(get_db)):
    rows = db.query(ConfigVersion).filter(ConfigVersion.config_id == config_id).order_by(
        ConfigVersion.created_at.asc()).all()
    return [{"version": r.version, "summary": r.summary, "created_by": r.created_by, "created_at": str(r.created_at)}
            for r in rows]


@router.post("/{config_id}/rollback")
def rollback(config_id: int, payload: RollbackReq, db: Session = Depends(get_db)):
    c = db.query(Config).filter(Config.id == config_id).first()
    if not c:
        raise HTTPException(status_code=404)
    if not is_valid_version(payload.version) or not is_valid_version(payload.new_version):
        raise HTTPException(status_code=400, detail="version must be x.y.z")
    v = db.query(ConfigVersion).filter(ConfigVersion.config_id == config_id,
                                       ConfigVersion.version == payload.version).first()
    if not v:
        raise HTTPException(status_code=404)
    dup = db.query(ConfigVersion).filter(ConfigVersion.config_id == c.id,
                                         ConfigVersion.version == payload.new_version).first()
    if dup:
        raise HTTPException(status_code=409, detail="version already exists")
    c.content = v.content
    snap = ConfigVersion(config_id=c.id, version=payload.new_version, content=c.content, summary=payload.summary)
    c.version = payload.new_version
    db.add(snap)
    db.add(c)
    db.commit()
    return {"version": c.version}


@router.get("/{config_id}/diff")
def diff_versions(config_id: int, from_version: str = Query(..., alias="from"),
                  to_version: str = Query(..., alias="to"), db: Session = Depends(get_db)):
    a = db.query(ConfigVersion).filter(ConfigVersion.config_id == config_id,
                                       ConfigVersion.version == from_version).first()
    b = db.query(ConfigVersion).filter(ConfigVersion.config_id == config_id,
                                       ConfigVersion.version == to_version).first()
    if not a or not b:
        raise HTTPException(status_code=404)
    diff = difflib.unified_diff(a.content.splitlines(), b.content.splitlines(), lineterm="")
    text = "\n".join(list(diff))
    return {"diff": text}


@router.post("/import")
def import_config(payload: ImportTextReq, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == payload.service_code).first()
    if not s:
        raise HTTPException(status_code=404, detail="service not found")
    # parse .env-like content
    kv = {}
    for raw_line in payload.text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        key = k.strip()
        val = v.strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        kv[key] = val
    content = json.dumps(kv, ensure_ascii=False, indent=2)
    c = db.query(Config).filter(Config.service_id == s.id, Config.env == payload.env).first()
    if not c:
        if not is_valid_version(payload.new_version):
            raise HTTPException(status_code=400, detail="version must be x.y.z")
        c = Config(service_id=s.id, env=payload.env, format="json", content=content, version=payload.new_version,
                   updated_by=payload.updated_by)
        db.add(c)
        db.commit()
        db.refresh(c)
        snap = ConfigVersion(config_id=c.id, version=payload.new_version, content=c.content, summary="import create")
        db.add(snap)
        db.commit()
        return {"id": c.id, "version": c.version}
    # overwrite existing
    if c.format != "json":
        raise HTTPException(status_code=400, detail="format must be json")
    if not is_valid_version(payload.new_version) or (payload.base_version and not is_valid_version(payload.base_version)):
        raise HTTPException(status_code=400, detail="version must be x.y.z")
    if payload.base_version and c.version != payload.base_version:
        raise HTTPException(status_code=409)
    dup = db.query(ConfigVersion).filter(ConfigVersion.config_id == c.id,
                                         ConfigVersion.version == payload.new_version).first()
    if dup:
        raise HTTPException(status_code=409, detail="version already exists")
    c.content = content
    c.updated_by = payload.updated_by
    snap = ConfigVersion(config_id=c.id, version=payload.new_version, content=c.content, summary="import overwrite")
    c.version = payload.new_version
    db.add(snap)
    db.add(c)
    db.commit()
    return {"id": c.id, "version": c.version}
