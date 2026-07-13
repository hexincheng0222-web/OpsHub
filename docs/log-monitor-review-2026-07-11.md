# 日志监控仪表盘 — 评审与实现细则

> 评审时间：2026-07-11
> 评审范围：`src/views/log-monitor/LogMonitorView.vue`（仪表盘）、`src/views/log-monitor/LogMonitorAudit.vue`（审计）、`src/api/log-monitor.ts`、`server/routes/log-monitor.ts`、`server/logMonitor.ts`（核心：调度器 + Loki 查询 + LLM 分析 + 设备发现 + 健康检查）、`server/db.ts`（`log_audit` 表 L1313-1327）、`src/router/index.ts`（L101-111）、`src/views/admin/LogMonitorConfig.vue`、`src/views/admin/LogMonitorLlmTest.vue`（配置页）
> 评审人：AtomCode
> 文档定位：v1（总览 + 优先级）与 v2（每项实现逻辑 + 代码片段）合并版，一份文档自洽可执行。

---

## 目录

- [一、现状速览](#一现状速览)
- [二、问题与优化意见](#二问题与优化意见)
  - [2.1 P0 必须修复（3 项）](#21-p0-必须修复3-项)
  - [2.2 P1 健壮性 + UX（6 项）](#22-p1-健壮性--ux6-项)
  - [2.3 P2 代码质量（3 项）](#23-p2-代码质量3-项)
- [三、新增功能实现逻辑（2 项）](#三新增功能实现逻辑2-项)
- [四、优先级路线图 + 工作量预估](#四优先级路线图--工作量预估)
- [五、验证清单](#五验证清单)
- [六、关键文件清单](#六关键文件清单)

---

## 一、现状速览

### 1.1 文件与职责

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| 仪表盘视图 | `src/views/log-monitor/LogMonitorView.vue` | 设备卡片网格 + 时间范围切换 + 自动刷新 + 调度器启停 + 卡片详情弹窗 + 手动 AI 分析 |
| 审计视图 | `src/views/log-monitor/LogMonitorAudit.vue` | 审计记录分页表格 + 筛选（设备/异常/日期） + 详情弹窗 |
| API 层 | `src/api/log-monitor.ts` | 12 个接口：getConfig/updateConfig/getAuditList/startScheduler/stopScheduler/testLLM/getDashboard/analyzeDevice/discoverDevices/testLokiConnection |
| 后端路由 | `server/routes/log-monitor.ts` | 10 个路由：config CRUD + audit 分页/清理 + run-once + analyze-device + scheduler 控制 + llm/loki 测试 + dashboard + health + discover |
| 核心逻辑 | `server/logMonitor.ts` | `loadConfig`/`saveConfigPartial` + `fetchLokiLogs`（Loki query_range）+ `analyzeLogs`（LLM POST 重试）+ `saveAudit`/`cleanupAudit` + `healthCheck` + `startScheduler`/`stopScheduler`（node-cron）+ `discoverDevices`（IP↔hostname 关联）+ `getDashboardData`（并行查所有设备） |
| DB | `server/db.ts` L1313-1327 | `log_audit` 表（id/device_id/device_name/log_count/raw_logs（废弃，改存空）/log_file_path（新，文件路径指针）/llm_summary/has_abnormal/llm_ms/created_at）+ 3 个索引 |
| 配置页 | `src/views/admin/LogMonitorConfig.vue` | Loki 地址 + 设备列表 + LLM 配置 + 调度器间隔/窗口 |
| 路由 | `src/router/index.ts` L101-111 | `/log-monitor`（仪表盘）+ `/log-monitor/audit`（审计）+ `/admin/log-monitor`（配置）+ `/admin/log-monitor/llm-test`（LLM 测试） |

### 1.2 数据模型

```sql
-- log_audit 表（审计记录，调度器或手动分析后落库）
CREATE TABLE log_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id   TEXT    NOT NULL,           -- 设备 IP
  device_name TEXT    NOT NULL,           -- 设备名（hostname 或配置名）
  log_count   INTEGER NOT NULL DEFAULT 0,
  raw_logs    TEXT    NOT NULL DEFAULT '', -- 已废弃（改存空），全文迁移到 data/log-audit/ 文件
  log_file_path TEXT  NOT NULL DEFAULT '', -- 新增：外置日志文件路径指针
  llm_summary TEXT    NOT NULL DEFAULT '', -- LLM 摘要
  has_abnormal INTEGER NOT NULL DEFAULT 0, -- 0/1
  llm_ms      INTEGER NOT NULL DEFAULT 0,  -- LLM 耗时
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_log_audit_device   ON log_audit(device_id);
CREATE INDEX idx_log_audit_abnormal ON log_audit(has_abnormal);
CREATE INDEX idx_log_audit_created  ON log_audit(created_at);
```

**关键现状**：`raw_logs` 全文 JSON 存所有日志，500 条日志 × 每条 500 字 = 250KB/审计，30 天后表体积膨胀 → §2.1.3 改为「文件外置 + 7 天滚动」，DB 只存路径指针 `log_file_path`，全文按 `data/log-audit/YYYY-MM-DD/` 分日隔离，7 天后整目录删除。

### 1.3 仪表盘渲染链路现状

```
LogMonitorView.vue onMounted
  → loadDashboard() → getDashboard(timeRange)
  → 后端 GET /dashboard?time_range=1h
  → getDashboardData(timeRange)
       → loadConfig()
       → discoverDevices()  ← 每次都从 Loki 查 7 天日志建 IP↔hostname 映射
       → 若 config.devices 非空，过滤只显示已配置的设备
       → 并行 Promise.all：每设备 fetchLokiLogs(hostname, startTime, now)
            → Loki query_range {job="syslog", host="hostname"}
            → 解析 stream.values，JSON.parse 取 message，parseLogLevel 推断级别
            → 返回 LogEntry[]（ts/level/msg，msg 截断 500 字）
       → 若 scheduler_running，每设备查 log_audit 最新一条取 analysis
       → 返回 { devices, scheduler_running, last_analysis_time }
  → 前台 dashData.devices 渲染卡片网格
       → 卡片：状态点 + 设备名/IP + 日志数 tag + 最近 5 条日志预览 + AI 分析摘要 + 耗时
       → 点卡片打开 el-dialog 详情：基本信息 + AI 分析 + 完整日志
  → 自动刷新：setInterval(loadDashboard, autoRefresh)
```

### 1.4 调度器现状（`server/logMonitor.ts` startScheduler）

```
cron.schedule('*/${interval} * * * *')
  → lastRunTime = new Date()
  → discoverDevices()（每轮都查 Loki 7 天日志建映射）
  → for (device of deviceList):
       fetchLokiLogs(hostname, startTime, endTime, 10000)
       analyzeLogs(logs, system_prompt)  ← LLM POST，重试 3 次
       saveAudit(device, logs, result)   ← 落 log_audit
```

---

## 二、问题与优化意见

分级标识：🔴 必须修复 · 🟠 建议修复 · 🟡 仅供参考。

### 2.1 P0 必须修复（3 项）

#### 2.1.1 🔴 Dashboard 每次刷新都全量重查 Loki + 重发现设备，10 秒刷新时压垮 Loki

**现状**：`getDashboardData`（`server/logMonitor.ts` L511-579）每次调用都 `discoverDevices()`（查 Loki 7 天日志）+ 并行 `fetchLokiLogs` 所有设备。前台自动刷新选 5 秒时，每 5 秒打一次 Loki 两个接口（discover + query_range × N 设备），设备 20 台时每 5 秒 21 个请求。

**现状代码**：

```ts
// server/logMonitor.ts getDashboardData
let discoveredDevices = await discoverDevices()  // ← 每次都查 Loki 7 天日志
const devicePromises = discoveredDevices.map(async (device) => {
  const logs = await fetchLokiLogs(device.hostname, startTime, now)  // ← 每设备一次 query_range
  // ...
})
```

**修复逻辑**：设备发现缓存 + 日志查询节流。

```ts
// server/logMonitor.ts 新增设备发现缓存
let deviceCache: { devices: DiscoveredDevice[]; ts: number } | null = null
const DEVICE_CACHE_TTL = 5 * 60 * 1000  // 5 分钟

async function getCachedDevices(): Promise<DiscoveredDevice[]> {
  if (deviceCache && Date.now() - deviceCache.ts < DEVICE_CACHE_TTL) {
    return deviceCache.devices
  }
  const devices = await discoverDevices()
  deviceCache = { devices, ts: Date.now() }
  return devices
}

// getDashboardData 改用：
const discoveredDevices = await getCachedDevices()
```

日志查询节流：同时间窗口内重复请求复用结果。

```ts
// server/logMonitor.ts 新增日志查询缓存
const logQueryCache = new Map<string, { logs: LogEntry[]; ts: number }>()
const LOG_CACHE_TTL = 10_000  // 10 秒内同设备同窗口复用

async function fetchLokiLogsCached(hostname: string, start: Date, end: Date) {
  const key = `${hostname}|${start.getTime()}|${end.getTime()}`
  const cached = logQueryCache.get(key)
  if (cached && Date.now() - cached.ts < LOG_CACHE_TTL) return cached.logs
  const logs = await fetchLokiLogs(hostname, start, end)
  logQueryCache.set(key, { logs, ts: Date.now() })
  // 清理过期 key
  if (logQueryCache.size > 100) {
    for (const [k, v] of logQueryCache) {
      if (Date.now() - v.ts > LOG_CACHE_TTL) logQueryCache.delete(k)
    }
  }
  return logs
}
```

**验证点**：前台 5 秒自动刷新时，网络面板 Loki 请求数应从「每 5 秒 N+1 个」降到「首次 N+1，之后 0 个（命中缓存）」。

---

#### 2.1.2 🔴 analyzeLogs 把全部日志 JSON.stringify 发给 LLM，60000 字符截断丢上下文

**现状**：`server/logMonitor.ts` L157-212，`analyzeLogs` 把 `logs` 数组 `JSON.stringify` 后硬截断到 60000 字符，截断处可能 mid-JSON 导致 LLM 收到残缺日志，分析结果片面或误判。

**现状代码**：

```ts
const compact = JSON.stringify(logs, null, 0)
const truncated = compact.length > 60000 ? compact.slice(0, 60000) + '\n...[truncated]' : compact
```

**修复逻辑**：按日志条数智能采样，优先保留 error/warning 级别。

```ts
export async function analyzeLogs(logs: LogEntry[], systemPrompt: string): Promise<LLMResult> {
  if (!logs.length) return { summary: '本批次无日志。', has_abnormal: false, _llm_ms: 0 }

  // 智能采样：优先 error/warning，其次按时间均匀采样
  const errorLogs = logs.filter(l => l.level === 'error' || l.level === 'ERROR')
  const warningLogs = logs.filter(l => l.level === 'warning' || l.level === 'WARN')
  const otherLogs = logs.filter(l => !errorLogs.includes(l) && !warningLogs.includes(l))

  // error 全保留，warning 保留前 50 条，其他按时间均匀采样到 100 条
  const sampled = [
    ...errorLogs,
    ...warningLogs.slice(0, 50),
    ...sampleEvenly(otherLogs, 100),
  ].slice(0, 200)  // 总上限 200 条

  const compact = JSON.stringify(sampled, null, 0)
  // 双保险：若仍超长再硬截断，但 200 条通常 < 60KB
  const truncated = compact.length > 60000 ? compact.slice(0, 60000) + '\n...[truncated]' : compact
  // ... 原逻辑
}

function sampleEvenly(logs: LogEntry[], target: number): LogEntry[] {
  if (logs.length <= target) return logs
  const step = Math.ceil(logs.length / target)
  const result: LogEntry[] = []
  for (let i = 0; i < logs.length; i += step) result.push(logs[i])
  return result
}
```

**验证点**：1000 条日志（含 5 条 error）时，LLM 应收到 5 条 error + 50 条 warning + 100 条均匀采样 = 155 条，而非前 200 条原始序。

---

#### 2.1.3 🔴 raw_logs 全文入库，30 天后 log_audit 表体积膨胀 → 改「文件外置 + 7 天滚动」

**现状**：`saveAudit`（`server/logMonitor.ts` L234-247）把 `JSON.stringify(logs)` 全文存 `raw_logs`，500 条日志 × 500 字 = 250KB/行，每天调度 144 次 × 20 设备 = 2880 行/天 = 720MB/天。

**现状代码**：

```ts
export function saveAudit(device: DeviceConfig, logs: LogEntry[], result: LLMResult): number {
  const row = db.prepare(
    'INSERT INTO log_audit (device_id, device_name, log_count, raw_logs, llm_summary, has_abnormal, llm_ms) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    device.device_id,
    device.name,
    logs.length,
    JSON.stringify(logs),  // ← 全文存，250KB/行
    // ...
  )
}
```

**修复逻辑**：`raw_logs` 从「DB 内嵌」改为「文件外置 + 7 天滚动」，DB 只存路径指针。摘要/标志/耗时等轻量列仍存 DB（趋势看板、审计列表筛分页要用）。

**DB 迁移**（`server/db.ts`）：

```ts
// 迁移：log_audit 新增 log_file_path 列，废弃 raw_logs（保留列但不再写入，向后兼容）
const auditCols = db.prepare("PRAGMA table_info(log_audit)").all() as { name: string }[]
if (auditCols.length > 0 && !auditCols.some(c => c.name === 'log_file_path')) {
  db.exec("ALTER TABLE log_audit ADD COLUMN log_file_path TEXT NOT NULL DEFAULT ''")
  console.log('[db] 已添加 log_audit.log_file_path 列')
}
// 可选：旧数据迁移，把 raw_logs 写出到文件再清空字段（省 DB 空间）
```

**文件组织**：按「日期/设备IP-时间戳-batchId」分文件，7 天后按日期目录整体删除。

```
data/log-audit/
  2026-07-12/                        # 日期目录（7 天清理的最小单位）
    192.168.1.10-1468300000-42.json  # 设备IP-毫秒时间戳-batchId
    192.168.1.10-1468300600-43.json  # 同设备同日多批次，互不覆盖
    192.168.1.11-1468300000-42.json
  2026-07-11/
    ...
```

**saveAudit 改造**（`server/logMonitor.ts`）：

```ts
import fs from 'node:fs'
import path from 'node:path'

export function saveAudit(device: DeviceConfig, logs: LogEntry[], result: LLMResult): number {
  // 1) 全文写到 data/log-audit/YYYY-MM-DD/设备IP-毫秒-batchId.json
  const dateStr = new Date().toISOString().slice(0, 10)
  const dir = path.join('data', 'log-audit', dateStr)
  fs.mkdirSync(dir, { recursive: true })
  const fileName = `${device.device_id}-${Date.now()}.json`
  const filePath = path.join(dir, fileName)
  fs.writeFileSync(filePath, JSON.stringify(logs))

  // 2) DB 只存路径指针 + 轻量摘要列（< 1KB/行）
  const row = db.prepare(
    'INSERT INTO log_audit (device_id, device_name, log_count, raw_logs, log_file_path, llm_summary, has_abnormal, llm_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    device.device_id,
    device.name,
    logs.length,
    '',              // raw_logs 留空（向后兼容，旧代码可能读它）
    filePath,        // ← 新列：文件路径指针
    result.summary,
    result.has_abnormal ? 1 : 0,
    result._llm_ms || 0,
  )
  return row.lastrowid as number
}
```

**7 天滚动清理**（`server/logMonitor.ts` 启动时挂 cron，替代原 `cleanupAudit` SQL DELETE）：

```ts
import cron from 'node-cron'

// 启动时注册：每天凌晨 4 点删 8 天前的日期目录
cron.schedule('0 4 * * *', () => {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const baseDir = path.join('data', 'log-audit')
  if (!fs.existsSync(baseDir)) return
  for (const d of fs.readdirSync(baseDir)) {
    if (d < cutoff) {
      fs.rmSync(path.join(baseDir, d), { recursive: true, force: true })
      console.log(`[log-audit] 已清理 7 天前目录: ${d}`)
    }
  }
  // 同步清 DB 里指向已删文件的行（保留摘要行用于趋势看板，只清过期指针）
  db.prepare("UPDATE log_audit SET log_file_path = '' WHERE log_file_path != '' AND log_file_path < ?").run(
    path.join(baseDir, cutoff, 'x')  // 字典序 cutoff 之前的路径
  )
})
```

**新接口：审计详情读文件**（`server/routes/log-monitor.ts`）：

```ts
// GET /api/v1/log-monitor/audit/:id/logs  — 读外置日志文件返回
import fs from 'node:fs'

router.get('/audit/:id/logs', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效 ID' })
  const row = db.prepare('SELECT log_file_path, raw_logs FROM log_audit WHERE id = ?').get(id) as any
  if (!row) return res.status(404).json({ code: 404, message: '审计记录不存在' })

  // 兼容旧数据：log_file_path 为空时回退到 raw_logs
  if (row.log_file_path && fs.existsSync(row.log_file_path)) {
    try {
      const logs = JSON.parse(fs.readFileSync(row.log_file_path, 'utf-8'))
      return res.json({ code: 0, data: { logs, source: 'file' } })
    } catch (e: any) {
      console.warn(`[audit] 读文件失败 ${row.log_file_path}:`, e.message)
    }
  }
  // 回退：旧数据 raw_logs 或文件已被清理
  try {
    const logs = JSON.parse(row.raw_logs || '[]')
    res.json({ code: 0, data: { logs, source: 'db', expired: logs.length === 0 } })
  } catch {
    res.json({ code: 0, data: { logs: [], source: 'db', expired: true } })
  }
})
```

**前台审计详情改造**（`LogMonitorAudit.vue`）：

```ts
// 原：直接 JSON.parse(detail.raw_logs)
// 改：调新接口读文件
async function loadAuditLogs(id: number) {
  try {
    const res = await request<{ logs: any[]; source: string; expired?: boolean }>(
      `${BASE}/audit/${id}/logs`
    )
    parsedLogs.value = res.logs
    logParseError.value = res.expired === true && res.logs.length === 0
    if (res.expired) ElMessage.info('该批次日志已超 7 天保留期，仅保留摘要')
  } catch {
    parsedLogs.value = []
    logParseError.value = true
  }
}

watch(detailVisible, async (v) => {
  if (!v || !detail.value?.id) return
  await loadAuditLogs(detail.value.id)
})
```

**收益对比**：

| 指标 | 现状（DB 内嵌） | 改后（文件外置 + 7 天滚动） |
| --- | --- | --- |
| DB 行体积 | 250KB/行 | < 1KB/行（只剩摘要+路径） |
| 每天增量 | 720MB | < 5MB（DB）+ 文件按日隔离 |
| 7 天清理成本 | `DELETE FROM ... WHERE created_at <` + VACUUM（SQLite 不自动回收空间） | `rm -rf data/log-audit/2026-07-05/`（O(1)） |
| 审计详情查看 | 直接 `JSON.parse(raw_logs)` | 多一次 API 调读文件，但数据更完整（全文而非截断） |

**验证点**：
1. 调度运行 1 天后 `SELECT AVG(LENGTH(raw_logs)) FROM log_audit` 应 = 0（不再写该列），`SELECT AVG(LENGTH(log_file_path))` 应 < 60 字符
2. 审计详情页查看新记录应显示完整日志（source: file）；查看 8 天前记录应提示「已超 7 天保留期」
3. `data/log-audit/` 目录下只保留最近 7 个日期目录

---

### 2.2 P1 健壮性 + UX（6 项）

#### 2.2.1 🟠 Dashboard 无骨架屏/加载占位，刷新时卡片闪退

**现状**：`LogMonitorView.vue` L48-127，`loadDashboard` 期间 `dashData` 仍是旧数据，卡片不闪但内容跳变；首次加载时白屏无反馈。

**修复逻辑**：加骨架屏 + 刷新遮罩。

```vue
<!-- LogMonitorView.vue 设备网格区 -->
<el-row v-if="loading && !dashData" :gutter="16" class="device-grid">
  <el-col v-for="i in 4" :key="i" :xs="24" :sm="24" :md="12" :lg="12" class="device-col">
    <el-skeleton animated>
      <template #template>
        <div style="padding: 16px;">
          <el-skeleton-item variant="text" style="width: 50%; margin-bottom: 12px;" />
          <el-skeleton-item variant="rect" style="height: 96px; margin-bottom: 12px;" />
          <el-skeleton-item variant="rect" style="height: 60px;" />
        </div>
      </template>
    </el-skeleton>
  </el-col>
</el-row>
<el-row v-else :gutter="16" class="device-grid" v-loading="loading">
  <!-- 原卡片 -->
</el-row>
```

**验证点**：首次加载显示 4 个骨架卡片；后续刷新显示半透明遮罩，卡片不跳变。

---

#### 2.2.2 🟠 详情弹窗日志无分页/无搜索，500 条日志全渲染卡顿

**现状**：`LogMonitorView.vue` L180-191，详情弹窗 `v-for="(log, i) in drawerDevice.logs"` 全量渲染，500 条时 DOM 节点 500 个，滚动卡顿。

**修复逻辑**：加虚拟滚动或分页 + 日志级别筛选。

```vue
<!-- 详情弹窗完整日志区 -->
<div class="drawer-section">
  <div class="drawer-section-header">
    <div class="drawer-label">完整日志 ({{ drawerDevice.log_count }} 条)</div>
    <el-select v-model="logLevelFilter" size="small" placeholder="全部级别" clearable style="width: 120px">
      <el-option label="Error" value="error" />
      <el-option label="Warning" value="warning" />
      <el-option label="Info" value="info" />
    </el-select>
  </div>
  <div v-if="filteredDrawerLogs.length" class="drawer-logs">
    <div
      v-for="(log, i) in displayedDrawerLogs"
      :key="i"
      class="log-line"
      :class="'log-' + log.level.toLowerCase()"
    >
      <span class="log-time">{{ log.ts || '--:--' }}</span>
      <span class="log-level">{{ log.level }}</span>
      <span class="log-msg-full">{{ log.msg }}</span>
    </div>
    <el-button v-if="displayedCount < filteredDrawerLogs.length" text size="small" @click="loadMoreLogs">
      加载更多（{{ filteredDrawerLogs.length - displayedCount }} 条剩余）
    </el-button>
  </div>
</div>
```

```ts
const logLevelFilter = ref('')
const displayedCount = ref(50)
const filteredDrawerLogs = computed(() => {
  if (!drawerDevice.value) return []
  const logs = drawerDevice.value.logs
  if (!logLevelFilter.value) return logs
  return logs.filter(l => l.level.toLowerCase() === logLevelFilter.value)
})
const displayedDrawerLogs = computed(() => filteredDrawerLogs.value.slice(0, displayedCount.value))
function loadMoreLogs() { displayedCount.value += 50 }
watch(drawerVisible, (v) => { if (v) displayedCount.value = 50 })  // 重置
``

**验证点**：500 条日志时弹窗仅渲染 50 条，点「加载更多」追加；选 Error 级别只显示 error 日志。

---

#### 2.2.3 🟠 审计页日志解析失败显示空，且 slice(0,100) 硬截断（配合 §2.1.3 文件外置改造）

**现状**：`LogMonitorAudit.vue` L114-121，`formattedLogs` 直接 `JSON.parse(detail.raw_logs)`，解析失败返回原始字符串，成功时 `slice(0, 100)` 硬截断前 100 条，无分页。§2.1.3 改文件外置后，`raw_logs` 列已废弃为空，此段必须同步改造为调新接口 `/audit/:id/logs` 读文件。

**现状代码**：

```ts
const formattedLogs = computed(() => {
  try {
    const logs = JSON.parse(detail.value.raw_logs || '[]')  // ← §2.1.3 后 raw_logs 永远为空，此处必失败
    return JSON.stringify(logs.slice(0, 100), null, 2)  // ← 硬截断前 100 条
  } catch {
    return detail.value.raw_logs || ''  // ← 显示空字符串
  }
})
```

**修复逻辑**：改为调 `/audit/:id/logs` 接口读外置文件 + 按级别筛选 + 分页展示 + 文件已过期友好提示。

```ts
const logParseError = ref(false)
const logExpired = ref(false)  // §2.1.3 文件已被 7 天清理
const parsedLogs = ref<any[]>([])
const formattedLogs = computed(() => JSON.stringify(displayedParsedLogs.value, null, 2))
const displayedParsedLogs = computed(() => {
  const filtered = logLevelFilter.value
    ? parsedLogs.value.filter(l => l.level?.toLowerCase() === logLevelFilter.value)
    : parsedLogs.value
  return filtered.slice(0, displayCount.value)
})

async function loadAuditLogs(id: number) {
  logParseError.value = false
  logExpired.value = false
  parsedLogs.value = []
  displayCount.value = 50
  try {
    const res = await request<{ logs: any[]; source: string; expired?: boolean }>(
      `${BASE}/audit/${id}/logs`
    )
    parsedLogs.value = res.logs
    logExpired.value = res.expired === true && res.logs.length === 0
    if (logExpired.value) ElMessage.info('该批次日志已超 7 天保留期，仅保留摘要')
  } catch {
    logParseError.value = true
  }
}

watch(detailVisible, async (v) => {
  if (!v || !detail.value?.id) return
  await loadAuditLogs(detail.value.id)
})
```

```vue
<el-alert v-if="logExpired" type="info" :closable="false" title="该批次日志已超 7 天保留期，仅保留摘要" />
<el-alert v-else-if="logParseError" type="error" :closable="false" title="日志读取失败，文件可能损坏" />
<pre v-else class="log-pre">{{ formattedLogs || '(空)' }}</pre>
```

**验证点**：查看新审计记录应显示完整日志（source: file）；查看 8 天前记录应提示「已超 7 天保留期」；100 条以上日志可分页查看。

---

#### 2.2.4 🟠 时间范围切换无防抖，快速切换发多个并发请求

**现状**：`LogMonitorView.vue` L212-215，`watch(timeRange)` 有 300ms setTimeout 防抖，但未取消正在进行的 `loadDashboard`，快速切换 5 次会发 5 个请求，最后完成的可能不是最新时间范围的数据。

**现状代码**：

```ts
watch(timeRange, () => {
  if (timeRangeTimer) clearTimeout(timeRangeTimer)
  timeRangeTimer = setTimeout(() => loadDashboard(), 300)
})
```

**修复逻辑**：加请求版本号，丢弃过期响应。

```ts
let requestId = 0
async function loadDashboard() {
  const myId = ++requestId
  loading.value = true
  try {
    const data = await getDashboard(timeRange.value)
    if (myId !== requestId) return  // 已被新请求取代，丢弃
    dashData.value = data
  } catch (e: any) {
    if (myId === requestId) ElMessage.error('加载失败: ' + e.message)
  } finally {
    if (myId === requestId) loading.value = false
  }
}
```

**验证点**：快速切换时间范围 5 次，最终 `dashData` 应只反映最后一次的请求结果。

---

#### 2.2.5 🟠 fetchLokiLogs 失败静默返回空数组，用户无法区分「Loki 故障」与「设备无日志」

**现状**：`server/logMonitor.ts` L488-490，`fetchLokiLogs` catch 后 `return []`，仪表盘显示「0 条日志」，但实际可能是 Loki 连不通、超时、查询语法错误。

**现状代码**：

```ts
try {
  // ... Loki fetch
  return results
} catch {
  return []  // ← 静默失败
}
```

**修复逻辑**：区分「无日志」与「查询失败」，返回结构带错误标记。

```ts
export interface LokiResult {
  logs: LogEntry[]
  error?: string  // 查询失败时填错误信息
}

export async function fetchLokiLogs(hostname: string, start: Date, end: Date, limit: number = 2000): Promise<LokiResult> {
  // ...
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return { logs: [], error: `Loki HTTP ${res.status}` }
    // ... 解析
    return { logs: results }
  } catch (e: any) {
    return { logs: [], error: e.message || 'Loki 查询超时' }
  }
}
``

`getDashboardData` 把 error 透传到前端，卡片显示「Loki 查询失败：xxx」而非「0 条日志」。

```ts
// getDashboardData 改造
const { logs, error } = await fetchLokiLogsCached(device.hostname, startTime, now)
return {
  // ...
  log_count: logs.length,
  logs: logs.map(l => ({ ...l })),
  loki_error: error,  // ← 新增
}
``

```vue
<!-- 卡片日志预览区 -->
<div v-if="device.loki_error" class="error-box">Loki 查询失败：{{ device.loki_error }}</div>
<div v-else-if="device.logs.length" class="log-preview">...</div>
<div v-else class="no-data-box">暂无日志数据</div>
``

**验证点**：Loki 关闭后仪表盘卡片应显示「Loki 查询失败：xxx」，而非「0 条日志」。

---

#### 2.2.6 🟠 调度器间隔最小单位是分钟，5 分钟间隔漏关键 error 日志

**现状**：`startScheduler` L367，`cronExpr = `*/${interval} * * * *`，interval 配置项单位是秒但 cron 表达式用秒会报错（node-cron 不支持秒级），实际最小间隔 1 分钟。error 日志可能 30 秒内爆发又恢复，1 分钟间隔漏报。

**修复逻辑**：用 `setInterval` 替代 cron 支持秒级，或保留 cron 但间隔改分钟单位 + 文档说明。

```ts
// server/logMonitor.ts 改造 startScheduler
let intervalTimer: NodeJS.Timeout | null = null

export function startScheduler(): void {
  if (intervalTimer) return
  const cfg = loadConfig()
  const intervalSec = cfg.scheduler?.interval || 300
  lastRunTime = new Date()
  intervalTimer = setInterval(async () => {
    lastRunTime = new Date()
    // ... 原 cron 回调逻辑
  }, intervalSec * 1000)
  setConfig('scheduler_running', true)
}

export function stopScheduler(): void {
  if (intervalTimer) { clearInterval(intervalTimer); intervalTimer = null }
  setConfig('scheduler_running', false)
}
```

**配置页说明**：间隔单位改为秒，配置页提示「建议 60-300 秒，过短会增加 LLM 负载」。

**验证点**：配置间隔 30 秒，调度器应每 30 秒触发一次（而非每分钟）。

---

### 2.3 P2 代码质量（3 项）

| # | 级别 | 问题 | 建议 |
| --- | --- | --- | --- |
| 1 | 🟡 | **DashboardData 类型中 analysis 可为 null 但前台多处直接访问 `device.analysis?.`**，TS 严格模式下偶报错 | 统一用 `device.analysis ?? defaultAnalysis` 兜底，或前台定义 `const hasAnalysis = !!device.analysis` |
| 2 | 🟡 | **`parseLogLevel` 用关键字匹配推断 level**，不同设备日志格式差异大时误判（如 message 含 "error" 字样但实际是 info） | 改用 Loki stream labels 的 level 字段（若有），或配置页允许用户自定义 level 正则 |
| 3 | 🟡 | **`discoverDevices` 回退路径查 `label/source_ip/values`**，某些 Loki 版本不支持该 API，静默返回空 | 回退失败时记日志，配置页提示「设备发现失败，请手动添加设备列表」 |

---

## 三、新增功能实现逻辑（2 项）

### 3.1 异常告警推送 ⭐⭐⭐⭐

**目标**：调度器分析发现异常时，主动推送告警到企业微信/钉钉，而非等用户看仪表盘。

**现状可复用**：`server/logMonitor.ts` 已有 `analyzeLogs` 返回 `has_abnormal`，`saveAudit` 落库；`server/routes/log-monitor.ts` 已有 `healthCheck`。缺告警通道。

**配置扩展**（`LogConfig` interface）：

```ts
// src/api/log-monitor.ts LogConfig 补字段
export interface LogConfig {
  // ... 原字段
  alert?: {
    webhook: string           // 企业微信/钉钉机器人 webhook
    silent_hours?: string     // 静默时段，如 "22:00-08:00"
    cooldown_minutes?: number // 同设备告警冷却，默认 30 分钟
    enabled: boolean
  }
}
```

**DB 周玲**（避免重复推送）：

```ts
// server/db.ts 新增
db.exec(`
  CREATE TABLE IF NOT EXISTS log_alert_sent (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  TEXT NOT NULL,
    audit_id   INTEGER NOT NULL REFERENCES log_audit(id) ON DELETE CASCADE,
    pushed_at  TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT uq_alert_sent UNIQUE (device_id, audit_id)
  );
`)
```

**推送逻辑**（`server/logMonitor.ts` 新增）：

```ts
import db from './db'

export async function pushAlertIfAbnormal(device: DeviceConfig, auditId: number, result: LLMResult): boolean {
  if (!result.has_abnormal) return false
  const cfg = loadConfig()
  if (!cfg.alert?.enabled || !cfg.alert?.webhook) return false

  // 静默时段判断
  if (cfg.alert.silent_hours) {
    const [start, end] = cfg.alert.silent_hours.split('-')
    const now = new Date()
    const hour = now.getHours()
    const startH = parseInt(start.split(':')[0])
    const endH = parseInt(end.split(':')[0])
    if (startH <= endH ? (hour >= startH && hour < endH) : (hour >= startH || hour < endH)) {
      console.log('[alert] 静默时段，跳过推送')
      return false
    }
  }

  // 冷却期判断（同设备 N 分钟内已推送则跳过）
  if (cfg.alert.cooldown_minutes) {
    const recent = db.prepare(
      `SELECT 1 FROM log_alert_sent WHERE device_id = ? AND pushed_at >= datetime('now', ?)`
    ).get(device.device_id, `-${cfg.alert.cooldown_minutes} minutes`)
    if (recent) {
      console.log(`[alert] 设备 ${device.device_id} 冷却期内，跳过`)
      return false
    }
  }

  // 去重：同 audit 已推送则跳过
  const exists = db.prepare('SELECT 1 FROM log_alert_sent WHERE device_id = ? AND audit_id = ?').get(device.device_id, auditId)
  if (exists) return false

  // 推送
  const msg = `⚠️ 设备「${device.name}」检测到异常\n摘要：${result.summary}\n耗时：${result._llm_ms}ms`
  try {
    await fetch(cfg.alert.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content: msg } }),
      signal: AbortSignal.timeout(10000),
    })
    db.prepare('INSERT INTO log_alert_sent (device_id, audit_id) VALUES (?, ?)').run(device.device_id, auditId)
    console.log(`[alert] 已推送设备 ${device.device_id} 异常告警`)
    return true
  } catch (e: any) {
    console.warn(`[alert] 推送失败:`, e.message)
    return false
  }
}
``

**调度器集成**（`startScheduler` 回调内）：

```ts
// server/logMonitor.ts startScheduler 的设备循环内
for (const device of deviceList) {
  try {
    const logs = await fetchLokiLogs((device as any).hostname || device.device_id, startTime, endTime, 10000)
    const result = await analyzeLogs(logs, config.llm.system_prompt)
    const auditId = saveAudit(device, logs, result)
    // 新增：异常时推送告警
    if (result.has_abnormal) {
      await pushAlertIfAbnormal(device, auditId, result)
    }
  } catch (e: any) {
    console.error(`[scheduler] 分析设备 ${device.device_id} 失败: ${e.message}`)
  }
}
```

**`analyze-device` 路由集成**（手动分析也推送）：

```ts
// server/routes/log-monitor.ts analyze-device 路由内
const result = await analyzeLogs(logs, config.llm.system_prompt)
const device = { device_id, name: hostname || device_id }
const auditId = saveAudit(device, logs, result)
// 新增：手动分析也触发告警
await pushAlertIfAbnormal(device, auditId, result)
res.json({ /* ... */ })
```

**配置页入口**（`LogMonitorConfig.vue`）：

```vue
<el-form-item label="告警推送">
  <el-switch v-model="config.alert.enabled" />
</el-form-item>
<el-form-item label="Webhook 地址">
  <el-input v-model="config.alert.webhook" placeholder="企业微信/钉钉机器人 URL" />
</el-form-item>
<el-form-item label="静默时段">
  <el-input v-model="config.alert.silent_hours" placeholder="如 22:00-08:00" />
</el-form-item>
<el-form-item label="冷却期（分钟）">
  <el-input-number v-model="config.alert.cooldown_minutes" :min="0" :max="1440" />
</el-form-item>
```

**验证点**：
1. 调度器分析设备 A 异常时，企业微信群收到「设备 A 检测到异常」消息
2. 30 分钟内设备 A 再次异常，不重复推送（冷却期）
3. 静默时段 22:00-08:00 内异常，不推送但 `log_audit` 仍记录

---

### 3.2 异常趋势看板 ⭐⭐⭐

**目标**：审计页新增趋势图，显示近 7 天每设备异常次数，辅助定位频发故障设备。

**现状可复用**：`log_audit` 表已有 `device_id` + `has_abnormal` + `created_at` + 3 个索引，查趋势无需改表。

**后端路由**（`server/routes/log-monitor.ts` 新增）：

```ts
// GET /api/v1/log-monitor/trend?days=7
router.get('/trend', (req: Request, res: Response) => {
  const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7))
  // 按设备 + 日期聚合异常次数
  const rows = db.prepare(`
    SELECT
      device_id,
      device_name,
      DATE(created_at) AS date,
      SUM(has_abnormal) AS abnormal_count,
      COUNT(*) AS total_count
    FROM log_audit
    WHERE created_at >= datetime('now', ?)
    GROUP BY device_id, DATE(created_at)
    ORDER BY device_id, DATE(created_at) ASC
  `).all(`-${days} days`) as any[]

  // 整理为 { devices: [{ device_id, device_name, daily: [{date, abnormal_count, total_count}] }] }
  const deviceMap = new Map<string, { device_id: string; device_name: string; daily: any[] }>()
  for (const r of rows) {
    if (!deviceMap.has(r.device_id)) {
      deviceMap.set(r.device_id, { device_id: r.device_id, device_name: r.device_name, daily: [] })
    }
    deviceMap.get(r.device_id)!.daily.push({ date: r.date, abnormal_count: r.abnormal_count, total_count: r.total_count })
  }
  res.json({ code: 0, data: { devices: Array.from(deviceMap.values()), days } })
})
```

**前台 API**（`src/api/log-monitor.ts`）：

```ts
export interface TrendDevice {
  device_id: string
  device_name: string
  daily: { date: string; abnormal_count: number; total_count: number }[]
}

export function getTrend(days: number = 7) {
  return request<{ devices: TrendDevice[]; days: number }>(`${BASE}/trend?days=${days}`)
}
```

**审计页集成**（`LogMonitorAudit.vue` 顶部加趋势卡片）：

```vue
<!-- LogMonitorAudit.vue 筛选栏上方新增 -->
<el-card shadow="never" class="trend-card">
  <template #header>
    <div class="trend-header">
      <span>异常趋势（近 {{ trendDays }} 天）</span>
      <el-select v-model="trendDays" size="small" style="width: 100px" @change="loadTrend">
        <el-option label="7 天" :value="7" />
        <el-option label="14 天" :value="14" />
        <el-option label="30 天" :value="30" />
      </el-select>
    </div>
  </template>
  <div v-if="trendDevices.length === 0" class="no-trend">暂无数据</div>
  <div v-else class="trend-list">
    <div v-for="dev in trendDevices" :key="dev.device_id" class="trend-row">
      <span class="trend-device">{{ dev.device_name }}</span>
      <div class="trend-bars">
        <div
          v-for="d in dev.daily"
          :key="d.date"
          class="trend-bar"
          :class="{ abnormal: d.abnormal_count > 0 }"
          :style="{ height: (d.abnormal_count / maxAbnormal * 100) + '%' }"
          :title="`${d.date}：异常 ${d.abnormal_count} 次 / 共 ${d.total_count} 次`"
        />
      </div>
      <span class="trend-count">{{ dev.daily.reduce((a, b) => a + b.abnormal_count, 0) }} 次异常</span>
    </div>
  </div>
</el-card>
```

```ts
const trendDays = ref(7)
const trendDevices = ref<TrendDevice[]>([])
const maxAbnormal = computed(() => {
  let max = 1
  for (const dev of trendDevices.value) for (const d of dev.daily) if (d.abnormal_count > max) max = d.abnormal_count
  return max
})

async function loadTrend() {
  try {
    const res = await getTrend(trendDays.value)
    trendDevices.value = res.devices.sort((a, b) =>
      b.daily.reduce((x, y) => x + y.abnormal_count, 0) - a.daily.reduce((x, y) => x + y.abnormal_count, 0)
    )
  } catch (e: any) {
    ElMessage.error('趋势加载失败: ' + e.message)
  }
}

onMounted(() => { loadTrend(); loadData() })
```

**CSS**（纯 CSS 柱状图，无 ECharts 依赖）：

```css
.trend-card { margin-bottom: 16px; }
.trend-header { display: flex; justify-content: space-between; align-items: center; }
.trend-list { display: flex; flex-direction: column; gap: 8px; }
.trend-row { display: flex; align-items: center; gap: 12px; }
.trend-device { width: 120px; font-size: 13px; flex-shrink: 0; }
.trend-bars { flex: 1; display: flex; gap: 2px; align-items: flex-end; height: 40px; }
.trend-bar { width: 8px; background: var(--el-fill-color); border-radius: 2px; min-height: 2px; }
.trend-bar.abnormal { background: var(--el-color-danger); }
.trend-count { font-size: 12px; color: var(--el-text-color-secondary); flex-shrink: 0; }
``

**验证点**：
1. 调度运行 3 天后审计页顶部显示柱状图，异常日红色柱、正常日灰色柱
2. 按「异常次数」降序排列，频发故障设备排在最前
3. 切换 7/14/30 天，柱状图刷新

---

## 四、优先级路线图 + 工作量预估

| 阶段 | 任务 | 预估 |
| --- | --- | --- |
| Day 1 | P0 三项（§2.1.1 缓存 + §2.1.2 智能采样 + §2.1.3 文件外置 7 天滚动） | 5h |
| Day 2 | P1 健壮性（§2.2.4 请求版本号 + §2.2.5 Loki 错误透传 + §2.2.6 秒级调度） | 3h |
| Day 3 | P1 UX（§2.2.1 骨架屏 + §2.2.2 详情分页 + §2.2.3 审计解析兜底） | 3h |
| Day 4 | 异常告警推送（§3.1）含配置页 + 冷却/静默 | 1d |
| Day 5 | 异常趋势看板（§3.2）含 CSS 柱状图 | 0.5d |

总计约 3.5 人日，P0+P1 可在 2 天内闭环。

---

## 五、验证清单

### P0 验证

| # | 操作 | �期 |
| --- | --- | --- |
| 1 | 前台 5 秒自动刷新，观察网络面板 | 首次 N+1 个 Loki 请求，之后 0 个（命中缓存） |
| 2 | mock 1000 条日志（含 5 条 error）触发分析 | LLM 收到 5 条 error + 50 条 warning + 100 条均匀采样 |
| 3 | 调度运行 1 天后查 `SELECT AVG(LENGTH(raw_logs))` 应 = 0、`SELECT AVG(LENGTH(log_file_path))` 应 < 60 字符；`data/log-audit/` 下只保留最近 7 个日期目录 | DB 行体积 < 1KB，文件按日隔离 |

### P1 验证

| # | 操作 | 预期 |
| --- | --- | --- |
| 4 | 首次加载仪表盘 | 显示 4 个骨架卡片，而非白屏 |
| 5 | 详情弹窗 500 条日志 | 仅渲染 50 条，点「加载更多」追加 |
| 6 | 审计详情查看新记录 / 8 天前记录 | 新记录显示完整日志（source: file）；8 天前记录提示「已超 7 天保留期」 |
| 7 | 快速切换时间范围 5 次 | `dashData` 仅反映最后一次请求结果 |
| 8 | 关闭 Loki 后刷新仪表盘 | 卡片显示「Loki 查询失败：xxx」 |
| 9 | 配置间隔 30 秒启动调度 | 每 30 秒触发一次（而非每分钟） |

### 新功能验证

| # | 功能 | 验证点 |
| --- | --- | --- |
| 10 | 异常告警推送 | 设备异常时企业微信群收到消息；30 分钟内不重复；静默时段不推送 |
| 11 | 异常趋势看板 | 调度运行 3 天后审计页顶部显示柱状图，异常日红色柱，按异常次数降序 |

---

## 六、关键文件清单

| 模块 | 文件 |
| --- | --- |
| 仪表盘视图 | `src/views/log-monitor/LogMonitorView.vue` |
| 审计视图 | `src/views/log-monitor/LogMonitorAudit.vue` |
| 配置视图 | `src/views/admin/LogMonitorConfig.vue` |
| LLM 测试视图 | `src/views/admin/LogMonitorLlmTest.vue` |
| API 层 | `src/api/log-monitor.ts` |
| 后端路由 | `server/routes/log-monitor.ts` |
| 核心逻辑 | `server/logMonitor.ts`（调度器 + Loki 查询 + LLM 分析 + 设备发现 + 健康检查 + Dashboard 数据聚合） |
| 数据库 | `server/db.ts` L1313-1327（`log_audit` 表 + 3 索引） |
| 路由 | `src/router/index.ts` L101-111（`/log-monitor` + `/log-monitor/audit` + `/admin/log-monitor` + `/admin/log-monitor/llm-test`） |

---

> 本文档为日志监控仪表盘的完整评审 + 实现细则合并版，可直接按章节排期执行。
