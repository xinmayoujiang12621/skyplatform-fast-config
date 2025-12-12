# 第一阶段：依赖构建阶段
FROM registry.cn-hangzhou.aliyuncs.com/dockerhub-mirror/python:3.12-slim AS dependencies

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 设置工作目录
WORKDIR /app

# 安装系统依赖（构建时需要）
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    default-libmysqlclient-dev \
    pkg-config \
    portaudio19-dev \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制requirements文件
COPY requirements.txt .

# 安装Python依赖到系统路径
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 第二阶段：应用运行阶段
FROM dependencies AS base

# 设置环境变量
ENV PYTHONPATH=/app \
    TZ=Asia/Shanghai \
    LOG_DIR=/tmp/logs \
    LOG_TO_FILE=0

# 创建非root用户
RUN groupadd -r appuser && useradd -r -g appuser -m appuser \
    && chown -R appuser:appuser /app \
    && chown -R appuser:appuser /home/appuser
USER appuser

# 复制应用代码（放在最后以充分利用缓存）
COPY --chown=appuser:appuser deploy .

# 暴露端口
EXPOSE 9530

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9530/api/health || exit 1

# 默认启动命令
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9530", "--workers", "1"]

# 生产环境镜像
FROM base AS production

# 生产环境使用gunicorn
CMD ["python", "-m", "gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:9530", "--access-logfile", "-", "--error-logfile", "-", "--log-level", "info"]

# 开发环境镜像
FROM base AS development

# 开发环境使用uvicorn的reload模式
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9530", "--reload"]
