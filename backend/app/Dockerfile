# 第一阶段：依赖构建阶段
FROM crpi-pe3cq1cvarbuqi25.cn-beijing.personal.cr.aliyuncs.com/skyplatform/base_python_313:1.0.0 AS dependencies

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

# 设置工作目录并复制应用代码
WORKDIR /app
COPY . /app

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
