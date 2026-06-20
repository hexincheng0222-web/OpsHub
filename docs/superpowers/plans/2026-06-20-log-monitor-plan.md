# 日志监控模块实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 log_analyzer 重写为 Node.js/TypeScript，集成到 OpsHub 中，实现网络设备日志的定时拉取、LLM 异常分析、SQLite 审计和 Web 管理界面。

**架构：** 后端使用 node-cron 调度 + fetch 调用 LLM API + better-sqlite3 存储；前端使用 Vue 3 + Element Plus 组件，配置管理放在 admin 后台，仪表盘/审计作为独立页面。

**技术栈：** Node.js + Express + better-sqlite3 + node-cron + Vue 3 + Element Plus + TypeScript

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `server/logMonitor.ts` | 核心服务：配置加载、日志拉取（含 mock）、LLM 分析、审计存储、健康检查 |
| `server/routes/log-monitor.ts` | Express 路由：配置/审计/调度/测试/健康检查 API |
| `src/api/log-monitor.ts` | 前端 API 封装：所有日志监控接口的 TypeScript 函数 |
| `src/views/log-monitor/LogMonitorView.vue` | 仪表盘页面：状态卡片 + 操作按钮 + 最近审计表格 |
| `src/views/log-monitor/LogMonitorAudit.vue` | 审计记录页面：筛选 + 分页表格 + 详情弹窗 |
| `src/views/admin/LogMonitorConfig.vue` | admin 配置页面：日志服务器/设备/LLM/System Prompt/调度 |
| `src/views/admin/LogMonitorLlmTest.vue`：admin LLM 测试页面 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `server/db.ts` | 追加 `log_monitor_config` 和 `log_audit` 建表语句 |
| `server/index.ts` | 引入并挂载 `logMonitorRouter` |
| `src/router/index.ts` | 添加 `/log-monitor` 路由和 admin 子路由 |
| `src/views/admin/AdminView.vue` | 添加"日志监控"菜单项（含配置/LLM 测试子项） |
| `src/views/HomeView.vue` | 添加"日志监控"卡片入口 |
| `package.json` | 添加 `node-cron` 依赖 |

---

## 依赖安装

### 任务 0：安装 node-cron

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：安装 node-cron**

```bash
npm install node-cron@~3.0.3
npm install -D @types/node-cron
```

- [ ] **步骤 2：验证安装**

```bash
npm list node-cron
```

预期输出包含 `node-cron@3.0.x`

- [ ] **步骤 3：Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add node-cron dependency for log monitor scheduling"
```

---

## 后端实现

### 任务 1：数据库建表

**文件：**
- 修改：`server/db.ts`

- [ ] **步骤 1：在 db.ts 末尾添加建表语句**

在 `export default db` 之前追加：

```ts
// ========== 日志监控配置表 ==========
db.exec(`
  CREATE TABLE IF NOT EXISTS log_monitor_config (
    key       TEXT PRIMARY KEY,
    value     TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS log_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT    NOT NULL,
    device_name TEXT    NOT NULL,
    log_count   INTEGER NOT NULL,
    raw_logs    TEXT    NOT NULL,
    llm_summary TEXT    NOT NULL,
    has_abnormal INTEGER NOT NULL DEFAULT 0,
    llm_ms      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_log_audit_device   ON log_audit(device_id);
  CREATE INDEX IF NOT EXISTS idx_log_audit_abnormal ON log_audit(has_abnormal);
  CREATE INDEX IF NOT EXISTS idx_log_audit_created  ON log_audit(created_at);
`)

// 初始化日志监控默认配置
const lmConfigCount = db.prepare('SELECT COUNT(*) as cnt FROM log_monitor_config').get() as { cnt: number }
if (lmConfigCount.cnt === 0) {
  const insertConfig = db.prepare('INSERT OR IGNORE INTO log_monitor_config (key, value) VALUES (?, ?)')
  const defaults: [string, string][] = [
    ['log_server', JSON.stringify({
      base_url: 'http://127.0.0.1:8080',
      path: '/api/v1/logs?device_id={device_id}&start_time={start_time}&end_time={end_time}',
      page_size: 200,
      timeout: 30,
    })],
    ['devices', JSON.stringify([
      { device_id: 'core-switch-01', name: '核心交换机 01' },
      { device_id: 'firewall-01', name: '防火墙 01' },
    ])],
    ['llm', JSON.stringify({
      base_url: 'http://10.3.0.200:17002/v1',
      model: 'Qwen3.5-9B-AWQ',
      api_key: 'ml-ShHoXcDGYdOZlH14hv0_GBTlsbsHwliMlYHsIIwiTNc',
      temperature: 0.1,
      max_tokens: 1024,
      timeout: 120,
      retries: 3,
      system_prompt: '你是一位资深网络运维工程师，擅长分析网络设备日志。\n请你阅读以下日志，完成两件事，并以 JSON 返回：\n1. summary: 用 2~3 句话概括本批次日志反映的设备状况；\n2. has_abnormal: 是否存在异常（true/false）。\n异常包括但不限于：链路 down、错误包飙升、认证失败、设备重启、温度/CPU/内存越限、关键告警等。\n返回格式示例：\n{"summary": "...", "has_abnormal": false}\n只返回 JSON，不要任何解释。',
    })],
    ['scheduler', JSON.stringify({ interval: 300, window: 300 })],
    ['scheduler_running', 'false'],
  ]
  const seedDefaults = db.transaction(() => {
    for (const [key, value] of defaults) insertConfig.run(key, value)
  })
  seedDefaults()
  console.log('[db] 已初始化日志监控默认配置')
}
```

- [ ] **步骤 2：重启后端验证建表**

```bash
# 先停掉现有的 npm run dev，再重新启动
npm run dev:server
```

预期输出包含 `[db] 已初始化日志监控默认配置`

- [ ] **步骤 3：Commit**

```bash
git add server/db.ts
git commit -m "feat: add log_monitor_config and log_audit tables with default config"
```

---

### 任务 2：核心服务模块

**文件：**
- 创建：`server/logMonitor.ts`

- [ ] **步骤 1：创建 server/logMonitor.ts**

```ts
import db from './db'
import cron, { ScheduledTask } from 'node-cron'

