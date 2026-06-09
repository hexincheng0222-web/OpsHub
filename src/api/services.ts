// src/api/services.ts
import type { Service } from '../mock/services'

const BASE = '/api/v1/services'

interface ApiResponse<T> {
  code: number
  data: T
  message?: string
}

interface PaginatedList {
  list: Service[]
  total: number
  page: number
  pageSize: number
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json: ApiResponse<T> = await res.json()
  if (json.code >= 400) {
    throw new Error(json.message || `HTTP ${json.code}`)
  }
  return json.data
}

// 1. 获取服务列表
export async function fetchServices(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  category?: string
  status?: string
}): Promise<PaginatedList> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('pageSize', String(params.pageSize))
  if (params?.keyword) query.set('keyword', params.keyword)
  if (params?.category) query.set('category', params.category)
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()
  return request<PaginatedList>(BASE + (qs ? '?' + qs : ''))
}

// 2. 获取单个服务
export async function fetchService(id: number): Promise<Service> {
  return request<Service>(`${BASE}/${id}`)
}

// 3. 创建服务
export async function createService(data: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Promise<Service> {
  return request<Service>(BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// 4. 全量更新
export async function updateService(id: number, data: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Promise<Service> {
  return request<Service>(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// 5. 部分更新
export async function patchService(id: number, data: Partial<Pick<Service, 'status' | 'notes' | 'description'>>): Promise<Service> {
  return request<Service>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// 6. 删除服务
export async function deleteService(id: number): Promise<void> {
  await request(`${BASE}/${id}`, { method: 'DELETE' })
}

// 7. 批量检测连通性
export async function checkAllServices(): Promise<{
  results: Array<{ id: number; name: string; status: string; latencyMs: number | null; error?: string }>
  summary: { total: number; online: number; offline: number; maintenance: number }
}> {
  return request<any>(`${BASE}/check-all`, { method: 'POST' })
}

// 8. 单个检测连通性
export async function checkService(id: number): Promise<{ id: number; status: string; latencyMs: number | null }> {
  return request<any>(`${BASE}/${id}/check`, { method: 'POST' })
}

// 9. 获取分类列表
export async function fetchCategories(): Promise<string[]> {
  const data = await request<{ categories: string[] }>(`${BASE}/categories`)
  return data.categories
}
