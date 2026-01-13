from sqlalchemy import Column, BigInteger, String, Enum, TIMESTAMP, ForeignKey, Boolean
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Config(Base):
    __tablename__ = "configs"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    service_id = Column(BigInteger, ForeignKey("services.id"), nullable=False)
    env = Column(String(32), nullable=False)
    format = Column(Enum("json", "yaml", "toml", "ini"), nullable=False)
    content = Column(LONGTEXT, nullable=False)
    schema_def = Column(LONGTEXT)
    version = Column(String(32), nullable=False, default="0.0.1")
    is_published = Column(Boolean, nullable=False, default=False)
    updated_by = Column(String(128))
    updated_at = Column(TIMESTAMP, nullable=False, default=func.now(), onupdate=func.now())
    service = relationship("Service", back_populates="configs")
    versions = relationship("ConfigVersion", back_populates="config", cascade="all, delete-orphan")


class ConfigVersion(Base):
    __tablename__ = "config_versions"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    config_id = Column(BigInteger, ForeignKey("configs.id"), nullable=False)
    version = Column(String(32), nullable=False)
    content = Column(LONGTEXT, nullable=False)
    summary = Column(String(256))
    created_by = Column(String(128))
    created_at = Column(TIMESTAMP, nullable=False, default=func.now())
    config = relationship("Config", back_populates="versions")
