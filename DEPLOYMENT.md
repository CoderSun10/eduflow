# EduFlow 部署指南（手动部署）

本指南将帮助你将 EduFlow 应用手动部署到云服务器。

---

## 一、服务器要求

- **配置**: 2核 4GB 内存（最低），推荐 4核 8GB
- **系统**: Ubuntu 22.04 LTS（推荐）
- **磁盘**: 至少 40GB SSD
- **网络**: 开放 80、443、22 端口

---

## 二、服务器初始化

### 1. 连接服务器

```bash
ssh root@你的服务器IP
```

### 2. 更新系统

```bash
apt update && apt upgrade -y
```

### 3. 安装必要工具

```bash
apt install -y curl wget git vim unzip
```

### 4. 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 启动 Docker
systemctl enable docker
systemctl start docker

# 验证安装
docker --version
```

### 5. 安装 Docker Compose

```bash
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

---

## 三、上传代码到服务器

### 方法 1：使用 SCP 上传（推荐）

在**本地电脑**执行：

```bash
# 先打包项目（排除 node_modules）
cd C:\Users\sqx\Desktop
tar --exclude='eduflow/node_modules' --exclude='eduflow/frontend/node_modules' --exclude='eduflow/backend/node_modules' --exclude='eduflow/.git' -czvf eduflow.tar.gz eduflow

# 上传到服务器
scp eduflow.tar.gz root@你的服务器IP:/opt/
```

在**服务器**上执行：

```bash
cd /opt
tar -xzvf eduflow.tar.gz
rm eduflow.tar.gz
cd eduflow
```

### 方法 2：使用 Git 拉取

如果代码已推送到 Git 仓库（GitHub/Gitee/Codeup）：

```bash
cd /opt
git clone https://你的仓库地址/eduflow.git
cd eduflow
```

---

## 四、配置环境变量

### 1. 创建生产环境配置文件

```bash
cd /opt/eduflow
cp .env.production.example .env.production
vim .env.production
```

### 2. 修改配置内容

```bash
# 数据库
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Aa123456aA
POSTGRES_DB=eduflow

# JWT 密钥
JWT_SECRET=KyVRV7dG5c/BrWdFe7vYKA06Li5MVM10MB04HYhc2PY=
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# DeepSeek API
DEEPSEEK_API_KEY=sk-73649e9a847843e28dc45e83db89444f
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# 运行安全与限流
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
TAVILY_API_KEY=
REDIS_PASSWORD=
REDIS_DB=0

# CORS（你的域名）
CORS_ORIGINS=https://www.sunqi.xin,https://sunqi.xin

# 邮件服务（密码重置）
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your_email@qq.com
EMAIL_PASS=your_smtp_authorization_code

# 前端公开地址（密码重置链接回跳地址）
FRONTEND_URL=https://www.sunqi.xin

# 阿里云语音识别
ALIYUN_AK_ID=your_access_key_id
ALIYUN_AK_SECRET=your_access_key_secret
ALIYUN_NLS_APPKEY=your_nls_appkey

# 端口
FRONTEND_PORT=80
FRONTEND_SSL_PORT=443

# Nginx / SSL
SERVER_NAME=www.sunqi.xin sunqi.xin
SSL_CERT_PATH=/etc/letsencrypt/live/www.sunqi.xin/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/www.sunqi.xin/privkey.pem
```

> **安全提示**: 生产环境请更换为更强的密码和密钥！

---

## 五、构建并启动服务

### 1. 构建 Docker 镜像

```bash
cd /opt/eduflow
docker compose --env-file .env.production build
```

这一步需要 5-10 分钟，会构建后端和前端镜像。

### 2. 启动所有服务

```bash
docker compose --env-file .env.production up -d
```

### 3. 查看服务状态

```bash
docker compose --env-file .env.production ps
```

应该看到 4 个服务都是 `Up` 状态：

- `eduflow-postgres`
- `eduflow-redis`
- `eduflow-backend`
- `eduflow-frontend`

### 4. 初始化数据库

```bash
docker compose --env-file .env.production exec backend npm run db:init
```

