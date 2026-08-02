# 设备实时监控数据接入设计（LibreNMS MySQL 直连）

- 日期：2026-08-02
- 范围：数据中心管理 → 设备详情抽屉 增加 CPU/内存/温度/端口状态/端口速率 实时监控

## 背景与目标

数据中心管理（`DevicesView.vue`）的设备详情抽屉（`DeviceDrawer.vue`）目前只展示静态资产信息（型号、厂商、IP、U 高度、端口数、状态），无任何实时状态。

目标：将 LibreNMS（10.3.0.141）监控的实时状态接入设备详情，展示 **CPU、内存、温度、端口状态、端口速率**，并提供历史趋势图。

## 需求确认（用户已确认）

| 决策点 | 选择 |
|--------|------|
| 数据来源 | **LibreNMS MySQL 直连**（API 不提供实时值 JSON，见下方「关键约束」） |
| 获取方式 | 后台定时轮询 + 缓存 |
| 历史趋势 | 实时值 + 历史趋势图 |
| 设备关联 | 用 IP 自动匹配（`devices.ip` ↔ LibreNMS `devices.hostname`） |
| 历史数据来源 | OpsHub 自存历史（定时存 SQLite） |
| 采集范围 | 仅轮询「启用监控」的设备 |
| 展示位置 | 设备详情抽屉（DeviceDrawer.vue） |
| 数据内容 | CPU、内存、温度、端口状态、端口速率 |

## 关键约束（LibreNMS API 能力调查）

**LibreNMS REST API 不提供实时值的 JSON：**
- `GET /api/v0/devices/{host}/health` → 只返回图表类型列表 `{graphs:[{desc,name}]}`，无数值
- `GET /api/v0/devices/{host}/health/{type}` → 只返回 `{sensor_id, desc}` 列表
- `GET /api/v0/devices/{host}/ports` → 只返回端口名 `{ports:[{ifName}]}`，无状态/速率
- 数值图表是 SVG 图片（`/graphs/health/{type}/{sensor_id}`），非结构化数据

**实时值真实存储位置**：LibreNMS 的 MySQL 库（每 5 分钟轮询写入）。

**结论**：采集走 **MySQL 直连**（用户已确认）。OpsHub 新增 `mysql2` 依赖，用只读账号查询当前值。

### LibreNMS MySQL 表结构（标准 schema）

| 数据 | 表 | 关键列 | 说明 |
|------|----|--------|------|
| 设备 | `devices` | `device_id`, `hostname` | IP 即 hostname |
| CPU | `processors` | `device_id`, `processor_usage`, `processor_descr` | usage 为百分比 0-100 |
| 内存 | `mempools` | `device_id`, `mempool_used`, `mempool_total`, `mempool_perc` | perc 百分比；used/total 字节 |
| 温度 | `sensors` | `device_id`, `sensor_class`, `sensor_current`, `sensor_descr` | 取 `sensor_class='temperature'` 的 current |
| 端口 | `ports` | `device_id`, `ifIndex`, `ifName`, `ifOperStatus`, `ifInOctets`, `ifOutOctets` | octets 为累计字节数（counter），速率需差值 |

**端口速率计算**：`ifInOctets/ifOutOctets` 是累计 counter，速率 = (本次 - 上次) / 时间差。OpsHub 每分钟采集并存历史，正好可用两次采样差值算 bps。

## 架构

```
LibreNMS MySQL (10.3.0.141, 只读账号)
   ↑ mysql2 连接池
   └── server/librenms.ts（新建）：MySQL 查询客户端
         ├─ getCurrentHealth(host)  → CPU/内存/温度 当前值
         ├─ getPorts(host)          → 端口状态 + 累计 octets
         └─ checkDeviceExists(host) → devices 表查 hostname
   │
   └── server/deviceMonitor.ts（新建）：采集调度器
         ├─ 每 60s 轮询 monitor_enabled=1 且 ip 非空的设备
         ├─ 查询 MySQL 当前值
         ├─ 用上次 octets 差值算端口速率
         ├─ 写 device_monitor_history 表（自存历史）
         └─ 更新内存缓存（实时快照）
   │
   ├── server/routes/devices.ts（新增 2 端点）
   │     GET /api/v1/devices/:id/monitor/snapshot → 实时快照（读缓存）
   │     GET /api/v1/devices/:id/monitor/history  → 历史趋势（查表）
   │
   └── src/components/devices/DeviceDrawer.vue（新增监控区块）
         └─ CPU/内存/温度 仪表 + 端口状态/速率表格 + 趋势图
```

