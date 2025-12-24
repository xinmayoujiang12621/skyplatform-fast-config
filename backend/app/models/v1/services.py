from sqlalchemy import Column, BigInteger, String, Text, Enum, TIMESTAMP, ForeignKey, Boolean
from sqlalchemy.dialects.mysql import VARBINARY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from typing import Optional


class Service(Base):
    __tablename__ = "services"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    owner = Column(String(128))
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, nullable=False, default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, default=func.now(), onupdate=func.now())
    credentials = relationship("ServiceCredential", back_populates="service", cascade="all, delete-orphan")
    tokens = relationship("ServiceToken", back_populates="service", cascade="all, delete-orphan")
    configs = relationship("Config", back_populates="service", cascade="all, delete-orphan")
    allow_ips = relationship("ServiceIpAllow", back_populates="service", cascade="all, delete-orphan")


class ServiceCredential(Base):
    __tablename__ = "service_credentials"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    service_id = Column(BigInteger, ForeignKey("services.id"), nullable=False)
    ak = Column(String(64), unique=True, nullable=False)
    sk_ciphertext = Column(VARBINARY(512), nullable=False)
    status = Column(Enum("active", "disabled"), nullable=False, default="active")
    created_at = Column(TIMESTAMP, nullable=False, default=func.now())
    last_rotated_at = Column(TIMESTAMP)
    service = relationship("Service", back_populates="credentials")


class ServiceToken(Base):
    __tablename__ = "service_tokens"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    service_id = Column(BigInteger, ForeignKey("services.id"), nullable=False)
    token = Column(Text, nullable=False)
    env = Column(String(32), nullable=False)
    expires_at = Column(TIMESTAMP, nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, default=func.now())
    service = relationship("Service", back_populates="tokens")


class ServiceIpAllow(Base):
    __tablename__ = "service_ip_allow"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    service_id = Column(BigInteger, ForeignKey("services.id"), nullable=False)
    env = Column(String(32))
    cidr = Column(String(64), nullable=False)
    note = Column(String(256))
    created_at = Column(TIMESTAMP, nullable=False, default=func.now())
    service = relationship("Service", back_populates="allow_ips")