// ========== 类型定义 ==========

export interface LogServerConfig {
  base_url: string
  path: string
  page_size: number
  timeout: number
}

export interface DeviceConfig {
  device_id: string
  name: string
}

export interface LLMConfig {
  base_url: string
  model: string
  api_key: string
  temperature: number
  max_tokens: number
  timeout: number
  retries: number
  system_prompt: string
}

export interface SchedulerConfig {
  interval: number
  window: number
}

export interface LogConfig {
  log_server: LogServerConfig
  devices: DeviceConfig[]
  llm: LLMConfig
  scheduler: SchedulerConfig
  scheduler_running: boolean
}

export interface LogEntry {
  ts: string
  msg: string
  level?: string
}

export interface LLMResult {
  summary: string
  has_abnormal: boolean
  _llm_ms: number
  _error?: boolean
}

export interface HealthStatus {
  log_server: { status: string; latency_ms: number; error: string | null }
  llm: { status: string; latency_ms: number; error: string | null }
}

// ========== 配置管理 ==========

function getConfig(key: string): any {
  const row = db.prepare('SELECT value FROM log_monitor_config WHERE key = ?').get(key) as { value: string } | undefined
  return row ? JSON.parse(row.value) : null
}

function setConfig(key: string, value: any): void {
  db.prepare(
    'INSERT OR REPLACE INTO log_monitor_config (key, value, updated_at) VALUES (?, ?, datetime("now"))'
  ).run(key, JSON.stringify(value))
}

export function loadConfig(): LogConfig {
  return {
    log_server: getConfig('log_server') || {},
    devices: getConfig('devices') || [],
    llm: getConfig('llm') || {},
    scheduler: getConfig('scheduler') || { interval: 300, window: 300 },
    scheduler_running: getConfig('scheduler_running') === true || getConfig('scheduler_running') === 'true',
  }
}

export function saveConfigPartial(partial: Partial<LogConfig>): LogConfig {
  if (partial.log_server) setConfig('log_server', partial.log_server)
  if (partial.devices) setConfig('devices', partial.devices)
  if (partial.llm) setConfig('llm', partial.llm)
  if (partial.scheduler) setConfig('scheduler', partial.scheduler)
  return loadConfig()
}

// ========== 日志拉取 ==========

function generateMockLogs(deviceId: string): LogEntry[] {
  const now = Date.now()
  const count = 10 + Math.floor(Math.random() * 40)
  const levels = ['INFO', 'INFO', 'INFO', 'WARNING', 'ERROR']
  const messages = [
    'Interface GigabitEthernet0/1 up',
    'Interface GigabitEthernet0/2 down',
    'OSPF adjacency established with neighbor 10.0.0.2',
    'BGP peer 192.168.1.1 state changed to Established',
    'Temperature threshold exceeded (75°C)',
    'Authentication failed for user admin from 10.0.0.5',
    'Power supply 2 failure detected',
    'Link flap detected on port Gi0/24',
    'STP topology change on Vlan 100',
    'CPU utilization above 85% for 5 minutes',
    'Memory utilization at 92%',
    'Fan tray 1 removed',
    'Interface Gi0/1 CRC error count increasing',
    'DHCP lease exhausted on pool LAN',
    'ARP inspection dropped 3 packets',
    'Device rebooted unexpectedly',
    'NTP synchronization lost',
    'VLAN 200 added to trunk port Gi0/48',
    'MAC address table overflow detected',
    'Port security violation on Gi0/12',
  ]

  return Array.from({ length: count }, (_, i) => ({
    ts: new Date(now - (count - i) * 60000).toISOString(),
    msg: messages[Math.floor(Math.random() * messages.length)],
    level: levels[Math.floor(Math.random() * levels.length)],
  }))
}

export async function fetchLogs(deviceId: string, startTime: Date, endTime: Date): Promise<LogEntry[]> {
  const cfg = loadConfig().log_server
  if (!cfg.base_url) {
    console.log('[logMonitor] log_server not configured, returning mock data')
    return generateMockLogs(deviceId)
  }

  const url = cfg.base_url.rstrip('/') + cfg.path
    .replace('{device_id}', deviceId)
    .replace('{start_time}', startTime.toISOString())
    .replace('{end_time}', endTime.toISOString())

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), (cfg.timeout || 30) * 1000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const logs: LogEntry[] = Array.isArray(data) ? data : (data.logs || [])
    return logs.filter((l: any) => typeof l === 'object' && l !== null)
  } catch (e: any) {
    console.warn(`[logMonitor] fetch failed for ${deviceId}: ${e.message}, returning mock`)
    return generateMockLogs(deviceId)
  }
}

// ========== LLM 分析 ==========

export async function analyzeLogs(logs: LogEntry[], systemPrompt: string): Promise<LLMResult> {
  const cfg = loadConfig().llm
  if (!logs.length) return { summary: '本批次无日志。', has_abnormal: false, _llm_ms: 0 }

  const compact = JSON.stringify(logs, null, 0)
  const truncated = compact.length > 60000 ? compact.slice(0, 60000) + '\n...[truncated]' : compact

  const payload = {
    model: cfg.model || 'Qwen3.5-9B-AWQ',
    messages: [
      { role: 'system', content: systemPrompt || '你是一位网络运维工程师，分析日志返回 JSON。' },
      { role: 'user', content: `以下是最近一批网络设备日志：\n${truncated}` },
    ],
    temperature: cfg.temperature ?? 0.1,
    max_tokens: cfg.max_tokens || 1024,
  }

  const url = (cfg.base_url || 'http://10.3.0.200:17002/v1').rstrip('/') + '/chat/completions'
  const apiKey = cfg.api_key || 'EMPTY'
  const maxRetries = cfg.retries || 3
  const timeoutSec = cfg.timeout || 120

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const t0 = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutSec * 1000)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const ms = Date.now() - t0

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content || ''
      const parsed = parseLLMJson(content)
      console.log(`[logMonitor] LLM ok: abnormal=${parsed.has_abnormal}, ${ms}ms`)
      return { ...parsed, _llm_ms: ms }
    } catch (e: any) {
      console.warn(`[logMonitor] LLM attempt ${attempt}/${maxRetries} failed: ${e.message}`)
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, Math.min(2 ** attempt, 10) * 1000))
    }
  }

  return { summary: 'LLM 调用失败，已达最大重试次数。', has_abnormal: false, _llm_ms: 0, _error: true }
}