## 数据模型

### 1. `devices` 表加列（迁移）

```sql
ALTER TABLE devices ADD COLUMN monitor_enabled INTEGER NOT NULL DEFAULT 0
```

复用 `db.ts` 现有迁移模式（`PRAGMA table_info` 检查 + 幂等 ALTER）。

### 2. 新增历史表

```sql
CREATE TABLE IF NOT EXISTS device_monitor_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id    INTEGER NOT NULL,          -- OpsHub devices.id
  cpu_usage    REAL,                      -- 百分比 0-100
  mem_used_mb  REAL,
  mem_total_mb REAL,
  mem_usage    REAL,                      -- 百分比 0-100
  temperature  REAL,                      -- 摄氏度
  ports_json   TEXT,                      -- 端口状态/速率快照 JSON
  collected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dmh_device_time ON device_monitor_history (device_id, collected_at DESC);
```

### 3. 端口速率计算状态（内存）

端口速率需两次采样差值，故内存缓存除快照外，还保存上次的 octets 基线：

```ts
// 上次采样 octets 基线：device_id -> Map<ifIndex, { in: number; out: number; ts: number }>
const octetsBaseline = new Map<number, Map<number, { in: number; out: number; ts: number }>>()

// 速率计算：bps = (本次octets - 上次octets) / (本次ts - 上次ts)
function calcRate(prev: number, curr: number, prevTs: number, currTs: number): number {
  if (curr < prev) return 0 // counter 翻转
  const dt = (currTs - prevTs) / 1000
  if (dt <= 0) return 0
  return Math.max(0, (curr - prev) / dt)
}
```

### 4. 实时快照缓存

```ts
const snapshotCache = new Map<number, { data: DeviceSnapshot; ts: number }>()
// TTL 60s（与轮询间隔一致）
```

## 采集流程（server/librenms.ts + server/deviceMonitor.ts）

### MySQL 客户端（librenms.ts）

```ts
// 连接池：mysql2/promise，懒创建（仅在存在启用监控设备时）
import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null
function getPool(): mysql.Pool {
  if (!pool) {
    const cfg = getLibrenmsDbConfig()
    pool = mysql.createPool({
      host: cfg.host, port: cfg.port, user: cfg.user,
      password: cfg.pass, database: cfg.name,
      connectionLimit: 2,           // 只读轮询，2 足够
      connectTimeout: 5000,
      charset: 'utf8mb4',
    })
  }
  return pool
}

async function query<T>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params)
  return rows as T[]
}
```

- **CPU**：`SELECT processor_usage, processor_descr FROM processors p JOIN devices d ON d.device_id=p.device_id WHERE d.hostname=?`
- **内存**：`SELECT mempool_used, mempool_total, mempool_perc FROM mempools m JOIN devices d ON d.device_id=m.device_id WHERE d.hostname=?`
- **温度**：`SELECT sensor_current, sensor_descr FROM sensors s JOIN devices d ON d.device_id=s.device_id WHERE d.hostname=? AND s.sensor_class='temperature'`
- **端口**：`SELECT ifIndex, ifName, ifOperStatus, ifInOctets, ifOutOctets FROM ports p JOIN devices d ON d.device_id=p.device_id WHERE d.hostname=?`
- **存在性**：`SELECT COUNT(*) cnt FROM devices WHERE hostname=?`

### 采集调度器（deviceMonitor.ts）

- node-cron `* * * * *`（每 60s）；复用 `servicesScheduler` 模式。
- `Promise.allSettled` 隔离单设备失败，不阻塞其它设备。
- 端口速率：读取本次 octets → 对比 `octetsBaseline` 上次值算 bps → 更新 baseline。
- 写 `device_monitor_history` + 更新 `snapshotCache`。

