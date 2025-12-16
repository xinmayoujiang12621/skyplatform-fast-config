from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.v1.services import Service, ServiceCredential, ServiceToken
from schemas.v1.services import ServiceCreate, ServiceOut, CredentialOut, CredentialRotateOut, TokenResponse, \
    ServiceTokenOut
from utils.crypto import gen_ak_sk, encrypt_sk, decrypt_sk
from config import CRED_MASTER_KEY
import jwt
from datetime import datetime, timedelta, timezone

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
    if not CRED_MASTER_KEY:
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
