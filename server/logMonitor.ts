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

  const url = (cfg.base_url || 'http://10.3.0.200:17002/v1').replace(/\/$/, '') + '/chat/completions'
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

// ========== 调度器 ==========

let cronTask: ScheduledTask | null = null
let lastRunTime: Date | null = null

export function startScheduler(): void {
  if (cronTask) return

  const cfg = loadConfig()
  const interval = cfg.scheduler?.interval || 300
  const cronExpr = `*/${interval} * * * *`

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

// 启动时自动恢复
const savedConfig = loadConfig()
if (savedConfig.scheduler_running) {
  startScheduler()
}
