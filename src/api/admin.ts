import { request } from '../utils/http'

const BASE = '/api/v1/admin'

// 通用 CRUD
export async function fetchDict(table: string) {
  return request(`${BASE}/${table}`)
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