function parseLLMJson(text: string): { summary: string; has_abnormal: boolean } {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.split('\n', 1)[1] || t.slice(3)
    if (t.endsWith('```')) t = t.slice(0, -3)
    t = t.trim()
  }
  try {
    const obj = JSON.parse(t)
    return {
      summary: String(obj.summary || ''),
      has_abnormal: Boolean(obj.has_abnormal),
    }
  } catch {
    return { summary: t, has_abnormal: t.includes('异常') || t.toLowerCase().includes('error') }
  }
}

// ========== 审计存储 ==========

export function saveAudit(device: DeviceConfig, logs: LogEntry[], result: LLMResult): number {
  const row = db.prepare(
    'INSERT INTO log_audit (device_id, device_name, log_count, raw_logs, llm_summary, has_abnormal, llm_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))'
  ).run(
    device.device_id,
    device.name,
    logs.length,
    JSON.stringify(logs),
    result.summary,
    result.has_abnormal ? 1 : 0,
    result._llm_ms || 0,
  )
  return row.lastrowid as number
}

export function cleanupAudit(retentionDays: number): number {
  if (retentionDays <= 0) return 0
  const row = db.prepare(
    'DELETE FROM log_audit WHERE created_at < datetime("now", ?)'
  ).run(`-${retentionDays} days`)
  return row.changes
}

// ========== 健康检查 ==========

export async function healthCheck(): Promise<HealthStatus> {
  const cfg = loadConfig()
  const result: HealthStatus = {
    log_server: { status: 'unknown', latency_ms: 0, error: null },
    llm: { status: 'unknown', latency_ms: 0, error: null },
  }

  // 检查日志服务器
  if (cfg.log_server?.base_url) {
    try {
      const t0 = Date.now()
      await fetch(cfg.log_server.base_url, { signal: AbortSignal.timeout(5000) })
      result.log_server = { status: 'ok', latency_ms: Date.now() - t0, error: null }
    } catch (e: any) {
      result.log_server = { status: 'error', latency_ms: 0, error: e.message }
    }
  } else {
    result.log_server = { status: 'disabled', latency_ms: 0, error: '未配置' }
  }

  // 检查 LLM
  if (cfg.llm?.base_url) {
    try {
      const t0 = Date.now()
      const res = await fetch(`${cfg.llm.base_url.replace(/\/$/, '')}/models`, {
        headers: { 'Authorization': `Bearer ${cfg.llm.api_key || 'EMPTY'}` },
        signal: AbortSignal.timeout(10000),
      })
      result.llm = {
        status: res.ok ? 'ok' : 'warning',
        latency_ms: Date.now() - t0,
        error: res.ok ? null : `HTTP ${res.status}`,
      }
    } catch (e: any) {
      result.llm = { status: 'error', latency_ms: 0, error: e.message }
    }
  } else {
    result.llm = { status: 'disabled', latency_ms: 0, error: '未配置' }
  }

  return result
}

// ========== 调度器 ==========

let cronTask: ScheduledTask | null = null
let lastRunTime: Date | null = null

export function startScheduler(): void {
  if (cronTask) return // 已在运行

  const cfg = loadConfig()
  const interval = cfg.scheduler?.interval || 300
  const cronExpr = `*/${interval} * * * *` // 每 interval 秒

  cronTask = cron.schedule(cronExpr, async () => {
    lastRunTime = new Date()
    const config = loadConfig()
    console.log(`[scheduler] 开始新一轮分析, 设备数=${config.devices.length}`)
    for (const device of config.devices) {
      try {
        const endTime = new Date()
        const startTime = new Date(endTime.getTime() - (config.scheduler.window * 1000))
        const logs = await fetchLogs(device.device_id, startTime, endTime)
        const result = await analyzeLogs(logs, config.llm.system_prompt)
        saveAudit(device, logs, result)
      } catch (e: any) {
        console.error(`[scheduler] 分析设备 ${device.device_id} 失败: ${e.message}`)
      }
    }
  })

  setConfig('scheduler_running', true)
  console.log(`[scheduler] 调度器已启动, 间隔=${interval}s`)
}

export function stopScheduler(): void {
  if (cronTask) {
    cronTask.stop()
    cronTask = null
  }
  setConfig('scheduler_running', false)
  console.log('[scheduler] 调度器已停止')
}

export function getSchedulerStatus(): { running: boolean; lastRun: string | null } {
  return {
    running: cronTask !== null,
    lastRun: lastRunTime?.toISOString() || null,
  }
}

// 启动时自动恢复调度状态
const savedConfig = loadConfig()
if (savedConfig.scheduler_running) {
  startScheduler()
}
```

- [ ] **步骤 2：Commit**

```bash
git add server/logMonitor.ts
git commit -m "feat: add log monitor core service (fetch, analyze, audit, scheduler)"
```

---

### 任务 3：API 路由

**文件：**
- 创建：`server/routes/log-monitor.ts`

- [ ] **步骤 1：创建 server/routes/log-monitor.ts**

```ts
import { Router, Request, Response } from 'express'
import {
  loadConfig, saveConfigPartial, fetchLogs, analyzeLogs,
  saveAudit, cleanupAudit, healthCheck, startScheduler,
  stopScheduler, getSchedulerStatus,
} from '../logMonitor'

const router = Router()

// 1. 获取配置
router.get('/config', (_req: Request, res: Response) => {
  res.json({ code: 0, data: loadConfig() })
})

// 2. 更新配置
router.put('/config', (req: Request, res: Response) => {
  try {
    const updated = saveConfigPartial(req.body)
    res.json({ code: 0, data: updated })
  } catch (e: any) {
    res.json({ code: 500, message: e.message })
  }
})

