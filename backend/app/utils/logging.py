# 日志中间件
import logging
import os
import sys
import threading
from pathlib import Path
from logging.handlers import TimedRotatingFileHandler, RotatingFileHandler
import json
from datetime import datetime, timezone
import contextvars

_request_id_var = contextvars.ContextVar("request_id", default=None)
_user_id_var = contextvars.ContextVar("user_id", default=None)

_initialized = False
_lock = threading.Lock()

_servername = "s-fast-config"

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "time": datetime.now(timezone.utc).astimezone().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "func": record.funcName,
            "file": record.filename,
            "line": record.lineno,
            "process": record.process,
            "thread": record.thread,
            "request_id": getattr(record, "request_id", None),
            "user_id": getattr(record, "user_id", None),
        }
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False)


class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id_var.get() or "-"
        record.user_id = _user_id_var.get() or "-"
        return True


def _str2bool(v: str) -> bool:
    return str(v).strip().lower() in {"1", "true", "yes", "y", "on"}


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def add_trace_level() -> None:
    name = "TRACE"
    level = 5
    if not hasattr(logging, name):
        logging.addLevelName(level, name)

        def trace(self, msg, *args, **kwargs):
            if self.isEnabledFor(level):
                self._log(level, msg, args, **kwargs)

        logging.Logger.trace = trace


def init_logger() -> None:
    global _initialized
    if _initialized:
        return
    with _lock:
        if _initialized:
            return
        add_trace_level()
        base_logger = logging.getLogger(_servername)
        base_logger.setLevel(getattr(logging, "INFO", logging.INFO))
        base_logger.propagate = False
        if not base_logger.handlers:
            log_dir = Path("logs")
            log_file = log_dir / "app.log"
            use_json = _str2bool("0")
            to_console = _str2bool("1")
            to_file = _str2bool("1")
            rotation = "time"
            backup_count = 7
            fmt = JSONFormatter() if use_json else logging.Formatter(
                fmt="%(asctime)s %(levelname)s %(name)s %(filename)s:%(lineno)d %(funcName)s - %(message)s [request_id=%(request_id)s user_id=%(user_id)s]",
                datefmt="%Y-%m-%d %H:%M:%S%z",
            )
            context_filter = ContextFilter()
            if to_console:
                ch = logging.StreamHandler(stream=sys.stdout)
                ch.setLevel(base_logger.level)
                ch.setFormatter(fmt)
                ch.addFilter(context_filter)
                base_logger.addHandler(ch)
            if to_file:
                try:
                    _ensure_dir(log_dir)
                    if rotation == "size":
                        max_bytes = 10 * 1024 * 1024
                        fh = RotatingFileHandler(log_file, maxBytes=max_bytes, backupCount=backup_count,
                                                 encoding="utf-8")
                    else:
                        when = "midnight"
                        interval = 1
                        fh = TimedRotatingFileHandler(log_file, when=when, interval=interval, backupCount=backup_count,
                                                      encoding="utf-8", utc=False)
                    fh.setLevel(base_logger.level)
                    fh.setFormatter(fmt)
                    fh.addFilter(context_filter)
                    base_logger.addHandler(fh)
                except Exception as e:
                    try:
                        base_logger.warning(f"文件日志初始化失败: {e}. 已退回到控制台日志。")
                    except Exception:
                        pass
        _initialized = True


def get_logger(name: str | None = None) -> logging.Logger:
    init_logger()
    if name:
        return logging.getLogger(f"{_servername}.{name}")
    return logging.getLogger(_servername)


def set_request_context(request_id: str | None = None, user_id: str | None = None) -> None:
    if request_id is not None:
        _request_id_var.set(request_id)
    if user_id is not None:
        _user_id_var.set(user_id)


def clear_request_context() -> None:
    _request_id_var.set(None)
    _user_id_var.set(None)


def set_level(level: str | int) -> None:
    init_logger()
    logger = logging.getLogger(_servername)
    lvl = level if isinstance(level, int) else getattr(logging, str(level).upper(), logging.INFO)
    logger.setLevel(lvl)
    for h in logger.handlers:
        h.setLevel(lvl)
