import jwt
from fastapi import HTTPException, status
from models.v1.services import Service, ServiceCredential, ServiceToken
from sqlalchemy.orm import Session
from utils.crypto import decrypt_sk
from config import JWT_CLOCK_SKEW


def verify_bearer(token: str, db: Session, service_code: str, env: str):
    try:
        header = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="malformed token header")
    kid = header.get("kid")
    if not kid:
        try:
            # 兼容早期将 kid 放在 payload 的情况
            payload_unverified = jwt.decode(token, options={"verify_signature": False})
            kid = payload_unverified.get("kid")
        except Exception:
            pass
    if not kid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="kid missing")
    cred = db.query(ServiceCredential).join(Service).filter(Service.code == service_code, ServiceCredential.ak == kid,
                                                            ServiceCredential.status == "active").first()
    if not cred:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="credential not found or inactive for service")
    sk = decrypt_sk(bytes(cred.sk_ciphertext))
    try:
        payload = jwt.decode(token, sk, algorithms=["HS256"], options={"require": ["exp", "iat", "aud", "sub"]},
                             leeway=JWT_CLOCK_SKEW, audience="fast_config_pull")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"invalid token: {str(e)}")
    if payload.get("sub") != service_code:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="sub mismatch")
    if payload.get("env") != env:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="env mismatch")
    exists = db.query(ServiceToken).join(Service).filter(Service.code == service_code,
                                                         ServiceToken.token == token).first()
    if not exists:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token revoked or not found")
    return payload