### 5. 验证部署

```bash
# 检查后端健康状态（后端未直接暴露到宿主机，因此从容器内验证）
docker compose --env-file .env.production exec backend wget --no-verbose -O - http://localhost:4000/api/health

# 检查前端首页
curl -I http://localhost

# 如果已经配置 HTTPS，也可以检查代理后的 API
curl -k https://localhost/api/health
```

---

## 六、配置域名和 HTTPS（可选）

### 1. 配置域名解析

在域名服务商处添加 A 记录：

- **主机记录**: `www` 或 `@`
- **记录值**: 你的服务器 IP

### 2. 安装 Certbot 获取 SSL 证书

```bash
# 安装 Certbot
apt install -y certbot

# 停止前端服务（释放 80 端口）
docker compose --env-file .env.production stop frontend

# 获取证书
certbot certonly --standalone -d www.sunqi.xin

# 将证书路径写入 .env.production
# 例如：
# SERVER_NAME=www.sunqi.xin sunqi.xin
# SSL_CERT_PATH=/etc/letsencrypt/live/www.sunqi.xin/fullchain.pem
# SSL_KEY_PATH=/etc/letsencrypt/live/www.sunqi.xin/privkey.pem

# 重启前端服务
docker compose --env-file .env.production start frontend
```

### 3. 配置 Nginx HTTPS（进阶）

如果需要 HTTPS，建议在服务器上安装 Nginx 作为反向代理：

```bash
apt install -y nginx

# 配置 Nginx
vim /etc/nginx/sites-available/eduflow
```

Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name www.sunqi.xin;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name www.sunqi.xin;

    ssl_certificate /etc/letsencrypt/live/www.sunqi.xin/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.sunqi.xin/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# 启用配置
ln -s /etc/nginx/sites-available/eduflow /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 七、常用运维命令

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f backend

# 查看前端日志
docker-compose logs -f frontend
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart backend
```

### 停止/启动服务

```bash
# 停止所有服务
docker-compose down

# 启动所有服务
docker-compose up -d
```

### 更新部署

当代码更新后：

```bash
cd /opt/eduflow

# 方法1：如果使用 Git
git pull origin main

# 方法2：如果使用 SCP，重新上传代码

# 重新构建并启动
docker-compose build
docker-compose up -d
```

---

## 八、数据库管理

### 进入数据库

```bash
docker-compose exec postgres psql -U postgres -d eduflow
```

### 备份数据库

```bash
docker-compose exec postgres pg_dump -U postgres eduflow > backup_$(date +%Y%m%d).sql
```

### 恢复数据库

```bash
cat backup_20240101.sql | docker-compose exec -T postgres psql -U postgres -d eduflow
```

---

## 九、故障排查

### 服务无法启动

```bash
# 查看详细日志
docker-compose logs backend

# 常见问题：
# 1. 端口被占用：lsof -i:80
# 2. 内存不足：free -h
# 3. 磁盘空间不足：df -h
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
docker-compose ps postgres

# 检查连接
docker-compose exec postgres pg_isready
```

### 前端无法访问

```bash
# 检查容器是否运行
docker-compose ps frontend

# 检查端口
netstat -tlnp | grep 80
```

---

## 十、目录结构

```
/opt/eduflow/
├── docker-compose.yml      # Docker Compose 配置
├── .env.production         # 生产环境变量
├── backend/
│   ├── Dockerfile         # 后端 Docker 配置
│   └── src/               # 后端源码
└── frontend/
    ├── Dockerfile         # 前端 Docker 配置
    ├── nginx.conf         # Nginx 配置
    └── src/               # 前端源码
```

---

## 快速部署清单

1. ✅ SSH 连接服务器
2. ✅ 安装 Docker 和 Docker Compose
3. ✅ 上传代码到 `/opt/eduflow`
4. ✅ 配置 `.env.production`
5. ✅ 运行 `docker-compose build`
6. ✅ 运行 `docker-compose up -d`
7. ✅ 运行 `docker-compose exec backend npm run db:init`
8. ✅ 访问 http://你的服务器IP 测试

完成！🎉
