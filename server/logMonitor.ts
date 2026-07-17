import db from './db'
import fs from 'node:fs'
import path from 'node:path'
import type { ScheduledTask } from 'node-cron'

// ========== 类型定义 ==========

export interface LokiResult {
  logs: LogEntry[]
  error?: string
}

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
  alert?: {
    webhook: string
    silent_hours?: string
    cooldown_minutes?: number
    enabled: boolean
  }
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
  if (!row) return null
  try {
    return JSON.parse(row.value)
  } catch (e: any) {
    console.warn(`[logMonitor] 配置 ${key} 损坏（非法 JSON），跳过: ${e.message}`)
    return null
  }
}

function setConfig(key: string, value: any): void {
  db.prepare(
    'INSERT OR REPLACE INTO log_monitor_config (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))'
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

  const url = cfg.base_url.replace(/\/$/, '') + cfg.path
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

function sampleEvenly(logs: LogEntry[], target: number): LogEntry[] {
  if (logs.length <= target) return logs
  const step = Math.ceil(logs.length / target)
  const result: LogEntry[] = []
  for (let i = 0; i < logs.length; i += step) result.push(logs[i])
  return result
}

export async function analyzeLogs(logs: LogEntry[], systemPrompt: string): Promise<LLMResult> {
  const cfg = loadConfig().llm
  if (!logs.length) return { summary: '本批次无日志。', has_abnormal: false, _llm_ms: 0 }

  // 智能采样：error 全保留，warning 最多 50 条，其他按时间均匀采样到 100 条，总上限 200 条
  const errorLogs = logs.filter(l => l.level === 'error' || l.level === 'ERROR')
  const warningLogs = logs.filter(l => l.level === 'warning' || l.level === 'WARN')
  const otherLogs = logs.filter(l => !errorLogs.includes(l) && !warningLogs.includes(l))
  const sampled = [
    ...errorLogs,
    ...warningLogs.slice(0, 50),
    ...sampleEvenly(otherLogs, 100),
  ].slice(0, 200)

  const compact = JSON.stringify(sampled, null, 0)
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

  const url = (cfg.base_url || 'http://10.3.0.200:17002/v1').replace(/\/$/, '') + '/chat/completions'
  const apiKey = cfg.api_key || ''
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
      const message = data.choices?.[0]?.message || {}
      // 兼容推理模型（content 为空时取 reasoning）
      const rawContent: string = message.content || message.reasoning || ''
      const parsed = parseLLMJson(rawContent)
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
  // 1) 全文写到 data/log-audit/YYYY-MM-DD/设备IP-毫秒.json
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
  return row.lastInsertRowid as number
}

export function cleanupAudit(retentionDays: number): number {
  if (retentionDays <= 0) return 0
  // 先查出待删行的 log_file_path，删磁盘文件
  const rows = db.prepare(
    'SELECT log_file_path FROM log_audit WHERE created_at < datetime(\'now\', ?)'
  ).all(`-${retentionDays} days`) as { log_file_path: string }[]
  for (const r of rows) {
    if (r.log_file_path) {
      try { fs.unlinkSync(r.log_file_path) } catch { /* 文件可能已删，忽略 */ }
    }
  }
  // 再删 DB 行
  const row = db.prepare(
    'DELETE FROM log_audit WHERE created_at < datetime(\'now\', ?)'
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

// ========== Loki 设备自动发现 ==========

function getLokiUrl(): string {
  const cfg = loadConfig()
  return cfg.log_server?.base_url || 'http://10.3.0.143:3100'
}

export interface DiscoveredDevice {
  ip: string
  hostname: string
}

// 设备发现缓存（P0-1：避免每次刷新都查 Loki 7 天日志建映射）
let deviceCache: { devices: DiscoveredDevice[]; ts: number } | null = null
const DEVICE_CACHE_TTL = 5 * 60 * 1000  // 5 分钟

export async function getCachedDevices(): Promise<DiscoveredDevice[]> {
  if (deviceCache && Date.now() - deviceCache.ts < DEVICE_CACHE_TTL) {
    return deviceCache.devices
  }
  const devices = await discoverDevices()
  deviceCache = { devices, ts: Date.now() }
  return devices
}

export async function discoverDevices(): Promise<DiscoveredDevice[]> {
  const start = new Date(Date.now() - 7 * 86400000).toISOString()
  const end = new Date().toISOString()

  // 用 query_range 查少量日志，从每条 stream 的 labels 里取 host + source_ip 建立关联
  try {
    const url = `${getLokiUrl()}/loki/api/v1/query_range?query={job="syslog"}&limit=500&direction=backward&start=${start}&end=${end}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    const data = await res.json() as any

    // 从 stream labels 关联 IP → hostname（每个 stream 只取一条，去重）
    const ipHostMap = new Map<string, string>()
    for (const stream of (data.data?.result || [])) {
      const host: string = stream.stream?.host || ''
      const sourceIp: string = stream.stream?.source_ip || ''
      const m = sourceIp.match(/(\d+\.\d+\.\d+\.\d+)/)
      if (host && m && !ipHostMap.has(m[1])) {
        ipHostMap.set(m[1], host)
      }
    }

    if (ipHostMap.size > 0) {
      return Array.from(ipHostMap.entries()).map(([ip, hostname]) => ({ ip, hostname }))
    }
  } catch {}

  // 回退：仅查 source_ip label values，hostname 回落到 IP
  try {
    const url = `${getLokiUrl()}/loki/api/v1/label/source_ip/values?start=${start}&end=${end}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json() as any
    return (data.data || []).map((s: string) => {
      const m = s.match(/(\d+\.\d+\.\d+\.\d+)/)
      const ip = m ? m[1] : s
      return { ip, hostname: ip }
    })
  } catch {
    return []
  }
}

// ========== 调度器 ==========

let cronTask: ScheduledTask | null = null
let intervalTimer: NodeJS.Timeout | null = null
let lastRunTime: Date | null = null
let schedulerRunning = false  // 互斥标志：防上一轮未结束下一轮并发进入

// ========== 异常告警推送 ==========

export async function pushAlertIfAbnormal(device: DeviceConfig, auditId: number, result: LLMResult): Promise<boolean> {
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

export function startScheduler(): void {
  if (intervalTimer) return

  const cfg = loadConfig()
  const intervalSec = cfg.scheduler?.interval || 300
  lastRunTime = new Date()

  intervalTimer = setInterval(async () => {
    if (schedulerRunning) {
      console.warn('[scheduler] 上一轮未结束，跳过本轮')
      lastRunTime = new Date()
      return
    }
    schedulerRunning = true
    lastRunTime = new Date()
    try {
    const config = loadConfig()
    // 从 Loki 自动发现设备，回退到配置列表
    let deviceList: DeviceConfig[]
    const discovered = await getCachedDevices()
    if (discovered.length > 0) {
      const nameMap = new Map(config.devices.map(d => [d.device_id, d.name]))
      deviceList = discovered.map(d => ({
        device_id: d.ip,
        name: nameMap.get(d.ip) || d.hostname || d.ip,
        hostname: d.hostname,  // 保留 hostname 用于 Loki 查询
      }))
    } else {
      deviceList = config.devices
    }
    console.log(`[scheduler] 开始新一轮分析, 设备数=${deviceList.length}`)
    for (const device of deviceList) {
      try {
        const endTime = new Date()
        const startTime = new Date(endTime.getTime() - (config.scheduler.window * 1000))
        const { logs } = await fetchLokiLogsCached((device as any).hostname || device.device_id, startTime, endTime, 10000)
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
    } finally { schedulerRunning = false }
  }, intervalSec * 1000)

  setConfig('scheduler_running', true)
  console.log(`[scheduler] 调度器已启动, 间隔=${intervalSec}s`)
}

export function stopScheduler(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
  setConfig('scheduler_running', false)
  console.log('[scheduler] 调度器已停止')
}

export function getSchedulerStatus(): { running: boolean; lastRun: string | null } {
  return {
    running: intervalTimer !== null,
    lastRun: lastRunTime?.toISOString() || null,
  }
}

// 启动时自动恢复
const savedConfig = loadConfig()
if (savedConfig.scheduler_running) {
  startScheduler()
}

// ========== Dashboard 数据 ==========

interface DashboardLog {
  ts: string
  level: string
  msg: string
}

interface DashboardDevice {
  device_id: string
  device_name: string
  hostname: string
  log_count: number
  logs: DashboardLog[]
  loki_error?: string
  analysis: {
    summary: string
    has_abnormal: boolean
    llm_ms: number
    created_at: string
  } | null
}

interface DashboardData {
  devices: DashboardDevice[]
  scheduler_running: boolean
  last_analysis_time: string | null
}

function parseLogLevel(line: string): string {
  if (line.includes('/5/') || line.includes('DOWN') || line.includes('ERROR') || line.includes('failed') || line.includes('failure'))
    return 'ERROR'
  if (line.includes('/4/') || line.includes('WARNING') || line.includes('WARN') || line.includes('threshold') || line.includes('exceeded'))
    return 'WARNING'
  return 'INFO'
}

// 日志查询节流（P0-1：同时间窗口内重复请求复用结果）
const logQueryCache = new Map<string, { result: LokiResult; ts: number }>()
const LOG_CACHE_TTL = 10_000  // 10 秒

export async function fetchLokiLogsCached(hostname: string, start: Date, end: Date, limit?: number): Promise<LokiResult> {
  const key = `${hostname}|${start.getTime()}|${end.getTime()}`
  const cached = logQueryCache.get(key)
  if (cached && Date.now() - cached.ts < LOG_CACHE_TTL) return cached.result
  const result = await fetchLokiLogs(hostname, start, end, limit)
  logQueryCache.set(key, { result, ts: Date.now() })
  // 清理过期 key
  if (logQueryCache.size > 100) {
    for (const [k, v] of logQueryCache) {
      if (Date.now() - v.ts > LOG_CACHE_TTL) logQueryCache.delete(k)
    }
  }
  return result
}

export async function fetchLokiLogs(hostname: string, start: Date, end: Date, limit: number = 2000): Promise<LokiResult> {
  // LogQL 注入防护：hostname 只允许字母数字点下划线短横线，拒绝注入向量
  if (!/^[a-zA-Z0-9._-]+$/.test(hostname)) {
    return { logs: [], error: `hostname 含非法字符: ${hostname.slice(0, 50)}` }
  }
  const query = `{job="syslog", host="${hostname}"}`
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    direction: 'backward',
    start: String(Math.floor(start.getTime() / 1e6) * 1e6) + '000000',
    end: String(Math.floor(end.getTime() / 1e6) * 1e6) + '000000',
  })

  try {
    const url = `${getLokiUrl()}/loki/api/v1/query_range?${params}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return { logs: [], error: `Loki HTTP ${res.status}` }
    const data = await res.json() as any
    const results: LogEntry[] = []
    for (const stream of (data.data?.result || [])) {
      for (const [tsNano, line] of (stream.values || [])) {
        let parsed: any = {}
        try { parsed = JSON.parse(line) } catch { parsed = { message: line } }
        const msg = parsed.message || line
        results.push({
          ts: new Date(Number(tsNano) / 1e6).toISOString().replace('T', ' ').slice(0, 19),
          level: parseLogLevel(parsed.message || line),
          msg: (parsed.message || line).slice(0, 500),
        })
      }
    }
    return { logs: results }
  } catch (e: any) {
    return { logs: [], error: e.message || 'Loki 查询超时' }
  }
}

function extractSummary(text: string): string {
  if (!text) return ''
  // 1. 尝试从 Final Polish/Draft 中提取中文摘要
  const finalMatch = text.match(/Final\s*(?:Polish|Draft|Summary)[:\s]*[*\s]*([^\n*]{10,300})/i)
  if (finalMatch) return finalMatch[1].trim()
  // 2. 尝试找最后一条 Draft
  const draftMatches = [...text.matchAll(/Draft\s*\d*[:\s]*[*\s]*([^\n*]{10,300})/gi)]
  if (draftMatches.length) return draftMatches[draftMatches.length - 1][1].trim()
  // 3. 尝试提取 JSON summary（排除示例中的 "..."）
  try {
    const jsonMatch = text.match(/"summary"\s*:\s*"([^."][^"]{5,})"/)
    if (jsonMatch) return jsonMatch[1]
  } catch {}
  // 4. 回退：取最后 3 行
  const lines = text.split('\n').filter(l => l.trim() && !l.includes('---') && l.length > 10)
  return lines.slice(-2).join(' ').replace(/[*#]/g, '').trim().slice(0, 200) || text.slice(0, 200)
}

// 并发池工具：限定最大并发数，避免设备多时洪峰打挂 Loki
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  const workers = Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

export async function getDashboardData(timeRange: string): Promise<DashboardData> {
  const config = loadConfig()

  // 计算时间范围
  const rangeMap: Record<string, number> = {
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  }
  const ms = rangeMap[timeRange] || rangeMap['1h']
  const now = new Date()
  const startTime = new Date(now.getTime() - ms)

  // 从 Loki 自动发现设备
  let discoveredDevices = await getCachedDevices()

  // 如果配置页有设备列表，则过滤只显示已配置的设备
  const nameMap = new Map(config.devices.map(d => [d.device_id, d.name]))
  if (config.devices.length > 0) {
    const configuredIds = new Set(config.devices.map(d => d.device_id))
    discoveredDevices = discoveredDevices.filter(d => configuredIds.has(d.ip))
  }

  // 并发查询所有设备（限流 5，避免设备多时洪峰打挂 Loki）
  const devices = await mapWithConcurrency(discoveredDevices, 5, async (device) => {
    const { logs, error: lokiError } = await fetchLokiLogsCached(device.hostname, startTime, now)

  // 未启动调度器时不显示历史分析数据，除非手动分析过
  let analysis = null
  if (config.scheduler_running) {
    const auditRow = db.prepare(
      'SELECT llm_summary, has_abnormal, llm_ms, created_at FROM log_audit WHERE device_id = ? ORDER BY id DESC LIMIT 1'
    ).get(device.ip) as { llm_summary: string; has_abnormal: number; llm_ms: number; created_at: string } | undefined
    if (auditRow) {
      analysis = {
        summary: extractSummary(auditRow.llm_summary),
        has_abnormal: Boolean(auditRow.has_abnormal),
        llm_ms: auditRow.llm_ms,
        created_at: auditRow.created_at,
      }
    }
  }

  return {
    device_id: device.ip,
    device_name: nameMap.get(device.ip) || device.hostname || device.ip,
    hostname: device.hostname,
    log_count: logs.length,
    logs: logs.map(l => ({ ...l })),
    loki_error: lokiError,
    analysis,
  } as DashboardDevice
})

  // 最后一次分析时间
  const lastAudit = db.prepare(
    'SELECT created_at FROM log_audit ORDER BY id DESC LIMIT 1'
  ).get() as { created_at: string } | undefined

  return {
    devices,
    scheduler_running: config.scheduler_running,
    last_analysis_time: lastAudit?.created_at || null,
  }
}
