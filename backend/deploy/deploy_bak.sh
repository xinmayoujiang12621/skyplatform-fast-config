#!/bin/bash

# Fastapi后端部署脚本 - 蓝绿部署版本
# 用法: 登录 docker login --username=tb63322527 crpi-pe3cq1cvarbuqi25.cn-beijing.personal.cr.aliyuncs.com
# ./deploy_agenterra_iam_backend.sh [镜像版本号]

# 检查参数
#if [ $# -eq 0 ]; then
#    echo "错误: 请提供版本号参数"
#    echo "用法: $0 <版本号>"
#    exit 1
#fi

# 获取版本号参数
VERSION=$SPUG_RELEASE

# ==============================================
# 0. 更新 .env 文件中的 SERVICE_VERSION
# ==============================================
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)  # 脚本绝对路径
ENV_FILE="/tmp/.env"

echo "使用环境配置文件: ${ENV_FILE}"

# 检查 .env 是否存在
if [ ! -f "${ENV_FILE}" ]; then
  echo "错误：环境配置文件 ${ENV_FILE} 不存在！" >&2
  exit 1
fi

echo "正在更新 SERVICE_VERSION 为: ${VERSION}"

# 移除Windows风格的回车符
sed -i 's/\r$//' "$ENV_FILE"
sed -i '1 s/^\xEF\xBB\xBF//' "$ENV_FILE"

# 检查是否存在 SERVICE_VERSION 行
if grep -q "^SERVICE_VERSION=" "$ENV_FILE"; then
    # 如果存在，则更新该行
    sed -i "s/^SERVICE_VERSION=.*/SERVICE_VERSION=${VERSION}/" "$ENV_FILE"
    echo "已更新 ${ENV_FILE} 中的 SERVICE_VERSION 为: ${VERSION}"
else
    # 如果不存在，则在文件末尾添加
    echo "" >> "$ENV_FILE"
    echo "SERVICE_VERSION=${VERSION}" >> "$ENV_FILE"
    echo "已在 ${ENV_FILE} 中添加 SERVICE_VERSION: ${VERSION}"
fi

# ==============================================
# 1. 定位并加载 .env 文件（纯 KEY=VALUE 格式，无 export）
# ==============================================
# 重新确认 .env 文件路径（已在上面设置过）
# SCRIPT_DIR 和 ENV_FILE 变量已在上面定义
# 加载 .env 文件到当前 Shell（无需 export，脚本内直接使用变量）
# 使用 grep -v '^#' 过滤注释行，sed 's/^[ \t]*//;s/[ \t]*$//' 移除行首尾空格
echo "加载环境配置：${ENV_FILE}"
# 移除Windows风格的回车符
sed -i 's/\r$//' "$ENV_FILE"
sed -i '1 s/^\xEF\xBB\xBF//' "$ENV_FILE"
while IFS= read -r line; do
  # 跳过注释行（以 # 开头）和空行
  case "$line" in
    ''|*[[:space:]]*) [ -z "$(echo "$line" | sed 's/[[:space:]]//g')" ] && continue ;;
    \#*) continue ;;
  esac
  # 执行行内容（核心：将 KEY=VALUE 赋值到当前 Shell）
  eval "$line"
done < "${ENV_FILE}"

# 检查必需的环境变量是否存在
required_vars="PRODUCTION_PORT TEMP_PORT CONTAINER_NAME TEMP_CONTAINER_NAME MAX_HEALTH_CHECK_ATTEMPTS HEALTH_CHECK_INTERVAL BASE_IMAGE_NAME"
for var in $required_vars; do
    eval "value=\$$var"
    if [ -z "$value" ]; then
        echo "错误: 环境变量 $var 未设置" >&2
        exit 1
    fi
done

# 配置变量（从环境变量读取）
PRODUCTION_PORT=$PRODUCTION_PORT
TEMP_PORT=$TEMP_PORT
CONTAINER_NAME=$CONTAINER_NAME
TEMP_CONTAINER_NAME=$TEMP_CONTAINER_NAME
MAX_HEALTH_CHECK_ATTEMPTS=$MAX_HEALTH_CHECK_ATTEMPTS
HEALTH_CHECK_INTERVAL=$HEALTH_CHECK_INTERVAL
HEALTH_CHECK_URL="http://localhost:${TEMP_PORT}/api/health"

# 容器环境变量配置：将 .env 作为 --env-file 传入容器
DOCKER_ENV_FILE_OPTION=""
if [ -f "${ENV_FILE}" ]; then
    DOCKER_ENV_FILE_OPTION="--env-file ${ENV_FILE}"
fi

# 获取版本号参数
VERSION=$SPUG_RELEASE
BASE_IMAGE_NAME="${BASE_IMAGE_NAME}"
IMAGE_NAME="${BASE_IMAGE_NAME}:${VERSION}"

echo "开始蓝绿部署 Docker 镜像: ${IMAGE_NAME}"
echo "生产端口: ${PRODUCTION_PORT}, 临时端口: ${TEMP_PORT}"

# 回滚函数
rollback() {
    echo "错误: 部署失败，开始回滚..."
    if [ ! -z "$TEMP_CONTAINER_ID" ]; then
        echo "停止并删除临时容器..."
        docker stop "$TEMP_CONTAINER_ID" >/dev/null 2>&1
        docker rm "$TEMP_CONTAINER_ID" >/dev/null 2>&1
    fi
    echo "回滚完成，保持原有服务运行"
    exit 1
}

