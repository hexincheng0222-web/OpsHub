# 设备实时监控（LibreNMS MySQL 直连）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 LibreNMS 监控的实时状态（CPU/内存/温度/端口状态/端口速率）接入数据中心管理的设备详情抽屉，提供实时快照与历史趋势图。

**架构：** 采集走 **LibreNMS MySQL 直连**（API 不提供实时值 JSON）。后端新增 `server/librenms.ts`（MySQL 查询客户端）+ `server/deviceMonitor.ts`（60s 轮询调度器，写 `device_monitor_history` 表 + 内存缓存 + 端口速率差值计算）；`devices.ts` 新增 snapshot/history 两个端点；`DeviceDrawer.vue` 新增「实时监控」区块。

**技术栈：** Express 5 + better-sqlite3（WAL）+ mysql2、node-cron、Vue 3 + Element Plus。

**前置条件：** 设计文档 `docs/superpowers/specs/2026-08-02-device-monitor-design.md`（已批准，MySQL 直连版）。

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `package.json` | 新增 `mysql2` 依赖 |
| 修改 | `server/db.ts` | `devices` 表加 `monitor_enabled` 列；新增 `device_monitor_history` 表；LibreNMS MySQL 配置初始化 |
| 创建 | `server/librenms.ts` | LibreNMS MySQL 查询客户端：连接池、CPU/内存/温度/端口查询、存在性检查、配置读取 |
| 创建 | `server/deviceMonitor.ts` | 采集调度器：60s 轮询、端口速率差值、历史落库、内存缓存、start/stop/getSnapshot |
| 修改 | `server/index.ts` | 启动/停止采集调度器（对齐现有 servicesScheduler 模式） |
| 修改 | `server/routes/devices.ts` | 新增 `GET /:id/monitor/snapshot` + `GET /:id/monitor/history`；`PUT /:id` 支持 `monitorEnabled` |
| 修改 | `src/types/index.ts` | `Device` 加 `monitorEnabled?: boolean` |
| 修改 | `src/api/devices.ts` | 新增 `fetchDeviceSnapshot` / `fetchDeviceHistory` |
| 创建 | `src/components/devices/MonitorSection.vue` | 监控区块子组件：仪表 + 端口表 + 趋势图 + 异常态 |
| 创建 | `src/components/devices/MonitorTrend.vue` | 监控趋势折线图组件 |
| 修改 | `src/components/devices/DeviceDrawer.vue` | 集成「实时监控」区块 |
| 修改 | `.env.example` | LibreNMS MySQL 配置示例 |

---

### 任务 1：安装 mysql2 + 数据库迁移

**文件：**
- 修改：`package.json`
- 修改：`server/db.ts`

- [ ] **步骤 1：安装 mysql2**

运行：`npm install mysql2`
预期：`package.json` dependencies 出现 `"mysql2": "^3.x"`，`package-lock.json` 更新

- [ ] **步骤 2：加 `monitor_enabled` 列迁移**

在 `server/db.ts` 的软删除迁移块（约 L434-437 附近）追加：

```ts
// 设备监控启用标记（LibreNMS 采集开关）
try { db.prepare('ALTER TABLE devices ADD COLUMN monitor_enabled INTEGER NOT NULL DEFAULT 0').run() } catch {}
```

- [ ] **步骤 3：加 `device_monitor_history` 表**

在 `server/db.ts` 末尾（`export default db` 之前）追加：

```ts
// 设备监控历史（LibreNMS MySQL 轮询自存，供趋势图查询）
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_monitor_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id    INTEGER NOT NULL,
      cpu_usage    REAL,
      mem_used_mb  REAL,
      mem_total_mb REAL,
      mem_usage    REAL,
      temperature  REAL,
      ports_json   TEXT,
      collected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_dmh_device_time ON device_monitor_history (device_id, collected_at DESC);
  `)
} catch (e: any) { console.warn('[db] device_monitor_history 建表失败:', e.message) }
```

- [ ] **步骤 4：LibreNMS MySQL 配置默认值**

在 `server/db.ts` 的 ATCOM 配置初始化块（L1368-1375）后追加：

```ts
// LibreNMS 设备监控配置（可选，未配置账号时监控功能自动禁用）
const lnDbCount = db.prepare("SELECT COUNT(*) as cnt FROM system_config WHERE key LIKE 'librenms_db_%'").get() as { cnt: number }
if (lnDbCount.cnt === 0) {
  const insertLNDb = db.prepare("INSERT OR IGNORE INTO system_config (key, value, description) VALUES (?, ?, ?)")
  insertLNDb.run('librenms_db_host', '10.3.0.141', 'LibreNMS MySQL 主机')
  insertLNDb.run('librenms_db_port', '3306', 'LibreNMS MySQL 端口')
  insertLNDb.run('librenms_db_user', '', 'LibreNMS MySQL 只读账号')
  insertLNDb.run('librenms_db_pass', '', 'LibreNMS MySQL 密码（敏感，掩码）')
  insertLNDb.run('librenms_db_name', 'librenms', 'LibreNMS MySQL 库名')
  console.log('[db] 已初始化 LibreNMS MySQL 监控配置')
}
```

- [ ] **步骤 5：验证启动**

运行：`node --import tsx -e "import db from './server/db.ts'; const c = db.prepare('PRAGMA table_info(devices)').all().some(x=>x.name==='monitor_enabled'); const t = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='device_monitor_history'\").get(); const k = db.prepare(\"SELECT COUNT(*) cnt FROM system_config WHERE key LIKE 'librenms_db_%'\").get(); console.log('monitor_enabled:', c, '| history table:', !!t, '| ln configs:', k.cnt)" 2>&1 | grep -E "monitor_enabled"
预期：`monitor_enabled: true | history table: true | ln configs: 5`

- [ ] **步骤 6：Commit**

```bash
git add package.json package-lock.json server/db.ts
git commit -m "feat(monitor): mysql2 依赖 + devices.monitor_enabled + device_monitor_history 表 + LibreNMS 配置"
```

---

### 任务 2：LibreNMS MySQL 查询客户端

**文件：**
- 创建：`server/librenms.ts`

- [ ] **步骤 1：创建客户端**

