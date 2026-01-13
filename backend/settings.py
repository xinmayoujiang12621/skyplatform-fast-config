from typing import Any, Dict, Optional, List
from pathlib import Path

import requests
from pydantic import ConfigDict
from pydantic_settings import BaseSettings

from utils.logging import get_logger

logger = get_logger(__name__)


class Settings(BaseSettings):
    model_config = ConfigDict(validate_assignment=True, extra='allow')

    config_url: str = ""
    token: str = ""
    headers: Dict[str, str] = {}
    config: Dict[str, Any] = {}
    get_config_type: List[str] = ["local"]

    def model_post_init(self, __context: Any) -> None:
        self._load_yaml_config()
        if self.token:
            self.headers = {'Authorization': f'Bearer {self.token}'}
        self.config = self.init_fast_config()
        self.apply_config()

    def _load_yaml_config(self) -> None:
        p = Path(__file__).with_suffix('.yaml')
        if not p.exists():
            return
        try:
            import yaml
            with p.open('r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
            cfg = data.get('config', {}) if isinstance(data, dict) else {}
            if isinstance(cfg, dict):
                self.config_url = cfg.get('config_url', self.config_url or "")
                self.token = cfg.get('token', self.token)
        except Exception:
            try:
                cu = None
                tk = None
                with p.open('r', encoding='utf-8') as f:
                    for line in f:
                        s = line.strip()
                        if not s or s.startswith('#'):
                            continue
                        if s.startswith('config_url:'):
                            cu = s.split(':', 1)[1].strip()
                        elif s.startswith('token:'):
                            tk = s.split(':', 1)[1].strip()
                if cu is not None:
                    self.config_url = cu
                if tk is not None:
                    self.token = tk
            except Exception:
                pass

    def get_local_config(self) -> Dict[str, Any]:
        cfg: Dict[str, Any] = {}
        p = Path(__file__).parent / ".env"
        if not p.exists():
            return cfg
        try:
            import json
            with p.open('r', encoding='utf-8') as f:
                for line in f:
                    s = line.strip()
                    if not s or s.startswith('#'):
                        continue
                    if '=' not in s:
                        continue
                    k, v = s.split('=', 1)
                    k = k.strip()
                    v = v.strip()
                    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                        v = v[1:-1]
                    try:
                        if v.startswith('{') or v.startswith('['):
                            v = json.loads(v)
                    except Exception:
                        pass
                    if k.upper() == 'CORS_ORIGINS' and isinstance(v, str):
                        v = [i.strip() for i in v.split(',') if i.strip()]
                    cfg[k] = v
        except Exception as e:
            logger.error(f".env 本地配置读取失败: {e}")
        return cfg

    def get_online_config(self) -> Dict[str, Any]:
        # 获取线上配置
        try:
            response = requests.get(self.config_url, headers=self.headers, timeout=8)
            response.raise_for_status()
            data = response.json()['data']['content']
            logger.info("远程配置拉取成功")
            return data
        except Exception as e:
            logger.error(f"远程配置拉取失败: {e}")
            return {}

    def init_fast_config(self) -> Dict[str, Any]:
        cfg: Dict[str, Any] = {}
        for t in self.get_config_type:
            if t == "online":
                cfg.update(self.get_online_config())
            elif t == "local":
                cfg.update(self.get_local_config())
            else:
                logger.error(f"未知的配置获取类型: {t}")
                continue
        return cfg

    def apply_config(self) -> None:
        for k, v in (self.config or {}).items():
            setattr(self, k, v)

    def __getattr__(self, key: str) -> Any:
        if key.startswith("__"):
            raise AttributeError(key)
        if key in (self.config or {}):
            return self.config[key]
        return None

    def build_db_url(self):
        if self.DB_HOST and self.DB_PORT and self.DB_USER and self.DB_PASSWORD and self.DB_NAME:
            return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset={self.DB_CHARSET}"
        return None


settings = Settings()
