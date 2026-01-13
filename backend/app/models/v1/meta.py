from sqlalchemy import Column, BigInteger, String, TIMESTAMP
from sqlalchemy.sql import func
from database import Base


class AppBackendBase(Base):
    __tablename__ = "app_backend_bases"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    appid = Column(String(64), unique=True, nullable=False)
    base_url = Column(String(256), nullable=False)
    note = Column(String(256))
    updated_by = Column(String(128))
    updated_at = Column(TIMESTAMP, nullable=False, default=func.now(), onupdate=func.now())

