from fastapi import Request, HTTPException
from sqlalchemy.orm import Session
from models.v1.services import ServiceIpAllow
import ipaddress
from config import TRUSTED_PROXIES, REAL_IP_HEADER

def extract_client_ip(request: Request) -> str:
    if REAL_IP_HEADER:
        h = request.headers.get(REAL_IP_HEADER)
        if h:
            return h.split(",")[0].strip()
    client = request.client.host
    trusted = False
    try:
        ip_obj = ipaddress.ip_address(client)
        for cidr in TRUSTED_PROXIES:
            try:
                if ip_obj in ipaddress.ip_network(cidr, strict=False):
                    trusted = True
                    break
            except Exception:
                continue
    except Exception:
        trusted = False
    if trusted:
        xff = request.headers.get("X-Forwarded-For")
        if xff:
            return xff.split(",")[0].strip()
        fwd = request.headers.get("Forwarded")
        if fwd:
            parts = [p.strip() for p in fwd.split(";")]
            for p in parts:
                if p.lower().startswith("for="):
                    v = p.split("=", 1)[1].strip().strip("\"")
                    return v
    return client

def is_ip_allowed(db: Session, service_id: int, env: str, client_ip: str) -> bool:
    try:
        ip_obj = ipaddress.ip_address(client_ip)
    except Exception:
        raise HTTPException(status_code=403, detail="client ip invalid")
    rules = db.query(ServiceIpAllow).filter(
        ServiceIpAllow.service_id == service_id
    ).filter(
        (ServiceIpAllow.env == env) | (ServiceIpAllow.env.is_(None))
    ).all()
    if not rules:
        return False
    for r in rules:
        cidr = (r.cidr or "").strip()
        if cidr in ("0.0.0.0", "0.0.0.0/0", "*", "0.0.0.0/32"):
            return True
        try:
            net = ipaddress.ip_network(cidr, strict=False)
            if ip_obj in net:
                return True
        except Exception:
            continue
    return False