```ts
// server/librenms.ts — LibreNMS MySQL 查询客户端（只读）
import mysql from 'mysql2/promise'
import db from './db'

export interface LibrenmsDbConfig {
  host: string
  port: number
  user: string
  pass: string
  name: string
}

export function getLibrenmsDbConfig(): LibrenmsDbConfig {
  const rows = db.prepare("SELECT key, value FROM system_config WHERE key IN ('librenms_db_host','librenms_db_port','librenms_db_user','librenms_db_pass','librenms_db_name')").all() as { key: string; value: string }[]
  const map: Record<string, string> = {}
  rows.forEach(r => { map[r.key] = r.value })
  return {
    host: map['librenms_db_host'] || process.env.LIBRENMS_DB_HOST || '10.3.0.141',
    port: parseInt(map['librenms_db_port'] || process.env.LIBRENMS_DB_PORT || '3306', 10) || 3306,
    user: map['librenms_db_user'] || process.env.LIBRENMS_DB_USER || '',
    pass: map['librenms_db_pass'] || process.env.LIBRENMS_DB_PASS || '',
    name: map['librenms_db_name'] || process.env.LIBRENMS_DB_NAME || 'librenms',
  }
}

/** 是否已配置 MySQL 账号（未配置则监控功能禁用） */
export function librenmsReady(): boolean {
  const cfg = getLibrenmsDbConfig()
  return !!(cfg.user && cfg.pass)
}

let pool: mysql.Pool | null = null
function getPool(): mysql.Pool {
  if (!pool) {
    const cfg = getLibrenmsDbConfig()
    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.pass,
      database: cfg.name,
      connectionLimit: 2,
      connectTimeout: 5000,
      charset: 'utf8mb4',
    })
  }
  return pool
}

/** 重置连接池（配置变更后调用） */
export function resetLibrenmsPool(): void {
  if (pool) { pool.end().catch(() => {}); pool = null }
}

async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params)
  return rows as T[]
}

export interface HealthData {
  cpuUsage: number | null
  memUsage: number | null
  memUsedMb: number | null
  memTotalMb: number | null
  temperature: number | null
}

export interface PortData {
  ifIndex: number
  name: string
  status: 'up' | 'down'
  ifInOctets: number
  ifOutOctets: number
}

export interface DeviceSnapshot {
  cpuUsage: number | null
  memUsage: number | null
  memUsedMb: number | null
  memTotalMb: number | null
  temperature: number | null
  ports: Array<Omit<PortData, 'ifInOctets' | 'ifOutOctets'> & { rxBps: number; txBps: number }>
  collectedAt: string
}

/** 查询单个设备的实时健康值（CPU/内存/温度） */
export async function fetchHealth(host: string): Promise<HealthData> {
  const procs = await query<{ processor_usage: number | null }>(
    `SELECT p.processor_usage FROM processors p
     JOIN devices d ON d.device_id = p.device_id WHERE d.hostname = ?`,
    [host]
  )
  const mems = await query<{ mempool_used: number | null; mempool_total: number | null; mempool_perc: number | null }>(
    `SELECT m.mempool_used, m.mempool_total, m.mempool_perc FROM mempools m
     JOIN devices d ON d.device_id = m.device_id WHERE d.hostname = ?`,
    [host]
  )
  const temps = await query<{ sensor_current: number | null }>(
    `SELECT s.sensor_current FROM sensors s
     JOIN devices d ON d.device_id = s.device_id
     WHERE d.hostname = ? AND s.sensor_class = 'temperature'`,
    [host]
  )

  // CPU：多个 processor 取平均
  const cpuVals = procs.map(p => p.processor_usage).filter((v): v is number => v != null)
  const cpuUsage = cpuVals.length ? Math.round(cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length * 10) / 10 : null

  // 内存：取第一个 mempool
  let memUsage: number | null = null, memUsedMb: number | null = null, memTotalMb: number | null = null
  if (mems.length) {
    const m = mems[0]
    memUsedMb = m.mempool_used != null ? Math.round(m.mempool_used / 1048576 * 10) / 10 : null  // 字节→MB
    memTotalMb = m.mempool_total != null ? Math.round(m.mempool_total / 1048576 * 10) / 10 : null
    if (m.mempool_perc != null) memUsage = m.mempool_perc
    else if (memUsedMb != null && memTotalMb && memTotalMb > 0) memUsage = Math.round(memUsedMb / memTotalMb * 1000) / 10
  }

  // 温度：取第一个 temperature sensor
  const tempVals = temps.map(t => t.sensor_current).filter((v): v is number => v != null)
  const temperature = tempVals.length ? tempVals[0] : null

  return { cpuUsage, memUsage, memUsedMb, memTotalMb, temperature }
}

/** 查询单个设备的端口状态 + 累计 octets（counter） */
export async function fetchPorts(host: string): Promise<PortData[]> {
  const rows = await query<{ ifIndex: number; ifName: string; ifOperStatus: string; ifInOctets: number | null; ifOutOctets: number | null }>(
    `SELECT p.ifIndex, p.ifName, p.ifOperStatus, p.ifInOctets, p.ifOutOctets FROM ports p
     JOIN devices d ON d.device_id = p.device_id WHERE d.hostname = ? ORDER BY p.ifIndex ASC`,
    [host]
  )
  return rows.map(r => ({
    ifIndex: r.ifIndex,
    name: r.ifName || `if${r.ifIndex}`,
    status: r.ifOperStatus === 'up' ? 'up' as const : 'down' as const,
    ifInOctets: r.ifInOctets ?? 0,
    ifOutOctets: r.ifOutOctets ?? 0,
  }))
}

/** 探测某 IP 是否在 LibreNMS 中存在 */
export async function checkDeviceExists(host: string): Promise<boolean> {
  const rows = await query<{ cnt: number }>('SELECT COUNT(*) cnt FROM devices WHERE hostname = ?', [host])
  return rows.length > 0 && rows[0].cnt > 0
}

/** 关闭连接池（优雅关闭时调用） */
export async function closeLibrenms(): Promise<void> {
  if (pool) { await pool.end().catch(() => {}); pool = null }
}
```

- [ ] **步骤 2：类型检查**

运行：`npm run typecheck:server`
预期：PASS（无错误）

- [ ] **步骤 3：Commit**

```bash
git add server/librenms.ts
git commit -m "feat(monitor): LibreNMS MySQL 查询客户端（health/ports/存在性）"
```

---

### 任务 3：采集调度器

**文件：**
- 创建：`server/deviceMonitor.ts`

- [ ] **步骤 1：创建调度器**

