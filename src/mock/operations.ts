export interface ManualFolder {
  id: string
  name: string
  icon: string
}

export interface ManualDoc {
  id: number
  title: string
  content: string  // Markdown with base64 images
  folderId: string
  author: string
  createTime: string
  updateTime: string
}

export const MOCK_FOLDERS: ManualFolder[] = [
  { id: 'network', name: '网络运维', icon: '📡' },
  { id: 'server', name: '服务器运维', icon: '🖥️' },
  { id: 'database', name: '数据库运维', icon: '🗄️' },
  { id: 'security', name: '安全运维', icon: '🔒' },
  { id: 'routine', name: '日常巡检', icon: '📋' },
]

export const mockManuals: ManualDoc[] = [
  {
    id: 1,
    title: 'Nginx 反向代理配置手册',
    content: `# Nginx 反向代理配置手册

## 概述

Nginx 作为反向代理服务器，将客户端请求转发到后端服务。本文档涵盖生产环境常用配置。

## 基本配置

\`\`\`nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
\`\`\`

## 负载均衡

\`\`\`nginx
upstream backend {
    server 10.0.1.10:3000 weight=3;
    server 10.0.1.11:3000 weight=2;
    server 10.0.1.12:3000 backup;
}
\`\`\`

## 注意事项

- **健康检查**：建议配合 upstream 模块的 \`health_check\` 使用
- **超时设置**：长连接建议 \`proxy_read_timeout 300s\`
- **日志**：生产环境请开启 \`access_log\` 便于排查问题

> 生产环境修改后务必先 \`nginx -t\` 检查语法，再 \`nginx -s reload\` 平滑重启`,
    folderId: 'network',
    author: '张工',
    createTime: '2025-03-10 09:30',
    updateTime: '2025-05-20 14:15',
  },
  {
    id: 2,
    title: '防火墙策略变更流程',
    content: `# 防火墙策略变更流程

## 适用范围

本流程适用于 FortiGate 系列防火墙的策略新增、修改、删除操作。

## 变更前检查

1. **确认业务影响范围** — 涉及哪些 IP 段和端口
2. **备份当前配置**
   \`\`\`bash
   execute backup config tftp /tmp/fw-backup-$(date +%Y%m%d).conf 10.0.0.100
   \`\`\`
3. **创建变更工单** — 记录变更原因和时间窗口

## 操作步骤

### 新增策略

1. 登录 Web 管理界面 \`https://10.0.0.10:8443\`
2. 导航至 **策略&对象** → **IPv4策略**
3. 点击 **新建**
4. 填写参数：

| 参数 | 示例值 |
|------|--------|
| 名称 | \`ALLOW_Office_to_DMZ\` |
| 源地址 | \`192.168.1.0/24\` |
| 目的地址 | \`10.0.2.0/24\` |
| 服务 | \`HTTP,HTTPS,SSH\` |
| 动作 | \`ACCEPT\` |

5. 启用 **日志记录**

## 回滚方案

如果变更后出现异常，立即执行：
\`\`\`bash
execute restore config tftp /tmp/fw-backup-20250520.conf 10.0.0.100
\`\`\`

## 变更后验证

- [ ] 策略序列号正确
- [ ] 业务方确认服务可达
- [ ] 日志无异常拦截记录`,
    folderId: 'security',
    author: '赵工',
    createTime: '2025-04-02 16:00',
    updateTime: '2025-04-02 16:00',
  },
  {
    id: 3,
    title: 'MySQL 主从切换操作手册',
    content: `# MySQL 主从切换操作手册

## 适用环境

- **主库**: 10.0.1.20:3306 (R750xa)
- **从库**: 10.0.1.21:3306 (R750xa)
- **版本**: MySQL 8.0.35

## 切换前准备

### 1. 确认主从同步状态

\`\`\`sql
-- 在从库执行
SHOW SLAVE STATUS\\G
\`\`\`

关键指标：
- \`Slave_IO_Running: Yes\`
- \`Slave_SQL_Running: Yes\`
- \`Seconds_Behind_Master\` 接近 0

### 2. 锁定主库写入

\`\`\`sql
SET GLOBAL read_only = ON;
FLUSH TABLES WITH READ LOCK;
\`\`\`

## 执行切换

### Step 1: 确保从库追平

\`\`\`sql
-- 从库执行
SELECT MASTER_POS_WAIT('mysql-bin.000123', 456789);
\`\`\`

### Step 2: 提升从库为主库

\`\`\`sql
STOP SLAVE;
RESET SLAVE ALL;
SET GLOBAL read_only = OFF;
\`\`\`

### Step 3: 修改应用连接地址

更新应用配置文件，将数据库地址指向 \`10.0.1.21\`。

## 验证清单

- [x] 新主库可写入
- [x] 应用服务正常启动
- [x] 监控告警恢复

## 回滚方案

保留原主库数据，若切换后 30 分钟内异常，立即切回 \`10.0.1.20\`。`,
    folderId: 'database',
    author: '李工',
    createTime: '2025-01-16 09:00',
    updateTime: '2025-04-10 11:30',
  },
  {
    id: 4,
    title: '服务器上架标准流程',
    content: `# 服务器上架标准流程

## 准备工作

### 硬件检查

- 核对设备清单（型号、序列号）
- 检查外观无运输损坏
- 确认配件齐全（导轨、电源线、网线）

### 机柜准备

- 确认目标机柜预留 U 位足够
- 检查 PDU 电源接口可用
- 确认网络交换机端口充足

## 上架步骤

1. **安装导轨** — 按机柜前后立柱间距调整导轨长度
2. **安装服务器** — 两人协作将服务器推入导轨，锁紧螺丝
3. **接线**：
   - 电源线双路接入（PDU-A + PDU-B）
   - 网线接入管理口（Mgmt）和业务口
4. **标签** — 机柜前后贴设备标签

## 上电检查

\`\`\`bash
# iDRAC/IPMI 检查
ipmitool -H 10.0.0.50 -U admin -P password power status

# 硬件自检
ipmitool -H 10.0.0.50 -U admin -P password sel list
\`\`\`

## BIOS/固件设置

- **启动模式**: UEFI
- **电源策略**: Performance
- **虚拟化**: VT-x / AMD-V 开启

> ⚠️ 上架后 24 小时内密切监控温度和风扇转速`,
    folderId: 'server',
    author: '王工',
    createTime: '2025-02-20 08:30',
    updateTime: '2025-05-01 10:00',
  },
  {
    id: 5,
    title: '每日巡检清单',
    content: `# 每日巡检清单

## 巡检时间

**每日上午 9:00 - 9:30**

## 巡检项目

### 1. 系统监控大盘

登录 [Grafana](http://10.3.0.142:3000) 检查：

- [ ] CPU 使用率均 < 80%
- [ ] 内存使用率均 < 85%
- [ ] 磁盘使用率均 < 90%
- [ ] 无新增告警

### 2. 核心服务状态

| 服务 | 检查方式 | 预期 |
|------|---------|------|
| Zabbix | Web 可访问 | 在线 |
| Gitea | \`curl -s http://10.3.0.145:3000\` | 200 |
| Grafana | Web 可访问 | 在线 |

### 3. 备份检查

\`\`\`bash
# 检查最近备份时间
find /backup/*/ -type f -mtime -1 | wc -l
\`\`\`

### 4. 日志异常扫描

\`\`\`bash
# 扫描关键错误
grep -i "error\\|fail\\|critical" /var/log/syslog | tail -20
\`\`\`

## 异常处理

- 黄色告警：记录并跟踪
- 红色告警：立即通知运维经理
- 磁盘 > 95%：立即执行清理脚本

## 巡检记录模板

\`\`\`
日期: ____年__月__日
巡检人: ______
异常项: ______
处理措施: ______
\`\`\``,
    folderId: 'routine',
    author: '何工',
    createTime: '2024-12-01 09:00',
    updateTime: '2025-05-15 09:00',
  },
  {
    id: 6,
    title: 'SSL 证书申请与部署',
    content: `# SSL 证书申请与部署

## 证书类型

| 类型 | 适用场景 | 有效期 |
|------|---------|--------|
| Let's Encrypt | 公网服务 | 90天 |
| 内部 CA | 内网服务 | 1年 |
| 商业证书 | 对外业务 | 1年 |

## Let's Encrypt 申请

\`\`\`bash
# 安装 certbot
apt install certbot

# 申请证书（DNS 验证）
certbot certonly --manual --preferred-challenges dns \
  -d api.example.com \
  -m ops@example.com
\`\`\`

## Nginx 部署

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
}
\`\`\`

## 自动续期

\`\`\`bash
# 添加 crontab 每月检查
0 3 1 * * certbot renew --quiet --post-hook "nginx -s reload"
\`\`\`

## 验证命令

\`\`\`bash
# 检查证书有效期
openssl s_client -connect api.example.com:443 -servername api.example.com </dev/null 2>/dev/null | openssl x509 -noout -dates
\`\`\``,
    folderId: 'security',
    author: '赵工',
    createTime: '2025-01-14 11:20',
    updateTime: '2025-03-01 09:00',
  },
  {
    id: 7,
    title: 'Docker 服务部署规范',
    content: `# Docker 服务部署规范

## 镜像管理

- **命名规范**: \`项目名/服务名:版本号\`
- **基础镜像**: 统一使用 \`node:20-alpine\` / \`python:3.12-slim\`
- **安全扫描**: 部署前运行 \`docker scan\`

## 容器配置模板

\`\`\`yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    image: project/app:1.0.0
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
\`\`\`

## 资源限制

\`\`\`yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
\`\`\`

## 部署检查清单

- [ ] \`docker-compose config\` 语法正确
- [ ] 端口不冲突
- [ ] 数据卷路径存在
- [ ] 环境变量完整
- [ ] 健康检查配置
- [ ] 日志驱动配置为 \`json-file\` + 切割

## 常用命令

\`\`\`bash
# 滚动更新
docker-compose pull && docker-compose up -d --remove-orphans

# 查看日志
docker-compose logs -f --tail=100 service-name

# 清理旧镜像
docker image prune -a --filter "until=72h"
\`\`\``,
    folderId: 'server',
    author: '张工',
    createTime: '2025-02-10 14:00',
    updateTime: '2025-04-20 16:30',
  },
  {
    id: 8,
    title: '网络故障排查 SOP',
    content: `# 网络故障排查 SOP

## 排查原则

> 从物理层到应用层，逐层排查

## 一、物理层

### 检查项
1. 设备指示灯是否正常
2. 网线是否松动
3. 交换机端口状态

\`\`\`bash
# 查看端口状态
show interfaces status | include err-disabled
show interfaces counters errors
\`\`\`

## 二、链路层

### ARP 检查
\`\`\`bash
arp -a | grep 10.0.0.1
ip neigh show
\`\`\`

### MAC 地址表
\`\`\`bash
show mac address-table | include 10.0.0.1
\`\`\`

## 三、网络层

### 连通性测试
\`\`\`bash
ping -c 4 10.0.0.1
traceroute 10.0.0.1
mtr -r -c 10 10.0.0.1
\`\`\`

### 路由检查
\`\`\`bash
ip route show
ip route get 10.0.0.1
\`\`\`

## 四、传输层

### 端口连通性
\`\`\`bash
nc -zv 10.0.0.1 443
telnet 10.0.0.1 3306
\`\`\`

## 五、应用层

### HTTP 状态
\`\`\`bash
curl -I -m 5 http://10.0.0.1
curl -v https://api.example.com
\`\`\`

## 常用排查工具速查表

| 场景 | 工具 | 命令 |
|------|------|------|
| DNS 解析 | dig/nslookup | \`dig api.example.com\` |
| 抓包分析 | tcpdump | \`tcpdump -i eth0 port 443\` |
| 带宽测试 | iperf3 | \`iperf3 -c 10.0.0.1\` |`,
    folderId: 'network',
    author: '张工',
    createTime: '2025-03-05 10:00',
    updateTime: '2025-05-10 08:45',
  },
]
