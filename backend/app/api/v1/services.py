from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models.v1.services import Service, ServiceCredential, ServiceToken, ServiceIpAllow
from schemas.v1.services import ServiceCreate, ServiceOut, CredentialOut, CredentialRotateOut, TokenResponse, \
    ServiceTokenOut, AllowIPCreate, AllowIPOut, TokenMonitorOut, TokenMonitorItemOut
from settings import settings
from utils.crypto import gen_ak_sk, encrypt_sk, decrypt_sk

import jwt
from datetime import datetime, timedelta, timezone
import ipaddress

router = APIRouter(prefix="/api/v1/services", tags=["services"])


@router.get("", response_model=list[ServiceOut])
def list_services(db: Session = Depends(get_db)):
    services = db.query(Service).all()
    return services


@router.post("", response_model=CredentialRotateOut)
def create_service(payload: ServiceCreate, db: Session = Depends(get_db)):
    exists = db.query(Service).filter(Service.code == payload.code).first()
    if exists:
        raise HTTPException(status_code=409)
    if not settings.CRED_MASTER_KEY:
        raise HTTPException(status_code=500, detail="CRED_MASTER_KEY not configured")
    s = Service(code=payload.code, name=payload.name, owner=payload.owner, active=True)
    db.add(s)
    db.flush()
    ak, sk = gen_ak_sk()
    cred = ServiceCredential(service_id=s.id, ak=ak, sk_ciphertext=encrypt_sk(sk), status="active")
    db.add(cred)
    db.commit()
    return {"ak": ak, "sk": sk}


@router.delete("/{service_code}")
def delete_service(service_code: str, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        raise HTTPException(status_code=404)
    db.delete(s)
    db.commit()
    return {"ok": True}

@router.get("/tokens/monitor", response_model=TokenMonitorOut)
def tokens_monitor(days: int = 7, env: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ServiceToken, Service.code).join(Service, ServiceToken.service_id == Service.id)
    if env:
        q = q.filter(ServiceToken.env == env)
    rows = q.order_by(ServiceToken.expires_at.asc()).all()
    items: list[TokenMonitorItemOut] = []
    now = datetime.now(timezone.utc)
    soon = 0
    for t, code in rows:
        exp = t.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        left_days = (exp - now).days
        if left_days <= days:
            soon += 1
        items.append(TokenMonitorItemOut(id=t.id, service_code=code, env=t.env, created_at=t.created_at, expires_at=t.expires_at))
    return TokenMonitorOut(total=len(items), soon=soon, items=items)


@router.get("/{service_code}/credentials", response_model=list[CredentialOut])
def list_credentials(service_code: str, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        raise HTTPException(status_code=404)
    creds = db.query(ServiceCredential).filter(ServiceCredential.service_id == s.id).all()
    return creds


@router.post("/{service_code}/credentials/{ak}/disable")
def disable_credential(service_code: str, ak: str, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        raise HTTPException(status_code=404)
    cred = db.query(ServiceCredential).filter(ServiceCredential.service_id == s.id, ServiceCredential.ak == ak).first()
    if not cred:
        raise HTTPException(status_code=404)
    cred.status = "disabled"
    db.add(cred)
    db.commit()
    return {"ok": True}


@router.post("/{service_code}/envs/{env}/token", response_model=TokenResponse)
def generate_token(service_code: str, env: str, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        raise HTTPException(status_code=404, detail="Service not found")

    cred = db.query(ServiceCredential).filter(
        ServiceCredential.service_id == s.id,
        ServiceCredential.status == "active"
    ).order_by(ServiceCredential.created_at.desc()).first()

    if not cred:
        raise HTTPException(status_code=400, detail="No active credential found")

    sk = decrypt_sk(cred.sk_ciphertext)

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)
    token_payload = {
        "sub": service_code,
        "env": env,
        "aud": "fast_config_pull",
        "iat": now,
        "exp": expires_at,
    }

    token = jwt.encode(token_payload, sk, algorithm="HS256", headers={"kid": cred.ak})

    # Save token to DB
    st = ServiceToken(
        service_id=s.id,
        token=token,
        env=env,
        expires_at=expires_at
    )
    db.add(st)
    db.commit()

    return {"token": token}


@router.get("/{service_code}/tokens", response_model=list[ServiceTokenOut])
def list_tokens(service_code: str, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        raise HTTPException(status_code=404)
    tokens = db.query(ServiceToken).filter(ServiceToken.service_id == s.id).order_by(
        ServiceToken.created_at.desc()).all()
    return tokens


@router.delete("/{service_code}/tokens/{token_id}")
def delete_token(service_code: str, token_id: int, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        raise HTTPException(status_code=404)
    t = db.query(ServiceToken).filter(ServiceToken.id == token_id, ServiceToken.service_id == s.id).first()
    if not t:
        raise HTTPException(status_code=404)
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.get("/{service_code}/allow-ips", response_model=list[AllowIPOut])
def list_allow_ips(service_code: str, env: str | None = Query(default=None), db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        raise HTTPException(status_code=404)
    q = db.query(ServiceIpAllow).filter(ServiceIpAllow.service_id == s.id)
    if env:
        q = q.filter(ServiceIpAllow.env == env)
    rules = q.order_by(ServiceIpAllow.created_at.desc()).all()
    return rules


@router.post("/{service_code}/allow-ips", response_model=AllowIPOut, status_code=201)
def add_allow_ip(service_code: str, payload: AllowIPCreate, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        raise HTTPException(status_code=404)
    try:
        net = ipaddress.ip_network(payload.cidr, strict=False)
        cidr = str(net)
    except Exception:
        # 尝试按单个IP解析并转换为CIDR
        try:
            ip = ipaddress.ip_address(payload.cidr)
            cidr = f"{ip}/{32 if ip.version == 4 else 128}"
        except Exception:
            raise HTTPException(status_code=400, detail="invalid cidr or ip")
    exists = db.query(ServiceIpAllow).filter(
        ServiceIpAllow.service_id == s.id,
        ServiceIpAllow.env == payload.env,
        ServiceIpAllow.cidr == cidr
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="rule already exists")
    rule = ServiceIpAllow(service_id=s.id, env=payload.env, cidr=cidr, note=payload.note)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{service_code}/allow-ips/{rule_id}")
def delete_allow_ip(service_code: str, rule_id: int, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.code == service_code).first()
    if not s:
        raise HTTPException(status_code=404)
    r = db.query(ServiceIpAllow).filter(ServiceIpAllow.id == rule_id, ServiceIpAllow.service_id == s.id).first()
    if not r:
        raise HTTPException(status_code=404)
    db.delete(r)
    db.commit()
    return {"ok": True}
