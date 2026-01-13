# 项目简介

Fast Config 是一个轻量级配置中心，提供服务配置的创建、版本管理、回滚/差异对比、文本导入（.env 风格）以及按环境的令牌访问与 IP 白名单控制。后端基于 FastAPI + SQLAlchemy，数据库使用 MySQL；前端使用 React + Vite + TailwindCSS v4。

## 功能概览
- 服务管理：服务注册、访问凭证（AK/SK）与访问令牌管理、IP 白名单
- 配置管理：按服务+环境维护配置，支持版本快照、回滚、差异对比与 .env 文本导入
- 拉取接口：服务方通过令牌拉取当前环境配置
- 管理控制台：React 前端，登录后进行服务与配置维护
- 健康检查与部署：提供健康检查接口与 Dockerfile、蓝绿部署脚本

## 目录结构
- backend/app：FastAPI 应用与依赖
- backend/scripts：初始化数据库 SQL
- backend/deploy：Dockerfile 与部署脚本
- frontend：React 管理控制台

## 环境要求
- Windows 11（无需独立显卡）
- Python 3.12（建议在项目根使用 .venv 虚拟环境）
- Node.js 18+ 与 pnpm/npm（二选一）
- MySQL 8.0+

## 后端启动
1) 创建并激活虚拟环境（项目根）

```
.venv\Scripts\activate
```

2) 安装依赖

```
cd backend\app
pip install -r requirements.txt
```

3) 初始化数据库（创建库 fast_config 并执行 SQL）

```
mysql -h <host> -u <user> -p
-- 登录后执行 backend\scripts\fast_config.sql
```

4) 在项目根创建 .env（或放在 backend\app 下也可）：

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fast_config
DB_CHARSET=utf8mb4

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_JWT_SECRET=replace_with_strong_secret

CRED_MASTER_KEY=replace_with_master_key
LOG_LEVEL=INFO
SERVICE_VERSION=0.0.1

# 反向代理可选
TRUSTED_PROXIES=127.0.0.1/32,10.0.0.0/8
REAL_IP_HEADER=X-Real-IP
```

5) 启动开发服务

```
cd backend\app
python -m uvicorn main:app --host 0.0.0.0 --port 9530 --reload
```

- 健康检查：GET http://localhost:9530/api/health（参考 [main.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/main.py#L45-L60)）
- 管理端鉴权：除 /api/health、/api/v1/auth/login 和拉取接口 GET 请求外，其余路由需携带管理员 Bearer Token（参考 [admin_auth.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/middleware/admin_auth.py#L1-L42)）

## 前端启动
1) 安装依赖并配置后端地址

```
cd frontend
npm install
```

在 frontend 目录创建 .env：

```
VITE_API_BASE=http://localhost:9530
```

2) 启动开发服务

```
npm run dev
```

默认在 http://localhost:5173 访问管理控制台。前端会使用 VITE_API_BASE 访问后端（参考 [api.ts](file:///d:/projects/skyplatformpro/skyplatform-fast-config/frontend/src/api.ts#L1-L23)）。

## 常用接口示例
- 登录获取管理员 Token（参考 [auth.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/api/v1/auth.py#L1-L30)）

```
curl -X POST http://localhost:9530/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

- 拉取配置（服务侧，需先在控制台为服务生成访问令牌，参考 [services.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/api/v1/services.py#L1-L65)）

```
curl -H "Authorization: Bearer <service_token>" ^
  http://localhost:9530/api/v1/pull/<service_code>/prod
```

- 导入 .env 文本为配置（参考 [configs.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/api/v1/configs.py#L104-L169)）

```
POST /api/v1/configs/import
Body:
{
  "service_code": "example",
  "env": "prod",
  "text": "KEY1=VALUE1\nKEY2=VALUE2",
  "new_version": "0.0.2",
  "updated_by": "admin"
}
```

- 前端获取后端地址（支持按 appid 切换，参考 [meta.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/api/v1/meta.py)）

```
# 查询（公开接口）：可携带 X-App-Id 头或 appid 查询参数
curl -H "X-App-Id: myapp" http://localhost:9530/api/v1/meta/backend-base
# 或
curl "http://localhost:9530/api/v1/meta/backend-base?appid=myapp"

# 设置映射（需管理员 Token）
curl -X POST http://localhost:9530/api/v1/meta/backend-base ^
  -H "Authorization: Bearer <admin_token>" ^
  -H "Content-Type: application/json" ^
  -d "{\"appid\":\"myapp\",\"base_url\":\"http://10.0.0.2:9530\",\"note\":\"dev env\"}"
```

## 部署参考
- 后端镜像与健康检查参考 [Dockerfile](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/Dockerfile)；生产环境使用 gunicorn，开发环境使用 uvicorn reload 模式
- 蓝绿部署脚本参考 [deploy.sh](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/deploy/deploy.sh) 与备份版本 [deploy_bak.sh](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/deploy/deploy_bak.sh)

## 相关代码参考
- 后端入口与路由挂载：[main.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/main.py)
- 数据库配置与构建：[config.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/config.py)、[database.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/database.py)
- 配置模型与接口：[models/v1/configs.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/models/v1/configs.py)、[api/v1/configs.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/api/v1/configs.py)
- 服务模型与接口：[models/v1/services.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/models/v1/services.py)、[api/v1/services.py](file:///d:/projects/skyplatformpro/skyplatform-fast-config/backend/app/api/v1/services.py)