```ts
// server/deviceMonitor.ts — 设备监控采集调度器（LibreNMS MySQL 轮询）
import cron from 'node-cron'
import db from './db'
import { fetchHealth, fetchPorts, librenmsReady, DeviceSnapshot } from './librenms'

// 内存缓存：实时快照（与轮询间隔一致，60s 过期）
const snapshotCache = new Map<number, { data: DeviceSnapshot; ts: number }>()
const CACHE_TTL_MS = 60_000

// 端口速率计算基线：device_id -> Map<ifIndex, { in: number; out: number; ts: number }>
const octetsBaseline = new Map<number, Map<number, { in: number; out: number; ts: number }>>()

let cronTask: ReturnType<typeof cron.schedule> | null = null
let lastRun: Date | null = null

export function startDeviceMonitor(): void {
  if (cronTask) return
  cronTask = cron.schedule('* * * * *', async () => { await runCollect() })
}

export function stopDeviceMonitor(): void { if (cronTask) { cronTask.stop(); cronTask = null } }

export function getSchedulerStatus() { return { running: !!cronTask, lastRun } }

/** 立即执行一次采集（启动预热 / 手动触发） */
export async function runCollect(): Promise<void> {
  lastRun = new Date()
  if (!librenmsReady()) return  // 未配置 MySQL，静默跳过

  const devices = db.prepare("SELECT id, ip FROM devices WHERE monitor_enabled = 1 AND ip IS NOT NULL AND ip != ''").all() as { id: number; ip: string }[]
  if (!devices.length) return

  const insert = db.prepare(
    `INSERT INTO device_monitor_history (device_id, cpu_usage, mem_used_mb, mem_total_mb, mem_usage, temperature, ports_json, collected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )

  const results = await Promise.allSettled(devices.map(async (d) => {
    try {
      const [health, ports] = await Promise.all([fetchHealth(d.ip), fetchPorts(d.ip)])
      const now = Date.now()
      const base = octetsBaseline.get(d.id) || new Map<number, { in: number; out: number; ts: number }>()

      const enriched = ports.map((p) => {
        const prev = base.get(p.ifIndex)
        let rxBps = 0, txBps = 0
        if (prev) {
          rxBps = calcRate(prev.in, p.ifInOctets, prev.ts, now)
          txBps = calcRate(prev.out, p.ifOutOctets, prev.ts, now)
        }
        base.set(p.ifIndex, { in: p.ifInOctets, out: p.ifOutOctets, ts: now })
        return { ifIndex: p.ifIndex, name: p.name, status: p.status, rxBps, txBps }
      })
      octetsBaseline.set(d.id, base)

      const snap: DeviceSnapshot = {
        cpuUsage: health.cpuUsage,
        memUsage: health.memUsage,
        memUsedMb: health.memUsedMb,
        memTotalMb: health.memTotalMb,
        temperature: health.temperature,
        ports: enriched,
        collectedAt: new Date().toISOString(),
      }

      insert.run(d.id, snap.cpuUsage, snap.memUsedMb, snap.memTotalMb, snap.memUsage, snap.temperature, JSON.stringify(snap.ports))
      snapshotCache.set(d.id, { data: snap, ts: Date.now() })
    } catch (e: any) {
      console.warn(`[device-monitor] 设备 ${d.ip} 采集失败: ${e.message}`)
      // 失败不清空旧缓存，保留上次数据
    }
  }))

  const ok = results.filter(r => r.status === 'fulfilled').length
  console.log(`[device-monitor] 采集完成 ok=${ok}/${devices.length}`)
}

/** 端口速率计算（counter 差值，秒为单位） */
function calcRate(prev: number, curr: number, prevTs: number, currTs: number): number {
  if (curr < prev) return 0  // counter 翻转
  const dt = (currTs - prevTs) / 1000
  if (dt <= 0) return 0
  return Math.max(0, Math.round((curr - prev) / dt))
}

/** 读缓存快照；无缓存或过期返回 null */
export function getDeviceSnapshot(id: number): DeviceSnapshot | null {
  const hit = snapshotCache.get(id)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data
  return null
}
```

- [ ] **步骤 2：类型检查**

运行：`npm run typecheck:server`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add server/deviceMonitor.ts
git commit -m "feat(monitor): 设备监控采集调度器（60s 轮询+端口速率差值+缓存+历史落库）"
```

---

### 任务 4：接入 index.ts 调度

**文件：**
- 修改：`server/index.ts`

- [ ] **步骤 1：导入并启停**

在 `server/index.ts` 导入区（servicesScheduler 旁）加：

```ts
import { startDeviceMonitor, stopDeviceMonitor } from './deviceMonitor'
import { closeLibrenms } from './librenms'
```

在优雅关闭的 `stopServicesScheduler()` 调用后加：

```ts
try { stopDeviceMonitor() } catch { /* ignore */ }
```

在优雅关闭的 `db.close()` 调用后加：

```ts
try { await closeLibrenms() } catch { /* ignore */ }
```

在底部启动区（`startServicesScheduler(...)` 附近）加：

```ts
// 设备监控采集调度器：生产模式或显式开启时启动
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SVC_CRON === '1') {
  startDeviceMonitor()
}
```

- [ ] **步骤 2：类型检查**

运行：`npm run typecheck:server`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add server/index.ts
git commit -m "feat(monitor): 启动/停止设备监控调度器 + 关闭 MySQL 连接池"
```

---

### 任务 5：devices 路由新增端点

**文件：**
- 修改：`server/routes/devices.ts`

- [ ] **步骤 1：导入监控模块**

在 `server/routes/devices.ts` 顶部加：

```ts
import { getDeviceSnapshot } from '../deviceMonitor'
import { librenmsReady } from '../librenms'
```

（`db` 已在文件内导入）

- [ ] **步骤 2：`PUT /:id` 支持 `monitorEnabled`**

在现有 `PUT /:id` 的 `const { name, type, model, ports, status, ip } = req.body` 后加 `monitorEnabled`：

```ts
const { name, type, model, ports, status, ip, monitorEnabled } = req.body
```

UPDATE 语句改为：

```ts
db.prepare(`
  UPDATE devices SET name = ?, type = ?, model = ?, ports = ?, status = ?, ip = ?, monitor_enabled = ?, updated_at = datetime('now')
  WHERE id = ?
`).run(
  name || (existing as any).name,
  type || (existing as any).type,
  model || (existing as any).model,
  ports !== undefined ? ports : (existing as any).ports,
  status || (existing as any).status,
  ip !== undefined ? ip : (existing as any).ip,
  monitorEnabled !== undefined ? (monitorEnabled ? 1 : 0) : (existing as any).monitor_enabled,
  id
)
```

- [ ] **步骤 3：新增 `GET /:id/monitor/snapshot`**

在 `router.delete('/:id', ...)` 之后、`export default router` 之前加：

```ts
// GET /api/v1/devices/:id/monitor/snapshot — 实时快照（读缓存）
router.get('/:id/monitor/snapshot', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })
  const row = db.prepare('SELECT id, ip, monitor_enabled FROM devices WHERE id = ?').get(id) as any
  if (!row) return res.status(404).json({ code: 404, message: '设备不存在' })
  if (!row.monitor_enabled) return res.json({ code: 200, data: { available: false, reason: 'disabled' } })
  if (!librenmsReady()) return res.json({ code: 200, data: { available: false, reason: 'disabled' } })

  const snap = getDeviceSnapshot(id)
  if (!snap) return res.json({ code: 200, data: { available: false, reason: 'pending' } })
  res.json({ code: 200, data: { available: true, snapshot: snap } })
})
```

- [ ] **步骤 4：新增 `GET /:id/monitor/history`**

同文件，snapshot 之后加：

```ts
// GET /api/v1/devices/:id/monitor/history?hours=24 — 历史趋势（查表）
router.get('/:id/monitor/history', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })
  const hours = Math.min(168, Math.max(1, parseInt(req.query.hours as string) || 24))
  const rows = db.prepare(
    `SELECT collected_at, cpu_usage, mem_usage, temperature FROM device_monitor_history
     WHERE device_id = ? AND collected_at >= datetime('now', ?)
     ORDER BY collected_at ASC`
  ).all(id, `-${hours} hours`) as any[]
  res.json({
    code: 200,
    data: {
      points: rows.map((r) => ({
        collectedAt: r.collected_at,
        cpuUsage: r.cpu_usage,
        memUsage: r.mem_usage,
        temperature: r.temperature,
      })),
    },
  })
})
```

- [ ] **步骤 5：类型检查**

运行：`npm run typecheck:server`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add server/routes/devices.ts
git commit -m "feat(monitor): devices 新增 snapshot/history 端点 + 支持 monitorEnabled"
```