// 3. 分页查询审计记录
router.get('/audit', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 20))
  const deviceId = (req.query.device as string) || ''
  const abnormal = (req.query.abnormal as string) || ''
  const startDate = (req.query.start_date as string) || ''
  const endDate = (req.query.end_date as string) || ''

  let where = 'WHERE 1=1'
  const params: any[] = []

  if (deviceId) { where += ' AND device_id = ?'; params.push(deviceId) }
  if (abnormal === '1') { where += ' AND has_abnormal = 1' }
  else if (abnormal === '0') { where += ' AND has_abnormal = 0' }
  if (startDate) { where += ' AND created_at >= ?'; params.push(startDate) }
  if (endDate) { where += ' AND created_at <= ?'; params.push(endDate) }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM log_audit ${where}`).get(...params) as { cnt: number }
  const rows = db.prepare(
    `SELECT id, device_id, device_name, log_count, llm_summary, has_abnormal, llm_ms, created_at
     FROM log_audit ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize)

  res.json({ code: 0, data: { list: rows, total, page, pageSize } })
})

// 4. 清理过期审计
router.delete('/audit', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 90
  const deleted = cleanupAudit(days)
  res.json({ code: 0, data: { deleted } })
})

// 5. 手动触发一次分析
router.post('/run-once', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    const results = []
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - (config.scheduler.window * 1000))

    for (const device of config.devices) {
      const logs = await fetchLogs(device.device_id, startTime, endTime)
      const result = await analyzeLogs(logs, config.llm.system_prompt)
      const id = saveAudit(device, logs, result)
      results.push({ id, device_id: device.device_id, has_abnormal: result.has_abnormal })
    }
    res.json({ code: 0, data: results })
  } catch (e: any) {
    res.json({ code: 500, message: e.message })
  }
})

// 6. 调度器控制
router.post('/scheduler/start', (_req: Request, res: Response) => {
  startScheduler()
  res.json({ code: 0, message: '调度器已启动' })
})

router.post('/scheduler/stop', (_req: Request, res: Response) => {
  stopScheduler()
  res.json({ code: 0, message: '调度器已停止' })
})

router.get('/scheduler/status', (_req: Request, res: Response) => {
  res.json({ code: 0, data: getSchedulerStatus() })
})

// 7. LLM 连通测试
router.post('/llm-test', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    const url = (config.llm?.base_url || '').replace(/\/$/, '') + '/chat/completions'
    const t0 = Date.now()
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llm?.api_key || 'EMPTY'}`,
      },
      body: JSON.stringify({
        model: config.llm?.model || '',
        messages: [{ role: 'user', content: '回复：连接成功' }],
        max_tokens: 50,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout((config.llm?.timeout || 120) * 1000),
    })
    const ms = Date.now() - t0
    if (!r.ok) return res.json({ code: 0, data: { success: false, latency_ms: ms, error: `HTTP ${r.status}` } })
    const data = await r.json()
    const content = data.choices?.[0]?.message?.content || ''
    res.json({ code: 0, data: { success: true, latency_ms: ms, response: content } })
  } catch (e: any) {
    res.json({ code: 0, data: { success: false, latency_ms: 0, error: e.message } })
  }
})

// 8. 健康检查
router.get('/health', async (_req: Request, res: Response) => {
  const status = await healthCheck()
  res.json({ code: 0, data: status })
})

// 需要 import db
import db from '../db'

export default router
```

- [ ] **步骤 2：Commit**

```bash
git add server/routes/log-monitor.ts
git commit -m "feat: add log monitor API routes (config, audit, scheduler, health)"
```

---

### 任务 4：挂载路由到 Express

**文件：**
- 修改：`server/index.ts`

- [ ] **步骤 1：在 server/index.ts 中添加引入和路由挂载**

在 import 区域添加：
```ts
import logMonitorRouter from './routes/log-monitor'
```

在路由挂载区域（phonesRouter 之后）添加：
```ts
app.use('/api/v1/log-monitor', logMonitorRouter)
```

完整参考：已有 `import phonesRouter from './routes/phones'` 和 `app.use('/api/v1/phones', phonesRouter)`，在它们后面加即可。

- [ ] **步骤 2：重启后端验证**

```bash
npm run dev:server
```

预期输出：`[server] OpsHub API running at http://localhost:3001`

- [ ] **步骤 3：快速 curl 测试**

```bash
curl http://localhost:3001/api/v1/log-monitor/config
```

预期返回 JSON 包含 `code: 0` 和配置数据。

```bash
curl http://localhost:3001/api/v1/log-monitor/scheduler/status
```

预期返回 `{"code":0,"data":{"running":false,"lastRun":null}}`

- [ ] **步骤 4：Commit**

```bash
git add server/index.ts
git commit -m "feat: mount log monitor router in express server"
```

---

## 前端实现

### 任务 5：前端 API 封装

**文件：**
- 创建：`src/api/log-monitor.ts`

- [ ] **步骤 1：创建 src/api/log-monitor.ts**

```ts
import { request } from '../utils/http'

const BASE = '/api/v1/log-monitor'

export interface LogConfig {
  log_server: { base_url: string; path: string; page_size: number; timeout: number }
  devices: { device_id: string; name: string }[]
  llm: { base_url: string; model: string; api_key: string; temperature: number; max_tokens: number; timeout: number; retries: number; system_prompt: string }
  scheduler: { interval: number; window: number }
  scheduler_running: boolean
}

export interface AuditRecord {
  id: number
  device_id: string
  device_name: string
  log_count: number
  llm_summary: string
  has_abnormal: number
  llm_ms: number
  created_at: string
}

export interface AuditListResult {
  list: AuditRecord[]
  total: number
  page: number
  pageSize: number
}

export interface HealthStatus {
  log_server: { status: string; latency_ms: number; error: string | null }
  llm: { status: string; latency_ms: number; error: string | null }
}

// 获取配置
export function getConfig() {
  return request<LogConfig>(`${BASE}/config`)
}

// 更新配置
export function updateConfig(data: Partial<LogConfig>) {
  return request<LogConfig>(`${BASE}/config`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// 分页查询审计
export function getAuditList(params: {
  page?: number
  pageSize?: number
  device?: string
  abnormal?: string
  start_date?: string
  end_date?: string
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.device) query.set('device', params.device)
  if (params.abnormal) query.set('abnormal', params.abnormal)
  if (params.start_date) query.set('start_date', params.start_date)
  if (params.end_date) query.set('end_date', params.end_date)
  const qs = query.toString()
  return request<AuditListResult>(`${BASE}/audit${qs ? '?' + qs : ''}`)
}

// 手动触发
export function runOnce() {
  return request<any>(`${BASE}/run-once`, { method: 'POST' })
}

// 调度器控制
export function startScheduler() {
  return request<{ message: string }>(`${BASE}/scheduler/start`, { method: 'POST' })
}

export function stopScheduler() {
  return request<{ message: string }>(`${BASE}/scheduler/stop`, { method: 'POST' })
}

export function getSchedulerStatus() {
  return request<{ running: boolean; lastRun: string | null }>(`${BASE}/scheduler/status`)
}

// LLM 测试
export function testLLM() {
  return request<{ success: boolean; latency_ms: number; response?: string; error?: string }>(
    `${BASE}/llm-test`, { method: 'POST' }
  )
}

// 健康检查
export function getHealth() {
  return request<HealthStatus>(`${BASE}/health`)
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/api/log-monitor.ts
git commit -m "feat: add frontend API layer for log monitor"
```

