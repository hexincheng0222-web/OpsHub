# OpsHub 部署指南

> 只需要 Node.js + PM2，不需要 Nginx、PHP、宝塔面板。

## 前置条件

- 服务器已安装 **Node.js 18+**
- 已安装 **PM2**（`npm install -g pm2`）

## 快速部署（4 步）

### 1. 上传项目

将项目上传到服务器，例如 `/www/wwwroot/opshub/`

> 不需要上传 `node_modules/`、`data/`、`dist/`

### 2. 安装依赖 & 构建

```bash
cd /www/wwwroot/opshub
npm install
npm run build
```

### 3. 配置环境变量（可选）

```bash
cp .env.example .env
```

默认配置即可，如需修改端口或数据库路径再编辑 `.env`。

### 4. 启动

```bash
npx pm2 start ecosystem.config.cjs
```

启动后直接访问 `http://服务器IP:3001` 即可。

---

## 如果想用 80 端口 / 域名访问

### 方式一：宝塔面板（推荐，小白友好）

宝塔面板 → 网站 → 添加站点 → 设置 → 反向代理 → 目标 `http://127.0.0.1:3001`

### 方式二：Nginx 手动配置

```nginx
server {
    listen 80;
    server_name 你的IP或域名;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # API + 前端全部代理到 Node
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

### 方式三：直接用 3001 端口

什么都不用配，直接访问 `http://IP:3001`。

---

## PM2 常用命令

```bash
npx pm2 start ecosystem.config.cjs   # 启动
npx pm2 restart opshub                # 重启
npx pm2 stop opshub                   # 停止
npx pm2 delete opshub                 # 删除
npx pm2 logs opshub                   # 查看日志
npx pm2 monit                         # 监控面板
```

## 开机自启

```bash
npx pm2 startup                       # 生成开机自启命令（按提示执行）
npx pm2 save                          # 保存当前进程列表
```

## 后续更新

```bash
cd /www/wwwroot/opshub
git pull
npm install          # 如有新依赖
npm run build
npx pm2 restart opshub
```

## 数据备份

数据库在 `data/opshub.db`，备份此文件即可。

```bash
cp data/opshub.db /备份路径/opshub_$(date +%Y%m%d).db
```

> ⚠️ 数据库包含服务凭据，请妥善保管。