---

### 任务 6：前端类型与 API

**文件：**
- 修改：`src/types/index.ts`
- 修改：`src/api/devices.ts`

- [ ] **步骤 1：`Device` 加 `monitorEnabled`**

`src/types/index.ts` 的 `Device` 接口加：

```ts
  monitorEnabled?: boolean
```

- [ ] **步骤 2：`api/devices.ts` 加函数**

`src/api/devices.ts` 末尾加：

```ts
export interface DeviceSnapshot {
  cpuUsage: number | null
  memUsage: number | null
  memUsedMb: number | null
  memTotalMb: number | null
  temperature: number | null
  ports: { name: string; status: 'up' | 'down'; rxBps: number; txBps: number }[]
  collectedAt: string
}

export interface MonitorSnapshotResult {
  available: boolean
  reason?: 'disabled' | 'pending' | 'unreachable'
  snapshot?: DeviceSnapshot
}

export async function fetchDeviceSnapshot(id: number): Promise<MonitorSnapshotResult> {
  return request(`${BASE_DEVICES}/${id}/monitor/snapshot`)
}

export async function fetchDeviceHistory(id: number, hours = 24): Promise<{ points: { collectedAt: string; cpuUsage: number | null; memUsage: number | null; temperature: number | null }[] }> {
  return request(`${BASE_DEVICES}/${id}/monitor/history?hours=${hours}`)
}
```

- [ ] **步骤 3：类型检查**

运行：`npm run typecheck:client`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/types/index.ts src/api/devices.ts
git commit -m "feat(monitor): 前端类型与 API（snapshot/history）"
```

---

### 任务 7：MonitorSection 组件

**文件：**
- 创建：`src/components/devices/MonitorSection.vue`

- [ ] **步骤 1：创建组件**

```vue
<template>
  <div class="monitor-section">
    <div class="monitor-header">
      <span class="monitor-title">实时监控</span>
      <el-switch
        v-if="!enabled"
        v-model="pendingEnable"
        active-text="启用监控"
        @change="onEnableChange"
      />
    </div>

    <!-- 未启用 -->
    <div v-if="!enabled && !pendingEnable" class="monitor-empty">
      未启用实时监控。开启后 OpsHub 将每 60 秒从 LibreNMS 采集该设备的 CPU/内存/温度/端口状态。
    </div>

    <!-- 启用后状态 -->
    <template v-else-if="enabled">
      <div v-if="loading" class="monitor-empty">采集进行中…</div>
      <div v-else-if="!available" class="monitor-empty">{{ reasonText }}</div>
      <template v-else-if="snapshot">
        <div class="monitor-gauges">
          <div class="gauge-item">
            <el-progress type="dashboard" :percentage="snapshot.cpuUsage ?? 0" :width="72" :stroke-width="8" />
            <span class="gauge-label">CPU</span>
            <span class="gauge-value">{{ snapshot.cpuUsage == null ? '—' : snapshot.cpuUsage + '%' }}</span>
          </div>
          <div class="gauge-item">
            <el-progress type="dashboard" :percentage="snapshot.memUsage ?? 0" :width="72" :stroke-width="8" />
            <span class="gauge-label">内存</span>
            <span class="gauge-value">{{ snapshot.memUsage == null ? '—' : snapshot.memUsage + '%' }}</span>
          </div>
          <div class="gauge-item">
            <span class="gauge-temp" :class="tempClass">{{ snapshot.temperature == null ? '—' : snapshot.temperature + '°C' }}</span>
            <span class="gauge-label">温度</span>
          </div>
        </div>

        <el-table :data="snapshot.ports" size="small" max-height="240" class="monitor-ports">
          <el-table-column prop="name" label="端口" min-width="80" />
          <el-table-column label="状态" width="60">
            <template #default="{ row }">
              <span class="port-dot" :class="row.status" :title="row.status === 'up' ? 'up' : 'down'" />
            </template>
          </el-table-column>
          <el-table-column label="接收" width="90">
            <template #default="{ row }">{{ formatBps(row.rxBps) }}</template>
          </el-table-column>
          <el-table-column label="发送" width="90">
            <template #default="{ row }">{{ formatBps(row.txBps) }}</template>
          </el-table-column>
        </el-table>

        <div class="monitor-history-title">近 24 小时趋势</div>
        <MonitorTrend :points="history" />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchDeviceSnapshot, fetchDeviceHistory, type DeviceSnapshot } from '../../api/devices'
import MonitorTrend from './MonitorTrend.vue'

const props = defineProps<{ deviceId: number; enabled: boolean }>()
const emit = defineEmits<{ enable: [value: boolean] }>()

const pendingEnable = ref(false)
const loading = ref(false)
const available = ref(false)
const snapshot = ref<DeviceSnapshot | null>(null)
const history = ref<{ collectedAt: string; cpuUsage: number | null; memUsage: number | null; temperature: number | null }[]>([])
const reason = ref('')

const reasonText = computed(() => {
  if (reason.value === 'pending') return '采集进行中，请稍候…'
  if (reason.value === 'unreachable') return '监控源不可达'
  return '未启用监控或未配置 LibreNMS 采集源'
})
const tempClass = computed(() => {
  const t = snapshot.value?.temperature
  if (t == null) return ''
  if (t >= 75) return 'temp-red'
  if (t >= 60) return 'temp-yellow'
  return 'temp-green'
})

