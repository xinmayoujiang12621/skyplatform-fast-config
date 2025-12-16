import base64
import os
from cryptography.fernet import Fernet
from config import CRED_MASTER_KEY


def _get_fernet():
    key = CRED_MASTER_KEY
    if not key:
        raise RuntimeError("CRED_MASTER_KEY missing")
    return Fernet(key.encode())


def encrypt_sk(sk: str) -> bytes:
    f = _get_fernet()
    return f.encrypt(sk.encode())


def decrypt_sk(cipher: bytes) -> str:
    f = _get_fernet()
    return f.decrypt(cipher).decode()


def gen_ak_sk() -> tuple[str, str]:
    ak = base64.urlsafe_b64encode(os.urandom(18)).decode().rstrip("=")
    sk = base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip("=")
    return ak, sk
