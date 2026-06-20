import { request } from '../utils/http'

const BASE = '/api/v1/log-monitor'

export interface LogConfig {
  log_server: { base_url: string; path: string; page_size: number; timeout: number }
  devices: { device_id: string; name: string }[]
  llm: {
    base_url: string; model: string; api_key: string
    temperature: number; max_tokens: number; timeout: number
    retries: number; system_prompt: string
  }
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
