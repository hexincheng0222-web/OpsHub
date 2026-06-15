# OpsHub 宝塔部署指南

> 前后端分离部署：前端 dist 由 Nginx 托管，后端 API 由宝塔 Node 项目管理器运行。

## 前置条件

- 宝塔面板已安装
- 宝塔已安装 **Node.js 版本管理器**（软件商店搜索安装）
- Node.js 18+ 已安装并设为命令行默认版本

---

## 部署步骤

### 第一步：上传项目

将项目上传到服务器：

```
/www/wwwroot/opshub/
```

> ⚠️ 不要上传 `node_modules/` 和 `data/`

### 第二步：安装依赖 & 构建

```bash
cd /www/wwwroot/opshub
npm install
npm run build
```

### 第三步：启动后端 API

宝塔面板 → **网站** → **Node项目** → **添加Node项目**

- **项目目录**：`/www/wwwroot/opshub`
- **启动文件**：`server/index.ts`
- **包管理器**：npm
- **端口**：`3001`
- **Node版本**：18+
- **项目名称**：`opshub`

> 启动后验证：`curl http://127.0.0.1:3001/api/health`

### 第四步：配置前端网站

#### 4.1 添加站点

宝塔面板 → **网站** → **添加站点**

- **域名**：填写服务器 IP 或域名
- **根目录**：`/www/wwwroot/opshub/dist`
- **PHP版本**：纯静态

#### 4.2 添加反向代理（API 转发）

站点 → **设置** → **反向代理** → **添加反向代理**

- **代理名称**：`opshub-api`
- **目标URL**：`http://127.0.0.1:3001`
- **发送域名**：`$host`

#### 4.3 开启 Gzip

站点 → **设置** → **性能** → 开启 Gzip 压缩

#### 4.4 配置 SPA 路由

站点 → **设置** → **配置文件**，找到 `location /` 块，确保有：

```nginx
location / {
    root /www/wwwroot/opshub/dist;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```

#### 4.5 静态资源缓存（可选）

站点 → **设置** → **配置文件**，在 `server {` 块内添加：

```nginx
location ~* \.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
    access_log off;
}
```

### 第五步：验证

- 访问 `http://你的IP` → 看到 OpsHub 页面
- 访问 `http://你的IP/api/health` → 返回 `{"status":"ok",...}`

---

## 后续更新

```bash
cd /www/wwwroot/opshub
git pull
npm install          # 如有新依赖
npm run build        # 重新构建前端
```

然后在宝塔 Node 项目管理器中**重启**后端服务。

## 数据备份

数据库在 `data/opshub.db`，定期备份此文件即可。

> ⚠️ 数据库包含服务凭据，请妥善保管。
