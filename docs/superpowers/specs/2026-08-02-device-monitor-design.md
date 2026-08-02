# 设备实时监控数据接入设计（LibreNMS）

- 日期：2026-08-02
- 范围：数据中心管理 → 设备详情抽屉 增加 CPU/内存/温度/端口状态/端口速率 实时监控

## 背景与目标

数据中心管理（`DevicesView.vue`）的设备详情抽屉（`DeviceDrawer.vue`）目前只展示静态资产信息（型号、厂商、IP、U 高度、端口数、状态），无任何实时状态。

目标：将 LibreNMS（10.3.0.141）API 提供的设备实时状态接入设备详情，展示 **CPU、内存、温度、端口状态、端口速率**，并提供历史趋势图。

## 需求确认（用户已确认）

| 决策点 | 选择 |
|--------|------|
| 数据来源 | LibreNMS API（已有外部系统，`X-Auth-Token` 认证） |
| 获取方式 | 后台定时轮询 + 缓存 |
| 历史趋势 | 实时值 + 历史趋势图 |
| 设备关联 | 用 IP 自动匹配（`devices.ip` ↔ LibreNMS hostname） |
| 历史数据来源 | OpsHub 自存历史（定时存 SQLite） |
| 采集范围 | 仅轮询「启用监控」的设备 |
| 展示位置 | 设备详情抽屉（DeviceDrawer.vue） |
| 数据内容 | CPU、内存、温度、端口状态、端口速率 |

## 关键约束（LibreNMS 能力调查）

- **实时状态 JSON 可拿**：
  - `GET /api/v0/devices/{host}/health` → CPU/内存/温度当前值（JSON）
  - `GET /api/v0/devices/{host}/ports` → 端口状态/速率（JSON）
  - 认证：Header `X-Auth-Token: <token>`
- **历史数据 API 不能直接返回 JSON**（`/graphs/health` 返回 SVG 图），历史存在 RRD 文件中 → OpsHub 自建历史表，定时轮询存点。
- 默认采集间隔 **60 秒**；历史保留 **30 天**；端口数据存**快照 JSON**（最新一份，不做逐端口历史）。

## 架构

```
LibreNMS API (10.3.0.141)
   ↑ X-Auth-Token 认证，5s 超时
   └── server/deviceMonitor.ts（新增）：采集调度器
         ├─ 每 60s 轮询 monitor_enabled=1 且 ip 非空的设备
         ├─ GET /devices/{ip}/health  → CPU/内存/温度 当前值
         ├─ GET /devices/{ip}/ports   → 端口状态/速率
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

### 3. 内存缓存

```ts
// 每个启用监控的设备一份，缓存 60s（与轮询间隔一致）
const snapshotCache = new Map<number, {
  data: DeviceSnapshot
  ts: number
}>()
```

## 采集流程（server/deviceMonitor.ts）

```ts
// 调度器：复用 node-cron（index.ts 已有 node-cron 依赖 + 启动/停止模式）
// 采集间隔 60s；单设备失败用 Promise.allSettled 隔离，不阻塞其它设备

async function collectDevice(device: { id: number; ip: string }) {
  const [health, ports] = await Promise.all([
    librenmsGet(`/devices/${device.ip}/health`),
    librenmsGet(`/devices/${device.ip}/ports`),
  ])
  // 解析 → 组装 DeviceSnapshot
  // 写 device_monitor_history 一行（ports 存 JSON）
  // 更新 snapshotCache
}

export function startDeviceMonitor() { /* cron.schedule('* * * * *', tick) 或 60s setInterval */ }
export function stopDeviceMonitor() { /* 清缓存、停调度 */ }
export function getDeviceSnapshot(id: number): DeviceSnapshot | null
```

- 认证：从 `system_config`（沿用 `atcom_*` 模式）或 `.env` 读 `librenms_base_url` + `librenms_api_token`。
- 每次请求 5s 超时；失败静默记录（`console.warn`），不中断其它设备。
- 与 `index.ts` 的启动校验对齐：`NODE_ENV=production` 且未配置 `librenms_api_token` 时，打印警告但**不拒绝启动**（无监控设备时不依赖）。

### 端点设计

```ts
// GET /api/v1/devices/:id/monitor/snapshot
// 返回：{ code: 200, data: { available, snapshot?, reason? } }
//  - 设备未启用监控 → { available: false, reason: 'disabled' }
//  - 缓存无（还没采集到）→ { available: false, reason: 'pending' }
//  - LibreNMS 查不到该 IP → { available: false, reason: 'not-found' }
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
4. **趋势图**：近 24h CPU / 内存 / 温度曲线，复用现有 `TrendChart.vue` 或新建轻量图。
5. **异常态**：
   - `available: false, reason: 'pending'` → 「采集进行中…」+ 自动轮询重试（几秒后重拉）
   - `reason: 'not-found'` → 「未在 LibreNMS 找到该设备」
   - `reason: 'disabled'` → 引导启用
   - LibreNMS 不可达 → 「监控源不可达」

前端 `Device` 类型加可选字段 `monitorEnabled?: boolean`；`api/devices.ts` 加 `fetchDeviceSnapshot` / `fetchDeviceHistory` / 更新设备的 `monitorEnabled`。

## 数据保留

每日 03:00 cron 清理 `device_monitor_history` 30 天前数据（复用 `index.ts` 现有 `service_health_logs` 清理模式）。

## 验收标准

1. 设备详情抽屉能显示启用监控设备的 CPU/内存/温度/端口实时状态（缓存 <60s）。
2. 近 24h CPU/内存/温度趋势图可看。
3. 未启用/未匹配/监控源不可达 三类异常态正确显示。
4. 后台轮询不阻塞任何 API（异步 + allSettled），单设备失败不影响其它。
5. 类型检查 `typecheck:server` / `typecheck:client` 通过。
6. 无启用监控设备时不依赖 LibreNMS 配置，服务正常启动。

## 范围外（不在此计划内）

- 端口逐端口历史趋势（仅存最新快照）。
- 多采集源抽象（目前仅 LibreNMS）。
- 告警（温度/端口 down 触发通知）——当前日志监控模块已有告警机制，可复用但另立项。
