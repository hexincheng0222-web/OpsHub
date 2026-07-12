import { request } from '../utils/http'

const BASE = '/api/v1/admin'

// 字典缓存（60s TTL）
const dictCache = new Map<string, { data: any; ts: number }>()
const DICT_CACHE_TTL = 60_000

// 通用 CRUD
export async function fetchDict(table: string) {
  const cached = dictCache.get(table)
  if (cached && Date.now() - cached.ts < DICT_CACHE_TTL) return cached.data

  const data = await request(`${BASE}/${table}`)
  dictCache.set(table, { data, ts: Date.now() })
  return data
}

export async function createDict(table: string, payload: Record<string, any>) {
  return request(`${BASE}/${table}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateDict(table: string, id: number, payload: Record<string, any>) {
  return request(`${BASE}/${table}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteDict(table: string, id: number) {
  await request(`${BASE}/${table}/${id}`, { method: 'DELETE' })
}

// 操作日志
export async function fetchLogs(params: { page?: number; pageSize?: number; module?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.module) qs.set('module', params.module)
  return request(`${BASE}/logs/list?${qs}`)
}

export async function clearLogs() {
  return request(`${BASE}/logs/clear`, { method: 'DELETE' })
}

// 概览统计
export async function fetchOverview() {
  return request(`${BASE}/overview/stats`)
}

// 操作趋势（近 N 天操作日志数）
export async function fetchOverviewTrend(days: number = 7): Promise<{ days: number; trend: { date: string; count: number }[] }> {
  return request(`${BASE}/overview/trend?days=${days}`)
}

// 系统配置
export async function fetchConfig() {
  return request(`${BASE}/config/list`)
}

export async function saveConfig(configs: Array<{ key: string; value: string }>) {
  return request(`${BASE}/config`, {
    method: 'PUT',
    body: JSON.stringify({ configs }),
  })
}
