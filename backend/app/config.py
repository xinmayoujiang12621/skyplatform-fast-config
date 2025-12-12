# 配置管理
import os
from dotenv import load_dotenv, find_dotenv

# 兼容不同工作目录，优先查找项目根目录的 .env
load_dotenv()

APP_ENV = os.getenv("APP_ENV", "dev")
APP_PORT = int(os.getenv("APP_PORT", "8000"))
DATABASE_URL = os.getenv("DATABASE_URL")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
DB_CHARSET = os.getenv("DB_CHARSET", "utf8mb4")
CRED_MASTER_KEY = os.getenv("CRED_MASTER_KEY")
JWT_CLOCK_SKEW = int(os.getenv("JWT_CLOCK_SKEW", "60"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
ADMIN_JWT_SECRET = os.getenv("ADMIN_JWT_SECRET")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


def build_db_url():
    if DATABASE_URL:
        return DATABASE_URL
    if DB_HOST and DB_PORT and DB_USER and DB_PASSWORD and DB_NAME:
        return f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset={DB_CHARSET}"
    return None