---

### 任务 6：仪表盘页面

**文件：**
- 创建：`src/views/log-monitor/LogMonitorView.vue`

- [ ] **步骤 1：创建仪表盘页面**

```vue
<template>
  <div class="log-monitor-dashboard">
    <!-- 状态卡片 -->
    <el-row :gutter="16" class="status-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <div class="card-content">
            <el-icon :size="32" :class="status.running ? 'icon-success' : 'icon-info'">
              <VideoPlay v-if="status.running" /><VideoPause v-else />
            </el-icon>
            <div>
              <div class="card-label">运行状态</div>
              <div class="card-value">
                <el-tag :type="status.running ? 'success' : 'info'" size="small">
                  {{ status.running ? '运行中' : '已停止' }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <div class="card-content">
            <el-icon :size="32" class="icon-primary"><Monitor /></el-icon>
            <div>
              <div class="card-label">监控设备</div>
              <div class="card-value">{{ config.devices?.length || 0 }} 台</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <div class="card-content">
            <el-icon :size="32" class="icon-warning"><WarningFilled /></el-icon>
            <div>
              <div class="card-label">今日异常</div>
              <div class="card-value">{{ todayAbnormal }} 条</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <div class="card-content">
            <el-icon :size="32" class="icon-info"><Clock /></el-icon>
            <div>
              <div class="card-label">上次执行</div>
              <div class="card-value" style="font-size: 14px">
                {{ status.lastRun || '未执行' }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <el-button type="primary" :loading="running" @click="handleRunOnce">
        <el-icon><Lightning /></el-icon> 立即执行
      </el-button>
      <el-button v-if="status.running" type="danger" @click="handleStop">
        <el-icon><VideoPause /></el-icon> 停止调度
      </el-button>
      <el-button v-else type="success" @click="handleStart">
        <el-icon><VideoPlay /></el-icon> 启动调度
      </el-button>
      <el-button @click="showHealth = true">
        <el-icon><FirstAidKit /></el-icon> 健康检查
      </el-button>
    </div>

    <!-- 最近审计记录 -->
    <el-card shadow="never" class="audit-card">
      <template #header>
        <div class="card-header">
          <span>最近审计记录</span>
          <el-button text type="primary" @click="$router.push('/log-monitor/audit')">
            查看全部 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </template>
      <el-table :data="recentAudit" stripe size="small" v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="device_name" label="设备" min-width="120" />
        <el-table-column prop="log_count" label="日志数" width="70" align="center" />
        <el-table-column prop="llm_summary" label="LLM 摘要" min-width="200" show-overflow-tooltip />
        <el-table-column label="异常" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.has_abnormal ? 'danger' : 'success'" size="small">
              {{ row.has_abnormal ? '异常' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="llm_ms" label="耗时" width="70" align="center">
          <template #default="{ row }">{{ row.llm_ms }}ms</template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="170" />
      </el-table>
      <el-empty v-if="!loading && recentAudit.length === 0" description="暂无审计记录" :image-size="60" />
    </el-card>

    <!-- 健康检查弹窗 -->
    <el-dialog v-model="showHealth" title="系统健康检查" width="500px">
      <div class="health-items">
        <div class="health-item">
          <el-icon :class="healthData?.log_server?.status === 'ok' ? 'icon-success' : 'icon-danger'">
            <CircleCheckFilled v-if="healthData?.log_server?.status === 'ok'" />
            <CircleCloseFilled v-else />
          </el-icon>
          <div>
            <div class="health-label">日志服务器</div>
            <div class="health-detail">
              {{ healthData?.log_server?.status === 'ok' ? `正常 (${healthData.log_server.latency_ms}ms)` : healthData?.log_server?.error || '异常' }}
            </div>
          </div>
        </div>
        <div class="health-item">
          <el-icon :class="healthData?.llm?.status === 'ok' ? 'icon-success' : 'icon-danger'">
            <CircleCheckFilled v-if="healthData?.llm?.status === 'ok'" />
            <CircleCloseFilled v-else />
          </el-icon>
          <div>
            <div class="health-label">LLM 服务</div>
            <div class="health-detail">
              {{ healthData?.llm?.status === 'ok' ? `正常 (${healthData.llm.latency_ms}ms)` : healthData?.llm?.error || '异常' }}
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showHealth = false">关闭</el-button>
        <el-button type="primary" @click="loadHealth">刷新</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  VideoPlay, VideoPause, Monitor, WarningFilled, Clock,
  Lightning, FirstAidKit, ArrowRight, CircleCheckFilled, CircleCloseFilled,
} from '@element-plus/icons-vue'
import {
  getConfig, getAuditList, runOnce, startScheduler,
  stopScheduler, getSchedulerStatus, getHealth,
} from '../../api/log-monitor'

const config = ref<any>({})
const status = ref<{ running: boolean; lastRun: string | null }>({ running: false, lastRun: null })
const recentAudit = ref<any[]>([])
const todayAbnormal = ref(0)
const loading = ref(false)
const running = ref(false)
const showHealth = ref(false)
const healthData = ref<any>(null)

async function loadData() {
  loading.value = true
  try {
    const [cfg, audit, st] = await Promise.all([
      getConfig(),
      getAuditList({ page: 1, pageSize: 10 }),
      getSchedulerStatus(),
    ])
    config.value = cfg
    recentAudit.value = audit.list
    status.value = st
    // 计算今日异常
    const today = new Date().toISOString().slice(0, 10)
    todayAbnormal.value = audit.list.filter((r: any) => r.created_at >= today && r.has_abnormal).length
  } finally {
    loading.value = false
  }
}

async function loadHealth() {
  healthData.value = await getHealth()
}

async function handleRunOnce() {
  running.value = true
  try {
    await runOnce()
    ElMessage.success('已触发执行')
    setTimeout(loadData, 2000)
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    running.value = false
  }
}

async function handleStart() {
  await startScheduler()
  ElMessage.success('调度器已启动')
  await loadData()
}

async function handleStop() {
  await stopScheduler()
  ElMessage.success('调度器已停止')
  await loadData()
}

onMounted(() => {
  loadData()
  loadHealth()
})
</script>

<style scoped>
.log-monitor-dashboard {
  padding: 0;
}
.status-cards {
  margin-bottom: 16px;
}
.status-card :deep(.el-card__body) {
  padding: 16px;
}
.card-content {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.card-value {
  font-size: 18px;
  font-weight: 600;
  margin-top: 4px;
}
.icon-success { color: var(--el-color-success); }
.icon-warning { color: var(--el-color-warning); }
.icon-danger { color: var(--el-color-danger); }
.icon-primary { color: var(--el-color-primary); }
.icon-info { color: var(--el-color-info); }
.action-bar {
  margin-bottom: 16px;
  display: flex;
  gap: 8px;
}
.audit-card {
  margin-top: 8px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.health-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.health-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.health-label {
  font-weight: 500;
}
.health-detail {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/views/log-monitor/LogMonitorView.vue
git commit -m "feat: add log monitor dashboard page"
```

