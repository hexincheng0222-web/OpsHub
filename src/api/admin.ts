const BASE = '/api/v1/admin'

async function request(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || '请求失败')
  }
  return res.json()
}

// 通用 CRUD
export async function fetchDict(table: string) {
  const { data } = await request(`${BASE}/${table}`)
  return data
}

export async function createDict(table: string, payload: Record<string, any>) {
  const { data } = await request(`${BASE}/${table}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

export async function updateDict(table: string, id: number, payload: Record<string, any>) {
  const { data } = await request(`${BASE}/${table}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return data
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
  const { data } = await request(`${BASE}/logs/list?${qs}`)
  return data
}

export async function clearLogs() {
  return request(`${BASE}/logs/clear`, { method: 'DELETE' })
}

// 概览统计
export async function fetchOverview() {
  const { data } = await request(`${BASE}/overview/stats`)
  return data
}

// 系统配置
export async function fetchConfig() {
  const { data } = await request(`${BASE}/config/list`)
  return data
}

export async function saveConfig(configs: Array<{ key: string; value: string }>) {
  return request(`${BASE}/config`, {
    method: 'PUT',
    body: JSON.stringify({ configs }),
  })
}