function formatBps(v: number): string {
  if (!v) return '0'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let i = 0; let n = v
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

async function loadSnapshot() {
  loading.value = true
  try {
    const res = await fetchDeviceSnapshot(props.deviceId)
    available.value = res.available
    if (res.available && res.snapshot) snapshot.value = res.snapshot
    else reason.value = res.reason || ''
    if (res.available) { const h = await fetchDeviceHistory(props.deviceId, 24); history.value = h.points }
  } catch (e: any) {
    available.value = false
    reason.value = 'unreachable'
    ElMessage.error(e.message || '获取监控数据失败')
  } finally { loading.value = false }
}

function onEnableChange(v: boolean) { emit('enable', v) }

watch(() => props.enabled, (v) => { if (v) loadSnapshot() }, { immediate: true })

defineExpose({ refresh: loadSnapshot })
</script>

<style scoped>
.monitor-section { border-top: 1px solid var(--dv-header-border); margin-top: 16px; padding-top: 16px; }
.monitor-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.monitor-title { font-size: 13px; font-weight: 600; color: var(--dv-light-text); }
.monitor-empty { font-size: 12px; color: var(--dv-light-dim); line-height: 1.6; padding: 12px 0; }
.monitor-gauges { display: flex; gap: 24px; justify-content: space-around; margin: 12px 0; }
.gauge-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.gauge-label { font-size: 11px; color: var(--dv-light-dim); }
.gauge-value { font-size: 12px; color: var(--dv-light-muted); }
.gauge-temp { font-size: 18px; font-weight: 700; }
.temp-green { color: #3fb950; }
.temp-yellow { color: #d29922; }
.temp-red { color: #f85149; }
.port-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.port-dot.up { background: #3fb950; }
.port-dot.down { background: #f85149; }
.monitor-ports { margin: 8px 0; }
.monitor-history-title { font-size: 12px; color: var(--dv-light-dim); margin: 12px 0 4px; }
</style>
```

- [ ] **步骤 2：类型检查**

运行：`npm run typecheck:client`
预期：PASS（MonitorTrend 组件尚不存在会报错——任务 8 创建后通过）

- [ ] **步骤 3：Commit**

```bash
git add src/components/devices/MonitorSection.vue
git commit -m "feat(monitor): 设备监控区块组件（仪表+端口表+异常态）"
```

---

### 任务 8：MonitorTrend 趋势图组件

**文件：**
- 创建：`src/components/devices/MonitorTrend.vue`

- [ ] **步骤 1：创建组件（轻量 SVG 折线）**

```vue
<template>
  <div class="monitor-trend">
    <div v-if="!points.length" class="trend-empty">暂无历史数据</div>
    <svg v-else :viewBox="`0 0 ${W} ${H}`" class="trend-svg">
      <line v-for="i in 4" :key="'g'+i" :x1="0" :x2="W" :y1="H/4*i" :y2="H/4*i" class="grid-line" />
      <polyline v-if="cpuLine" :points="cpuLine" class="line line-cpu" />
      <polyline v-if="memLine" :points="memLine" class="line line-mem" />
      <polyline v-if="tempLine" :points="tempLine" class="line line-temp" />
    </svg>
    <div v-if="points.length" class="trend-legend">
      <span class="legend-cpu">■ CPU</span>
      <span class="legend-mem">■ 内存</span>
      <span class="legend-temp">■ 温度(×10°C)</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TrendPoint { collectedAt: string; cpuUsage: number | null; memUsage: number | null; temperature: number | null }
const props = defineProps<{ points: TrendPoint[] }>()

const W = 300
const H = 80

function normalize(values: (number | null)[], scale = 100): string {
  const valid = values.filter((v): v is number => v != null)
  if (!valid.length) return ''
  const max = Math.max(...valid, 1)
  return values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * W
    const y = v == null ? H : H - (v / max * scale) * (H / scale)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

const cpuLine = computed(() => normalize(props.points.map(p => p.cpuUsage)))
const memLine = computed(() => normalize(props.points.map(p => p.memUsage)))
const tempLine = computed(() => normalize(props.points.map(p => p.temperature == null ? null : p.temperature * 10), 1000))
</script>

<style scoped>
.monitor-trend { margin-top: 4px; }
.trend-empty { text-align: center; color: var(--dv-light-dim); font-size: 12px; padding: 16px 0; }
.trend-svg { width: 100%; height: auto; }
.grid-line { stroke: var(--dv-header-border); stroke-width: 0.5; }
.line { fill: none; stroke-width: 1.5; }
.line-cpu { stroke: #58a6ff; }
.line-mem { stroke: #3fb950; }
.line-temp { stroke: #d29922; }
.trend-legend { display: flex; gap: 16px; font-size: 11px; color: var(--dv-light-dim); margin-top: 4px; }
.legend-cpu { color: #58a6ff; }
.legend-mem { color: #3fb950; }
.legend-temp { color: #d29922; }
</style>
```

- [ ] **步骤 2：类型检查**

运行：`npm run typecheck:client`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/components/devices/MonitorTrend.vue
git commit -m "feat(monitor): 监控趋势折线图组件"
```

---

### 任务 9：DeviceDrawer 集成监控区块

**文件：**
- 修改：`src/components/devices/DeviceDrawer.vue`

- [ ] **步骤 1：引入 MonitorSection**

`DeviceDrawer.vue` 的 `<template>` 中，在 `</div>`（drawer-body 结束）前加：

```vue
      <MonitorSection
        v-if="device && typeof device.id === 'number'"
        :device-id="device.id"
        :enabled="!!device.monitorEnabled"
        @enable="onEnableMonitor"
      />
```

脚本部分加 import 与处理器：

```ts
import MonitorSection from './MonitorSection.vue'
import { updateDevice } from '../../api/devices'
import { ElMessage } from 'element-plus'
```

```ts
async function onEnableMonitor(v: boolean) {
  if (!props.device) return
  try {
    await updateDevice(props.device.id, { monitorEnabled: v })
    if (props.device) props.device.monitorEnabled = v  // 同步本地 state
    ElMessage.success(v ? '已启用实时监控' : '已关闭实时监控')
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  }
}
```

- [ ] **步骤 2：类型检查**

运行：`npm run typecheck:client`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/components/devices/DeviceDrawer.vue
git commit -m "feat(monitor): 设备详情抽屉集成实时监控区块"
```

---

### 任务 10：环境变量示例 + 验收

**文件：**
- 修改：`.env.example`

- [ ] **步骤 1：`.env.example` 加配置**

`.env.example` 末尾追加：

```
# LibreNMS 设备监控 MySQL 直连（可选，未配置账号时监控功能自动禁用）
LIBRENMS_DB_HOST=10.3.0.141
LIBRENMS_DB_PORT=3306
LIBRENMS_DB_USER=
LIBRENMS_DB_PASS=
LIBRENMS_DB_NAME=librenms
```

- [ ] **步骤 2：全量类型检查**

运行：`npm run typecheck:server && npm run typecheck:client`
预期：两者 PASS

- [ ] **步骤 3：运行采集验证（无启用设备时不输出）**

运行：`node --import tsx -e "import { runCollect } from './server/deviceMonitor.ts'; runCollect().then(()=>console.log('[verify] done')).catch(e=>console.error('[verify] err', e.message))" 2>&1 | grep -E "device-monitor|verify"
预期：无启用监控设备或无配置时无采集日志；`[verify] done` 正常输出

- [ ] **步骤 4：Commit**

```bash
git add .env.example
git commit -m "feat(monitor): LibreNMS MySQL 环境变量示例"
```

---

### 任务 11：采集间隔对齐 LibreNMS 轮询（5 分钟）

**文件：**
- 修改：`server/deviceMonitor.ts`
- 修改：`src/components/devices/MonitorSection.vue`
- 修改：`server/index.ts`

**背景：** LibreNMS 每 5 分钟更新一次 `ports.ifInOctets/ifOutOctets` 累计 counter。OpsHub 若 60s 采样，同一 LibreNMS 周期内 octets 不变 → 速率大部分 0、偶尔出现放大 5 倍的失真峰值。故采集间隔改为 5 分钟与 LibreNMS 对齐。

- [ ] **步骤 1：调度器 cron + 缓存 TTL 改 5 分钟**

`server/deviceMonitor.ts`：
- 文件头注释改为「每 5 分钟轮询（与 LibreNMS 轮询周期对齐）」
- `CACHE_TTL_MS = 5 * 60_000`
- `cron.schedule('*/5 * * * *', ...)`

- [ ] **步骤 2：MonitorSection 文案**

`src/components/devices/MonitorSection.vue` 未启用提示「每 60 秒」→「每 5 分钟」。

- [ ] **步骤 3：历史清理 cron**

`server/index.ts` 在 `service_health_logs` 清理 cron 后加：

```ts
// 每日 03:05 清理 30 天前的设备监控历史（LibreNMS 轮询自存）
cron.schedule('5 3 * * *', () => {
  try {
    const n = db.prepare("DELETE FROM device_monitor_history WHERE collected_at < datetime('now', '-30 days')").run()
    if (n.changes > 0) console.log(`[device-monitor] 清理监控历史 ${n.changes} 条`)
  } catch (e) { console.warn('[device-monitor] 监控历史清理失败:', e) }
})
```

- [ ] **步骤 4：类型检查**

运行：`npm run typecheck:server && npm run typecheck:client`
预期：两者 PASS

- [ ] **步骤 5：Commit**

```bash
git add server/deviceMonitor.ts src/components/devices/MonitorSection.vue server/index.ts docs/superpowers/specs/2026-08-02-device-monitor-design.md
git commit -m "feat(monitor): 采集间隔改为 5 分钟对齐 LibreNMS 轮询 + 历史清理 cron"
```

---

### 任务 12：凭据收敛——明文不入库，改走环境变量

**文件：**
- 运行时数据：`system_config` 表
- 修改：本地 `.env`（gitignore，不入库）

**背景：** 验证期间曾把 `librenms`/`librenms123` 明文写入 `system_config`。凭据应走环境变量（`.env`，已被 gitignore），库内不存明文，避免凭据集中泄露。

- [ ] **步骤 1：`.env` 追加凭据（本地开发）**

本地 `.env` 末尾追加（生产环境在容器 `/app/.env` 手工维护，CI 不同步）：

```
# LibreNMS 设备监控 MySQL（凭据走环境变量，不入库）
LIBRENMS_DB_HOST=10.3.0.141
LIBRENMS_DB_PORT=3306
LIBRENMS_DB_USER=librenms
LIBRENMS_DB_PASS=librenms123
LIBRENMS_DB_NAME=librenms
```

- [ ] **步骤 2：清空 system_config 里的明文凭据**

运行：`node --import tsx -e "import db from './server/db.ts'; db.prepare(\"UPDATE system_config SET value='' WHERE key IN ('librenms_db_user','librenms_db_pass')\").run()"`
（`getLibrenmsDbConfig()` 优先级：`system_config` 优先，清空后回退到 `.env`）

- [ ] **步骤 3：验证环境变量生效**

运行：`node --import tsx -e "import('dotenv/config').then(async () => { const m = await import('./server/librenms.ts'); console.log('ready:', m.librenmsReady(), '| user:', m.getLibrenmsDbConfig().user) })"`
预期：`ready: true | user: librenms`

- [ ] **步骤 4：验证采集（带连接池关闭，避免进程不退出）**

运行：`node --import tsx -e "import('dotenv/config').then(async () => { const { runCollect } = await import('./server/deviceMonitor.ts'); const { closeLibrenms } = await import('./server/librenms.ts'); await runCollect(); await closeLibrenms(); console.log('done'); process.exit(0) })" 2>&1 | grep -E "device-monitor|ER_"`
预期：`[device-monitor] 采集完成 ok=1/1`（有启用设备时）

---

### 任务 13：部署前置——LibreNMS MySQL 开放远程 + 真实设备 IP 录入

**前置条件（需运维在 LibreNMS 服务器 10.3.0.141 操作）：**

- [ ] **步骤 1：MySQL 监听 0.0.0.0**

```bash
sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
sudo systemctl restart mysql
# 验证
ss -tlnp | grep 3306   # 应监听 0.0.0.0:3306
```

- [ ] **步骤 2：librenms 用户授权远程**

```bash
sudo mysql -e "CREATE USER IF NOT EXISTS 'librenms'@'%' IDENTIFIED BY 'librenms123'; GRANT ALL PRIVILEGES ON librenms.* TO 'librenms'@'%'; FLUSH PRIVILEGES;"
# 验证（从远端）
mysql -ulibrenms -plibrenms123 -h 10.3.0.141 -e "SELECT 1"
```

⚠️ **安全收敛（强烈建议）**：
- 若 10.3.0.x 非严格内网，将 `%` 收紧为 OpsHub 容器 IP：`'librenms'@'<OpsHub容器IP>'`
- 降权为只读：`GRANT SELECT ON librenms.* TO ...`（本功能只需 SELECT）

- [ ] **步骤 3：生产 .env 配置**

容器 `/app/.env` 手工配置 `LIBRENMS_DB_*`（CI 的 woodpecker.yml 不同步 .env，注释已说明）。

- [ ] **步骤 4：真实设备 IP 录入**

当前 `devices` 表多为 seed 假 IP（10.0.0.x），需录入 LibreNMS 真实设备。完整设备清单（LibreNMS `devices` 表 hostname，共 22 台）：

**路由器（1台）**
| # | IP | 型号 | 系统名 | 位置 | 状态 |
|---|----|------|--------|------|------|
| 1 | 10.252.0.1 | AR2240C-S | huawei_router | Shenzhen China | ✅ UP |

**汇聚/核心交换机（2台）**
| # | IP | 型号 | 系统名 | 位置 | 状态 |
|---|----|------|--------|------|------|
| 2 | 192.168.100.1 | S9303 | s9303_yxhx_ww | 机房核心 | ✅ UP |
| 3 | 192.168.100.254 | S5720-32X-EI | s5720-hx-jifang-wlan | Beijing China | ✅ UP |

**楼层接入交换机（11台）**
| # | IP | 型号 | 系统名 | 状态 |
|---|----|------|--------|------|
| 4 | 192.168.100.10 | S5700S-52P-LI | s5700s-52p_b1f_01_nw | ❌ DOWN |
| 5 | 192.168.100.12 | S5700S-52P-LI | s5700s-52p_b1f_02_nw | ✅ UP |
| 6 | 192.168.100.13 | S5700S-28P-LI | s5700s-28p_b1f_03_nw | ✅ UP |
| 7 | 192.168.100.14 | S5700S-28P-LI | s5700s-28p_b1f_04_nw | ✅ UP |
| 8 | 192.168.100.15 | S5700S-28P-LI | s5700s-28p_b1f_05_nw | ✅ UP |
| 9 | 192.168.100.16 | S5700S-52P-LI | s5700s-52p-1f-nw | ✅ UP |
| 10 | 192.168.100.21 | S5700S-52P-LI | s5700s-52p_2f_nw | ✅ UP |
| 11 | 192.168.100.31 | S5700S-52P-LI | s5700s-52p_3f_01_nw | ✅ UP |
| 12 | 192.168.100.41 | S5700S-52P-LI | s5700s-52p_4f_nw | ✅ UP |

**PoE 交换机（6台）**
| # | IP | 型号 | 系统名 | 状态 |
|---|----|------|--------|------|
| 13 | 192.168.100.201 | S5720S-28P-PWR-LI | s5720-1f-poe-1 | ✅ UP |
| 14 | 192.168.100.202 | S5720S-28P-PWR-LI | s5720-2a-poe-202 | ✅ UP |
| 15 | 192.168.100.203 | S5720S-28P-PWR-LI | s5720-2f-poe-1 | ✅ UP |
| 16 | 192.168.100.204 | S5720S-28P-PWR-LI | s5720-3f-poe-1 | ✅ UP |
| 17 | 192.168.100.205 | S5720S-28P-PWR-LI | s5720-3f-poe-2 | ✅ UP |
| 18 | 192.168.100.206 | S5720S-28P-PWR-LI | s5720-3a-poe-206 | ✅ UP |

**其他（3台）**
| # | IP | 型号 | 系统名 | 说明 | 状态 |
|---|----|------|--------|------|------|
| 19 | 192.168.100.207 | S5720S-28P-PWR-LI | s5720-3a-207 | 3楼接入 | ✅ UP |
| 20 | 192.168.100.208 | S5735S-L24P4S-A2 | s5735s-24p--1f-poe | 1楼 PoE | ✅ UP |
| 21 | 192.168.100.209 | S5735S-L48T4S-A1 | s5730s-48p--1f-nw | 1楼网络 | ✅ UP |
| 22 | 192.168.100.253 | AC6005-8 | ac6005-jifang | 无线AC控制器 | ✅ UP |

**录入方式**：在「数据中心管理 → 设备详情」逐台把 IP 改为上表 hostname、开启「启用监控」开关；或写一次性脚本按清单批量 UPDATE：

```ts
// scripts/sync-librenms-devices.ts（一次性录入脚本示例）
import db from '../server/db'

const REAL_DEVICES: { ip: string; name: string; type: string }[] = [
  { ip: '10.252.0.1', name: '核心路由器 AR2240C', type: 'router' },
  { ip: '192.168.100.1', name: '核心交换机 S9303', type: 'switch' },
  { ip: '192.168.100.254', name: '核心交换机 S5720-32X-EI', type: 'switch' },
  { ip: '192.168.100.10', name: 'B1F-01 接入交换机', type: 'switch' },
  // ...（按上方清单补齐 22 台）
]

// 策略：IP 已存在则启用监控；不存在则新增（新设备默认放最后一个机柜空位）
const upsert = db.prepare(`
  INSERT INTO devices (name, type, model, u, ports, status, ip, monitor_enabled)
  VALUES (?, ?, '', 1, 0, '正常', ?, 1)
  ON CONFLICT(id) DO UPDATE SET monitor_enabled = 1
`)

// 注意：devices.ip 无 UNIQUE 约束，需先查重避免重复插入
const find = db.prepare('SELECT id FROM devices WHERE ip = ?')
const insert = db.prepare('INSERT INTO devices (name, type, model, u, ports, status, ip, monitor_enabled) VALUES (?, ?, ?, 1, 0, ?, ?, 1)')
const tx = db.transaction(() => {
  for (const d of REAL_DEVICES) {
    const existing = find.get(d.ip)
    if (existing) {
      db.prepare('UPDATE devices SET monitor_enabled = 1, name = ? WHERE id = ?').run(d.name, existing.id)
    } else {
      insert.run(d.name, d.type, d.model, '正常', d.ip)
    }
  }
})
tx()
```

**注意**：录入后首次采集会在下一个 5 分钟轮询周期触发（`*/5` cron）；若需立即验证，手动运行 `runCollect()`。

---

### 任务 14：22 台真实设备批量录入 + 端到端验收

**文件：**
- 创建：`scripts/sync-librenms-devices.ts`（一次性录入脚本，不加入 `start` 运行链）
- 修改：`server/db.ts`（若录入时需处理机柜/槽位关联）

**目标：** 把 22 台 LibreNMS 真实设备写入 OpsHub `devices` 表并启用监控，验证监控全链路可用。

- [ ] **步骤 1：确认设备表现状与布局策略**

先检查：`devices` 表当前行数、seed 假设备（10.0.0.x）、`rack_slots` 关联。新增设备若不在机柜槽位中，`DevicesView` 机柜视图不显示，但「设备详情」入口（`DeviceDrawer`）需可达——确认监控端点不依赖机柜布局（`GET /devices/:id/monitor/snapshot` 只查 `devices` 表，✅ 不依赖）。

```bash
node --import tsx -e "import db from './server/db.ts'; console.log('devices:', db.prepare('SELECT COUNT(*) c FROM devices').get().c, '| slots:', db.prepare('SELECT COUNT(*) c FROM rack_slots WHERE device_id IS NOT NULL').get().c)"
```

- [ ] **步骤 2：编写完整录入脚本**

创建 `scripts/sync-librenms-devices.ts`，`REAL_DEVICES` 数组含全部 22 台（IP/名称/类型），策略：IP 已存在 → 启用监控 + 更新名称；不存在 → 新增（`monitor_enabled=1`）。类型映射：路由器→`router`，汇聚/核心/楼层/PoE/其他交换机→`switch`，无线AC→`router`（或新增 `controller` 类型）。

```ts
// scripts/sync-librenms-devices.ts — 一次性录入 22 台 LibreNMS 真实设备
import db from '../server/db'

// [IP, 名称, 类型]
const REAL_DEVICES: [string, string, string][] = [
  ['10.252.0.1', '核心路由器 AR2240C', 'router'],
  ['192.168.100.1', '核心交换机 S9303', 'switch'],
  ['192.168.100.254', '核心交换机 S5720-32X-EI', 'switch'],
  ['192.168.100.10', 'B1F-01 接入交换机', 'switch'],
  ['192.168.100.12', 'B1F-02 接入交换机', 'switch'],
  ['192.168.100.13', 'B1F-03 接入交换机', 'switch'],
  ['192.168.100.14', 'B1F-04 接入交换机', 'switch'],
  ['192.168.100.15', 'B1F-05 接入交换机', 'switch'],
  ['192.168.100.16', '1F 接入交换机', 'switch'],
  ['192.168.100.21', '2F 接入交换机', 'switch'],
  ['192.168.100.31', '3F-01 接入交换机', 'switch'],
  ['192.168.100.41', '4F 接入交换机', 'switch'],
  ['192.168.100.201', '1F PoE 交换机', 'switch'],
  ['192.168.100.202', '2A PoE 交换机', 'switch'],
  ['192.168.100.203', '2F PoE 交换机', 'switch'],
  ['192.168.100.204', '3F-01 PoE 交换机', 'switch'],
  ['192.168.100.205', '3F-02 PoE 交换机', 'switch'],
  ['192.168.100.206', '3A PoE 交换机', 'switch'],
  ['192.168.100.207', '3A 接入交换机', 'switch'],
  ['192.168.100.208', '1F PoE 交换机 S5735', 'switch'],
  ['192.168.100.209', '1F 网络交换机 S5730', 'switch'],
  ['192.168.100.253', '无线AC控制器 AC6005', 'router'],
]

const find = db.prepare('SELECT id, name FROM devices WHERE ip = ?')
const update = db.prepare("UPDATE devices SET monitor_enabled = 1, name = ? WHERE id = ?")
const insert = db.prepare("INSERT INTO devices (name, type, model, u, ports, status, ip, monitor_enabled) VALUES (?, ?, ?, 1, 0, '正常', ?, 1)")

const tx = db.transaction(() => {
  for (const [ip, name, type] of REAL_DEVICES) {
    const existing = find.get(ip) as { id: number; name: string } | undefined
    if (existing) {
      if (existing.name !== name) update.run(name, existing.id)
      else db.prepare('UPDATE devices SET monitor_enabled = 1 WHERE id = ?').run(existing.id)
    } else {
      insert.run(name, type, type === 'router' ? 'AR2240C-S' : 'S57xx', ip)
    }
  }
})
tx()
const n = db.prepare('SELECT COUNT(*) c FROM devices WHERE monitor_enabled = 1').get() as { c: number }
console.log(`[sync] 完成，启用监控设备数: ${n.c}`)
```

- [ ] **步骤 3：运行录入脚本**

运行：`node --import tsx scripts/sync-librenms-devices.ts`
预期：`[sync] 完成，启用监控设备数: N`（含原有 seed 启用 + 新增）

- [ ] **步骤 4：手动采集验证全链路**

运行：`node --import tsx -e "import('dotenv/config').then(async () => { const { runCollect } = await import('./server/deviceMonitor.ts'); const { closeLibrenms } = await import('./server/librenms.ts'); await runCollect(); await closeLibrenms(); console.log('[verify] done'); process.exit(0) })" 2>&1 | grep -E "device-monitor|ER_"`
预期：`[device-monitor] 采集完成 ok=N/22`（22 台全部采集，含 1 台 DOWN 的 10 号设备会失败但不影响其它）

- [ ] **步骤 5：抽查快照与历史**

抽查 1-2 台 UP 设备（如 10.252.0.1、192.168.100.254）确认快照有值、历史落库：

```bash
node --import tsx -e "import db from './server/db.ts'; const rows = db.prepare(\"SELECT device_id, cpu_usage, mem_usage, temperature, collected_at FROM device_monitor_history WHERE collected_at >= datetime('now','-10 minutes') ORDER BY id DESC LIMIT 5\").all(); console.log(JSON.stringify(rows, null, 2))"
```

- [ ] **步骤 6：类型检查 + Commit**

运行：`npm run typecheck:server && npm run typecheck:client`
预期：两者 PASS

```bash
git add scripts/sync-librenms-devices.ts
git commit -m "feat(monitor): 22 台真实设备批量录入脚本（LibreNMS 同步）"
```

---

### 任务 15：测试遗留清理 + 收尾

**文件：**
- 运行时数据：`devices` 表（还原测试设备）
- 检查：`system_config` 凭据是否已清空

**背景：** 验证期间改动了测试数据，需清理还原。

- [ ] **步骤 1：清理测试设备状态**

验证期间把 seed 设备 3（Core-SW-01）IP 临时改为 `10.252.0.1` 并启用监控。录入 22 台真实设备后，该 seed 设备可还原为原始状态或保留其一。确认逻辑：
- 若真实录入含 `10.252.0.1`，seed 设备 3 的 IP 与真实设备冲突 → 还原 seed 设备 3 为原始假 IP（10.0.0.1）或删除。

```bash
node --import tsx -e "import db from './server/db.ts'; const d = db.prepare('SELECT id, name, ip, monitor_enabled FROM devices').all(); console.log(JSON.stringify(d.filter(x => x.monitor_enabled || x.ip?.startsWith('10.0.0')), null, 2))"
```

- [ ] **步骤 2：确认凭据不在库内**

运行：`node --import tsx -e "import db from './server/db.ts'; const rows = db.prepare(\"SELECT key, value FROM system_config WHERE key IN ('librenms_db_user','librenms_db_pass')\").all(); console.log(JSON.stringify(rows))"`
预期：`[{"key":"librenms_db_user","value":""},{"key":"librenms_db_pass","value":""}]`（已清空，凭据在 `.env`）

- [ ] **步骤 3：部署上线清单核对**

- [ ] 容器 `/app/.env` 已配置 `LIBRENMS_DB_*`（CI 不同步，手工维护）
- [ ] MySQL 开放远程 + `librenms@'%'` 授权（任务 13 步骤 1-2）
- [ ] 安全收敛：`librenms` 用户降权只读 / 收紧为容器 IP（强烈建议）
- [ ] 类型检查通过、commit 已推送 origin + gitea
- [ ] 生产重启后 `GET /api/v1/devices/:id/monitor/snapshot` 返回真实数据

---

## 自检

- **规格覆盖度：** 依赖+数据模型+配置（任务1）✅ / MySQL 客户端（任务2）✅ / 调度器（任务3）✅ / 接入启动（任务4）✅ / 端点（任务5）✅ / 前端类型+API（任务6）✅ / 监控区块UI（任务7、9）✅ / 趋势图（任务8）✅ / 环境+验收（任务10）✅ / 采集间隔对齐（任务11）✅ / 凭据收敛（任务12）✅ / 部署前置（任务13）✅ / 设备批量录入+端到端验收（任务14）✅ / 测试遗留清理+上线清单（任务15）✅
- **占位符扫描：** 所有步骤含实际代码、命令、预期输出，无 TODO/占位。
- **类型一致性：** `HealthData`/`PortData`/`DeviceSnapshot`（librenms.ts）↔ `fetchDeviceSnapshot` 返回（api/devices.ts）↔ `MonitorSection`/`MonitorTrend` props 一致；`monitorEnabled` 命名前后一致；`getDeviceSnapshot`/`runCollect`/`startDeviceMonitor`/`stopDeviceMonitor`/`librenmsReady` 签名前后一致。
- **范围：** 单一子系统，一个计划可覆盖。