---

### 任务 7：审计记录页面

**文件：**
- 创建：`src/views/log-monitor/LogMonitorAudit.vue`

- [ ] **步骤 1：创建审计记录页面**

```vue
<template>
  <div class="log-monitor-audit">
    <!-- 筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filter" size="default">
        <el-form-item label="设备">
          <el-input v-model="filter.device" placeholder="设备 ID" clearable />
        </el-form-item>
        <el-form-item label="异常状态">
          <el-select v-model="filter.abnormal" placeholder="全部" clearable style="width: 120px">
            <el-option label="全部" value="" />
            <el-option label="异常" value="1" />
            <el-option label="正常" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="filter.start_date" type="datetime" placeholder="开始" style="width: 180px" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="filter.end_date" type="datetime" placeholder="结束" style="width: 180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon> 筛选
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="records" stripe v-loading="loading" size="default">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="device_name" label="设备" min-width="140">
          <template #default="{ row }">
            <div>
              <div style="font-weight: 500">{{ row.device_name }}</div>
              <div style="font-size: 12px; color: var(--el-text-color-secondary)">{{ row.device_id }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="log_count" label="日志数" width="70" align="center" />
        <el-table-column prop="llm_summary" label="LLM 摘要" min-width="250" show-overflow-tooltip />
        <el-table-column label="异常" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.has_abnormal ? 'danger' : 'success'" size="small">
              {{ row.has_abnormal ? '异常' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="llm_ms" label="耗时" width="70" align="center">
          <template #default="{ row }">{{ row.llm_ms }}ms</template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="180" />
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="showDetail(row)">
              <el-icon><View /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="`审计详情 - ${detail.device_name} (#${detail.id})`" width="700px">
      <div class="detail-section">
        <div class="detail-label">LLM 摘要</div>
        <el-alert :title="detail.llm_summary || '(无摘要)'" :type="detail.has_abnormal ? 'error' : 'success'" :closable="false" />
      </div>
      <div class="detail-section">
        <div class="detail-label">原始日志（{{ detail.log_count }} 条）</div>
        <pre class="log-pre">{{ formattedLogs }}</pre>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, View } from '@element-plus/icons-vue'
import { getAuditList } from '../../api/log-monitor'

const filter = ref({ device: '', abnormal: '', start_date: '', end_date: '' })
const records = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<any>({})

const formattedLogs = computed(() => {
  try {
    const logs = JSON.parse(detail.value.raw_logs || '[]')
    return JSON.stringify(logs.slice(0, 100), null, 2)
  } catch {
    return detail.value.raw_logs || ''
  }
})

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filter.value.device) params.device = filter.value.device
    if (filter.value.abnormal) params.abnormal = filter.value.abnormal
    if (filter.value.start_date) params.start_date = new Date(filter.value.start_date).toISOString()
    if (filter.value.end_date) params.end_date = new Date(filter.value.end_date).toISOString()
    const res = await getAuditList(params)
    records.value = res.list
    total.value = res.total
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filter.value = { device: '', abnormal: '', start_date: '', end_date: '' }
  page.value = 1
  loadData()
}

function showDetail(row: any) {
  detail.value = row
  detailVisible.value = true
}

onMounted(loadData)
</script>