# 健康检查函数
health_check() {
    local url=$1
    local max_attempts=$2
    local interval=$3

    echo "开始健康检查: $url"
    for i in $(seq 1 $max_attempts); do
        echo "健康检查尝试 $i/$max_attempts..."
        if curl -f -s "$url" >/dev/null 2>&1; then
            echo "健康检查通过!"
            return 0
        fi
        sleep $interval
    done
    echo "健康检查失败: 超过最大尝试次数"
    return 1
}

# 步骤1: 拉取新镜像
echo "步骤1: 拉取新镜像..."
echo "正在拉取镜像: ${IMAGE_NAME}"
docker pull "${IMAGE_NAME}"

if [ $? -ne 0 ]; then
    echo "错误: 镜像拉取失败"
    exit 1
fi
echo "镜像拉取成功"

# 步骤2: 启动新容器（临时端口）
echo "步骤2: 启动新容器（临时端口 ${TEMP_PORT}）..."

# 清理可能存在的临时容器
docker stop "$TEMP_CONTAINER_NAME" >/dev/null 2>&1
docker rm "$TEMP_CONTAINER_NAME" >/dev/null 2>&1

# 启动新容器
echo "执行Docker命令: docker run -d --name ${TEMP_CONTAINER_NAME} -p ${TEMP_PORT}:${PRODUCTION_PORT} -v /srv/trendradar/output:/srv/trendradar/output ${DOCKER_ENV_FILE_OPTION} ${IMAGE_NAME}"
TEMP_CONTAINER_ID=$(docker run -d --name "${TEMP_CONTAINER_NAME}" -p "${TEMP_PORT}:${PRODUCTION_PORT}" -v /srv/trendradar/output:/srv/trendradar/output ${DOCKER_ENV_FILE_OPTION} "${IMAGE_NAME}")

if [ $? -ne 0 ] || [ -z "$TEMP_CONTAINER_ID" ]; then
    echo "错误: 新容器启动失败"
    exit 1
fi
echo "新容器启动成功，容器ID: $TEMP_CONTAINER_ID"

# 步骤3: 健康检查
echo "步骤3: 健康检查新容器..."
echo "等待容器完全启动..."
sleep 5

if ! health_check "$HEALTH_CHECK_URL" $MAX_HEALTH_CHECK_ATTEMPTS $HEALTH_CHECK_INTERVAL; then
    rollback
fi

# 步骤4: 停止旧容器
echo "步骤4: 停止旧容器..."
OLD_CONTAINER_ID=$(docker ps --format "{{.ID}}\t{{.Names}}" | grep "$CONTAINER_NAME" | grep -v "$TEMP_CONTAINER_NAME" | awk '{print $1}')

if [ ! -z "$OLD_CONTAINER_ID" ]; then
    echo "发现旧容器: $OLD_CONTAINER_ID"
    echo "正在停止旧容器..."
    docker stop "$OLD_CONTAINER_ID"
    echo "正在删除旧容器..."
    docker rm "$OLD_CONTAINER_ID"
    echo "旧容器已删除"
else
    echo "未发现旧容器"
fi

# 步骤5: 切换端口
echo "步骤5: 切换新容器到生产端口..."
echo "停止临时容器..."
docker stop "$TEMP_CONTAINER_ID"

echo "启动生产容器..."
echo "执行Docker命令: docker run -d --name ${CONTAINER_NAME} -p ${PRODUCTION_PORT}:${PRODUCTION_PORT} -v /srv/trendradar/output:/srv/trendradar/output ${DOCKER_ENV_FILE_OPTION} ${IMAGE_NAME}"
PRODUCTION_CONTAINER_ID=$(docker run -d --name "${CONTAINER_NAME}" -p "${PRODUCTION_PORT}:${PRODUCTION_PORT}" -v /srv/trendradar/output:/srv/trendradar/output ${DOCKER_ENV_FILE_OPTION} "${IMAGE_NAME}")

if [ $? -ne 0 ] || [ -z "$PRODUCTION_CONTAINER_ID" ]; then
    echo "错误: 生产容器启动失败"
    # 尝试重新启动临时容器作为应急措施
    docker start "$TEMP_CONTAINER_ID"
    rollback
fi

# 清理临时容器
echo "清理临时容器..."
docker rm "$TEMP_CONTAINER_ID" >/dev/null 2>&1

# 最终健康检查
echo "步骤6: 最终健康检查..."
sleep 3
FINAL_HEALTH_URL="http://localhost:${PRODUCTION_PORT}/api/health"
if ! health_check "$FINAL_HEALTH_URL" 10 2; then
    echo "警告: 最终健康检查失败，但容器已启动"
fi

echo "蓝绿部署完成!"
echo "服务已在端口 ${PRODUCTION_PORT} 上运行"
echo "可以通过 http://localhost:${PRODUCTION_PORT} 访问服务"

# 清理旧镜像（可选）
echo "清理旧镜像..."
OLD_IMAGES=$(docker images --format "{{.ID}}\t{{.Repository}}:{{.Tag}}" | grep "${BASE_IMAGE_NAME}" | grep -v ":${VERSION}" | awk '{print $1}')
if [ ! -z "$OLD_IMAGES" ]; then
    echo "发现旧镜像，正在清理..."
    echo "$OLD_IMAGES" | xargs -r docker rmi >/dev/null 2>&1
    echo "旧镜像清理完成"
fi

# 显示当前运行的容器
echo "当前运行的Docker容器:"
docker ps
