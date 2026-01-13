from fastapi import APIRouter, Request, Depends, HTTPException, Query, Header
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from schemas.response import ok

from models.v1.meta import AppBackendBase
from pydantic import BaseModel, AnyUrl
from typing import Optional

from settings import settings

router = APIRouter(prefix="/api/v1/meta", tags=["meta"])


class BackendBaseSetReq(BaseModel):
    appid: str
    base_url: AnyUrl
    note: Optional[str] = None
    updated_by: Optional[str] = None


class BackendBaseOut(BaseModel):
    appid: str
    base_url: str
    note: Optional[str] = None
    updated_by: Optional[str] = None
    updated_at: Optional[str] = None


@router.get("/backend-base")
def backend_base(request: Request, appid: Optional[str] = Query(default=None), x_app_id: Optional[str] = Header(default=None, alias="X-App-Id"), db: Session = Depends(get_db)):
    proto = request.headers.get("X-Forwarded-Proto")
    host = request.headers.get("X-Forwarded-Host")
    scheme = (proto or request.url.scheme).split(",")[0].strip()
    netloc = (host or request.headers.get("host") or request.url.netloc).split(",")[0].strip()
    default_base = f"{scheme}://{netloc}"
    app_id = (appid or x_app_id or "").strip()
    base = default_base
    if app_id:
        try:
            row = db.query(AppBackendBase).filter(AppBackendBase.appid == app_id).first()
            if row:
                base = row.base_url
        except Exception:
            base = default_base
    payload = {"base": base, "version": settings.SERVICE_VERSION, "appid": app_id or None}
    return JSONResponse(content=ok(payload))


@router.post("/backend-base", response_model=BackendBaseOut)
def set_backend_base(payload: BackendBaseSetReq, db: Session = Depends(get_db)):
    appid = payload.appid.strip()
    exists = db.query(AppBackendBase).filter(AppBackendBase.appid == appid).first()
    if exists:
        exists.base_url = str(payload.base_url)
        exists.note = payload.note
        exists.updated_by = payload.updated_by
        db.add(exists)
        db.commit()
        db.refresh(exists)
        return {"appid": exists.appid, "base_url": exists.base_url, "note": exists.note, "updated_by": exists.updated_by, "updated_at": str(exists.updated_at)}
    row = AppBackendBase(appid=appid, base_url=str(payload.base_url), note=payload.note, updated_by=payload.updated_by)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"appid": row.appid, "base_url": row.base_url, "note": row.note, "updated_by": row.updated_by, "updated_at": str(row.updated_at)}


@router.get("/backend-bases", response_model=list[BackendBaseOut])
def list_backend_bases(db: Session = Depends(get_db)):
    rows = db.query(AppBackendBase).order_by(AppBackendBase.updated_at.desc()).all()
    return [{"appid": r.appid, "base_url": r.base_url, "note": r.note, "updated_by": r.updated_by, "updated_at": str(r.updated_at)} for r in rows]


@router.delete("/backend-base")
def delete_backend_base(appid: str = Query(...), db: Session = Depends(get_db)):
    row = db.query(AppBackendBase).filter(AppBackendBase.appid == appid).first()
    if not row:
        raise HTTPException(status_code=404, detail="appid not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