### 配置（system_config，沿用 atcom_* 模式）

| key | 默认值 | 说明 |
|-----|--------|------|
| `librenms_db_host` | `10.3.0.141` | MySQL 主机 |
| `librenms_db_port` | `3306` | MySQL 端口 |
| `librenms_db_user` | （空） | 只读账号 |
| `librenms_db_pass` | （空） | 密码（敏感，掩码） |
| `librenms_db_name` | `librenms` | 库名 |

- 未配置 user/pass 时监控功能自动禁用（采集跳过 + snapshot 返回 reason:'disabled'），不依赖 MySQL。
- 与 ATCOM 凭据一致，`db_pass` 走敏感配置掩码（`SENSITIVE_CONFIG_KEYS`）。

### 端点设计

```ts
// GET /api/v1/devices/:id/monitor/snapshot
// 返回：{ code: 200, data: { available, snapshot?, reason? } }
//  - 未启用监控 / 未配置 MySQL → { available: false, reason: 'disabled' }
//  - 缓存无（还没采集到）→ { available: false, reason: 'pending' }
//  - 采集失败 → { available: false, reason: 'unreachable' }
//  - 正常 → { available: true, snapshot: { cpuUsage, memUsage, temperature, ports: [{ name, status, rxBps, txBps }] } }

// GET /api/v1/devices/:id/monitor/history?hours=24
// 返回：{ code: 200, data: { points: [{ collectedAt, cpuUsage, memUsage, temperature }] } }
//  - 从 device_monitor_history 查最近 N 小时，按 collected_at ASC
```

## 前端（DeviceDrawer.vue 新增区块）

在现有静态信息下方新增「实时监控」区块，通过两个新端点拉取：

1. **未启用监控**：显示「未启用实时监控」+「启用监控」开关（调 `PUT /devices/:id` 传 `monitorEnabled`）。
2. **快照卡片**（启用后）：
   - CPU 占用 / 内存占用：`el-progress` 环形进度条
   - 温度：数值 + 颜色阈值（>60°C 黄，>75°C 红）
3. **端口表**：端口名 / 状态（up=绿点 down=红点）/ 接收速率 / 发送速率（Bps 格式化）。
4. **趋势图**：近 24h CPU / 内存 / 温度曲线（SVG 折线，轻量自绘）。
5. **异常态**：
   - `reason: 'pending'` → 「采集进行中…」+ 自动轮询重试
   - `reason: 'disabled'` → 引导启用（或提示未配置 MySQL）
   - `reason: 'unreachable'` → 「监控源不可达」
   - 端口 counter 翻转 → 速率显示 0

前端 `Device` 类型加可选字段 `monitorEnabled?: boolean`；`api/devices.ts` 加 `fetchDeviceSnapshot` / `fetchDeviceHistory` / 更新设备的 `monitorEnabled`。

## 数据保留

每日 03:00 cron 清理 `device_monitor_history` 30 天前数据（复用 `index.ts` 现有 `service_health_logs` 清理模式）。

## 验收标准

1. 设备详情抽屉能显示启用监控设备的 CPU/内存/温度/端口实时状态（缓存 <60s）。
2. 近 24h CPU/内存/温度趋势图可看。
3. 未启用/未配置 MySQL/采集失败 三类异常态正确显示。
4. 端口速率基于两次采样差值计算，counter 翻转安全。
5. 后台轮询不阻塞任何 API（异步 + allSettled），单设备失败不影响其它。
6. 类型检查 `typecheck:server` / `typecheck:client` 通过。
7. 无启用监控设备或未配置 MySQL 时不依赖外部，服务正常启动。

## 范围外（不在此计划内）

- 端口逐端口历史趋势（仅存最新快照）。
- 多采集源抽象（目前仅 LibreNMS）。
- 告警（温度/端口 down 触发通知）——当前日志监控模块已有告警机制，可复用但另立项。
- LibreNMS MySQL 历史数据直接读取（RRD/历史表）——趋势图数据全部由 OpsHub 自存累积。
