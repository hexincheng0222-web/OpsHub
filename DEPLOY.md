# OpsHub 宝塔部署指南

## 前置条件

- 宝塔面板已安装
- 宝塔已安装 **Node.js 版本管理器**（软件商店搜索 "Node.js 版本管理器" 安装）
- Node.js 18+ 版本已安装

## 部署步骤

### 第一步：上传项目

将整个项目文件夹上传到服务器，例如：
```
/www/wwwroot/opshub/
```

> ⚠️ `node_modules` 不需要上传，服务器上重新安装

### 第二步：安装依赖

```bash
cd /www/wwwroot/opshub
npm install --production=false
```

### 第三步：构建前端

```bash
npm run build
```

构建完成后会在项目根目录生成 `dist/` 文件夹。

### 第四步：创建 Node 项目

1. 打开宝塔面板
2. 进入 **网站** → **Node项目** → **添加Node项目**
3. 填写配置：
   - **项目目录**：`/www/wwwroot/opshub`
   - **启动选项**：选择 `tsx server/index.ts`（或手动填写）
   - **端口**：`3001`
   - **Node版本**：选择已安装的 18+ 版本
   - **项目名称**：`opshub`
4. 点击提交，等待启动

> 或者用 PM2 手动启动：
> ```bash
> cd /www/wwwroot/opshub
> npx pm2 start ecosystem.config.cjs
> ```

### 第五步：配置 Nginx

1. 宝塔面板 → **网站** → **添加站点**
   - 域名填写服务器 IP 或配置的域名
   - 根目录指向：`/www/wwwroot/opshub/dist`

2. 点击站点 → **设置** → **反向代理** → **添加反向代理**
   - **代理名称**：`opshub-api`
   - **目标URL**：`http://127.0.0.1:3001`
   - **发送域名**：`$host`

3. 或者直接编辑站点的 Nginx 配置，替换为：

```nginx
server {
    listen       80;
    server_name  你的IP或域名;

    # 前端静态文件
    location / {
        root /www/wwwroot/opshub/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
```

### 第六步：验证

- 访问 `http://你的IP` 查看前端页面
- 访问 `http://你的IP/api/health` 应返回 `{"status":"ok",...}`

---

## 后续更新

代码更新后：
```bash
cd /www/wwwroot/opshub
git pull
npm run build
# 重启 Node 项目（宝塔面板点重启，或命令行）
npx pm2 restart opshub-server
```

## 数据备份

数据库文件在 `data/opshub.db`，定期备份此文件即可。
宝塔面板可以设置定时任务来备份：
```bash
cp /www/wwwroot/opshub/data/opshub.db /www/backup/opshub_$(date +%Y%m%d).db
```