<style scoped>
.filter-card {
  margin-bottom: 16px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.detail-section {
  margin-bottom: 20px;
}
.detail-label {
  font-weight: 500;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.log-pre {
  background: var(--el-fill-color-darker);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  max-height: 400px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/views/log-monitor/LogMonitorAudit.vue
git commit -m "feat: add audit record page with filter, pagination and detail dialog"
```

---

### 任务 8：Admin 配置页面

**文件：**
- 创建：`src/views/admin/LogMonitorConfig.vue`

- [ ] **步骤 1：创建 admin 配置页面**

```vue
<template>
  <div class="log-monitor-config">
    <el-form ref="formRef" :model="form" label-width="120px" v-loading="loading">
      <!-- 日志服务器 -->
      <el-divider content-position="left">日志服务器</el-divider>
      <el-form-item label="基础 URL" prop="log_server.base_url">
        <el-input v-model="form.log_server.base_url" placeholder="http://127.0.0.1:8080" />
      </el-form-item>
      <el-form-item label="请求路径" prop="log_server.path">
        <el-input v-model="form.log_server.path" placeholder="/api/v1/logs?device_id={device_id}&start_time={start_time}&end_time={end_time}" />
      </el-form-item>
      <el-form-item label="分页大小" prop="log_server.page_size">
        <el-input-number v-model="form.log_server.page_size" :min="1" :max="10000" />
      </el-form-item>
      <el-form-item label="超时(秒)" prop="log_server.timeout">
        <el-input-number v-model="form.log_server.timeout" :min="1" :max="300" />
      </el-form-item>

      <!-- 监控设备 -->
      <el-divider content-position="left">监控设备</el-divider>
      <div v-for="(device, idx) in form.devices" :key="idx" class="device-row">
        <el-form-item :label="`设备 ${idx + 1}`" style="margin-bottom: 8px">
          <el-input v-model="device.device_id" placeholder="device_id" style="width: 180px; margin-right: 8px" />
          <el-input v-model="device.name" placeholder="设备名称" style="width: 180px; margin-right: 8px" />
          <el-button type="danger" text @click="removeDevice(idx)" :disabled="form.devices.length <= 1">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-form-item>
      </div>
      <el-button type="primary" text @click="addDevice" style="margin-bottom: 16px">
        <el-icon><Plus /></el-icon> 添加设备
      </el-button>

      <!-- LLM 配置 -->
      <el-divider content-position="left">LLM 配置</el-divider>
      <el-form-item label="API 端点" prop="llm.base_url">
        <el-input v-model="form.llm.base_url" placeholder="http://10.3.0.200:17002/v1" />
      </el-form-item>
      <el-form-item label="模型名称" prop="llm.model">
        <el-input v-model="form.llm.model" placeholder="Qwen3.5-9B-AWQ" />
      </el-form-item>
      <el-form-item label="API Key" prop="llm.api_key">
        <el-input v-model="form.llm.api_key" placeholder="EMPTY" show-password />
      </el-form-item>
      <el-form-item label="Temperature" prop="llm.temperature">
        <el-input-number v-model="form.llm.temperature" :min="0" :max="2" :step="0.1" />
      </el-form-item>
      <el-form-item label="最大 Tokens" prop="llm.max_tokens">
        <el-input-number v-model="form.llm.max_tokens" :min="1" :max="16384" />
      </el-form-item>
      <el-form-item label="超时(秒)" prop="llm.timeout">
        <el-input-number v-model="form.llm.timeout" :min="1" :max="600" />
      </el-form-item>
      <el-form-item label="重试次数" prop="llm.retries">
        <el-input-number v-model="form.llm.retries" :min="0" :max="10" />
      </el-form-item>

      <!-- 分析约束 -->
      <el-divider content-position="left">分析约束（System Prompt）</el-divider>
      <el-form-item label="提示词" prop="llm.system_prompt">
        <el-input
          v-model="form.llm.system_prompt"
          type="textarea"
          :rows="10"
          placeholder="定义 LLM 如何分析日志、关注哪些异常类型"
        />
      </el-form-item>

      <!-- 调度配置 -->
      <el-divider content-position="left">调度配置</el-divider>
      <el-form-item label="轮询间隔(秒)" prop="scheduler.interval">
        <el-input-number v-model="form.scheduler.interval" :min="10" :max="86400" />
      </el-form-item>
      <el-form-item label="时间窗口(秒)" prop="scheduler.window">
        <el-input-number v-model="form.scheduler.window" :min="1" :max="86400" />
      </el-form-item>

      <!-- 提交 -->
      <el-form-item>
        <el-button type="primary" @click="handleSave" :loading="saving">保存配置</el-button>
        <el-button @click="loadConfig">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { getConfig, updateConfig } from '../../api/log-monitor'

const form = ref<any>({
  log_server: {},
  devices: [],
  llm: {},
  scheduler: {},
})
const loading = ref(false)
const saving = ref(false)

async function loadConfig() {
  loading.value = true
  try {
    form.value = await getConfig()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function addDevice() {
  form.value.devices.push({ device_id: '', name: '' })
}

function removeDevice(idx: number) {
  form.value.devices.splice(idx, 1)
}

async function handleSave() {
  saving.value = true
  try {
    await updateConfig(form.value)
    ElMessage.success('配置已保存')
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

onMounted(loadConfig)
</script>

<style scoped>
.device-row {
  display: flex;
  align-items: center;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/views/admin/LogMonitorConfig.vue
git commit -m "feat: add admin log monitor config page"
```

---

### 任务 9：Admin LLM 测试页面

**文件：**
- 创建：`src/views/admin/LogMonitorLlmTest.vue`

- [ ] **步骤 1：创建 LLM 测试页面**

```vue
<template>
  <div class="llm-test-page">
    <el-card shadow="never">
      <template #header>
        <span>LLM 连通测试</span>
      </template>

      <!-- 当前配置 -->
      <el-descriptions :column="2" border size="default" class="config-info">
        <el-descriptions-item label="API 端点">{{ config.llm?.base_url || '未配置' }}</el-descriptions-item>
        <el-descriptions-item label="模型">{{ config.llm?.model || '未配置' }}</el-descriptions-item>
        <el-descriptions-item label="Temperature">{{ config.llm?.temperature }}</el-descriptions-item>
        <el-descriptions-item label="超时">{{ config.llm?.timeout }}s</el-descriptions-item>
      </el-descriptions>

      <div class="test-btn">
        <el-button type="primary" :loading="testing" @click="handleTest">
          <el-icon><VideoPlay /></el-icon> 开始测试连通性
        </el-button>
      </div>

      <!-- 测试结果 -->
      <div v-if="result" class="test-result">
        <el-alert
          :title="result.success ? `连接成功（耗时 ${result.latency_ms}ms）` : '连接失败'"
          :type="result.success ? 'success' : 'error'"
          :closable="false"
          show-icon
        >
          <template v-if="result.success && result.response">
            <div style="margin-top: 8px">
              <span style="color: var(--el-text-color-secondary)">返回内容：</span>
              <code>{{ result.response }}</code>
            </div>
          </template>
          <template v-if="!result.success && result.error">
            <div style="margin-top: 8px">
              <span style="color: var(--el-text-color-secondary)">错误：</span>
              <code>{{ result.error }}</code>
            </div>
          </template>
        </el-alert>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay } from '@element-plus/icons-vue'
import { getConfig, testLLM } from '../../api/log-monitor'

const config = ref<any>({})
const result = ref<any>(null)
const testing = ref(false)

async function loadConfig() {
  try {
    config.value = await getConfig()
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

async function handleTest() {
  testing.value = true
  result.value = null
  try {
    result.value = await testLLM()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    testing.value = false
  }
}

onMounted(loadConfig)
</script>

<style scoped>
.config-info {
  margin-bottom: 20px;
}
.test-btn {
  margin-bottom: 20px;
  text-align: center;
}
.test-result {
  margin-top: 16px;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/views/admin/LogMonitorLlmTest.vue
git commit -m "feat: add admin LLM test page"
```

---

### 任务 10：路由与导航

**文件：**
- 修改：`src/router/index.ts`
- 修改：`src/views/admin/AdminView.vue`
- 修改：`src/views/HomeView.vue`

- [ ] **步骤 1：在 router/index.ts 中添加路由**

在 routes 数组中添加：

```ts
{
  path: '/log-monitor',
  name: 'LogMonitor',
  component: () => import('../views/log-monitor/LogMonitorView.vue'),
  meta: { title: '日志监控', icon: 'DataAnalysis' },
},
{
  path: '/log-monitor/audit',
  name: 'LogMonitorAudit',
  component: () => import('../views/log-monitor/LogMonitorAudit.vue'),
  meta: { title: '审计记录', icon: 'Document' },
},
```

在 admin 路由的 children 数组中添加（atcom-config 之后）：

```ts
{
  path: 'log-monitor',
  name: 'AdminLogMonitor',
  component: () => import('../views/admin/LogMonitorConfig.vue'),
  meta: { title: '日志监控配置' },
},
{
  path: 'log-monitor/llm-test',
  name: 'AdminLogMonitorLlmTest',
  component: () => import('../views/admin/LogMonitorLlmTest.vue'),
  meta: { title: 'LLM 连通测试' },
},
```

- [ ] **步骤 2：在 AdminView.vue 添加菜单项**

在 menuItems 数组中，atcom 子项之后添加：

```ts
{
  key: 'log-monitor',
  label: '日志监控',
  icon: DataAnalysis,
  children: [
    { key: 'log-monitor', label: '监控配置', route: '/admin/log-monitor' },
    { key: 'log-monitor/llm-test', label: 'LLM 测试', route: '/admin/log-monitor/llm-test' },
  ],
},
```

需要在 import 中添加 `DataAnalysis`：

```ts
import {
  DataBoard, Document, Monitor, Printer,
  FolderOpened, HomeFilled, ShoppingBag, Phone, DataAnalysis
} from '@element-plus/icons-vue'
```

- [ ] **步骤 3：在 HomeView.vue 添加日志监控卡片**

在最后一个 big-card 之后（`card-gold` 之后）添加：

```vue
<div class="big-card card-red" @click="$router.push('/log-monitor')">
  <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
  <div class="card-icon-wrap"><el-icon :size="32"><DataAnalysis /></el-icon></div>
  <div class="card-body"><h3>日志监控</h3><p>网络设备日志 LLM 分析与异常检测</p></div>
  <div class="card-stat">
    <span class="stat-num">{{ totalDevices }}</span>
    <span class="stat-label">台设备</span>
  </div>
</div>
```

需要在 import 中添加 `DataAnalysis`，在 script 中添加：

```ts
import { DataAnalysis } from '@element-plus/icons-vue'
// ...
const totalDevices = ref(0)
// onMounted 或 setup 中加载设备数
import { getConfig } from '../../api/log-monitor'
getConfig().then(cfg => { totalDevices.value = cfg.devices?.length || 0 }).catch(() => {})
```

- [ ] **步骤 4：验证**

```bash
npm run dev
```

访问：
- http://localhost:5173/log-monitor → 仪表盘
- http://localhost:5173/log-monitor/audit → 审计记录
- http://localhost:5173/admin/log-monitor → 配置页面
- http://localhost:5173/admin/log-monitor/llm-test → LLM 测试

- [ ] **步骤 5：Commit**

```bash
git add src/router/index.ts src/views/admin/AdminView.vue src/views/HomeView.vue
git commit -m "feat: add routes and navigation for log monitor module"
```

---

### 任务 11：端到端验证

- [ ] **步骤 1：启动完整服务**

```bash
npm run dev
```

- [ ] **步骤 2：测试 LLM 连通性**

→ 打开 http://localhost:5173/admin/log-monitor/llm-test → 点击"开始测试连通性"

预期：显示连接成功或失败（取决于 LLM 服务是否在线）

- [ ] **步骤 3：手动触发分析**

→ 打开 http://localhost:5173/log-monitor → 点击"立即执行"

预期：2 秒后页面刷新，出现新的审计记录

- [ ] **步骤 4：查看审计记录**

→ 打开 http://localhost:5173/log-monitor/audit

预期：能看到刚才触发的审计记录，点击查看详情可见原始日志

- [ ] **步骤 5：修改配置**

→ 打开 http://localhost:5173/admin/log-monitor → 修改 System Prompt → 保存

→ 再次触发分析，LLM 摘要风格应按新提示词变化

- [ ] **步骤 6：健康检查**

→ 仪表盘页面点击"健康检查"

预期：显示日志服务器和 LLM 服务的连通状态

---

## 自检清单

- [x] 规格覆盖度：所有功能模块（拉取、分析、审计、调度、配置、健康检查、UI）均有对应任务
- [x] 无占位符：每个步骤包含实际代码或命令
- [x] 类型一致性：`LogConfig`、`LogEntry`、`LLMResult`、`HealthStatus` 在各任务间一致
- [x] 无"后续实现"：第一版范围内的功能全部覆盖

---

*创建时间：2026-06-20*
*版本：1.0*
