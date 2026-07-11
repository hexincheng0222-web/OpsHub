// src/api/services.ts
import type { Service } from '../types'
import { request } from '../utils/http'

const BASE = '/api/v1/services'

interface PaginatedList {
  list: Service[]
  total: number
  page: number
  pageSize: number
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

// 全量列表（走上限 100，前台/后台卡片不分页场景）
export async function fetchAllServices(params?: {
  keyword?: string; category?: string; status?: string; hostId?: number
}): Promise<Service[]> {
  const query = new URLSearchParams()
  query.set('pageSize', '100')
  if (params?.keyword) query.set('keyword', params.keyword)
  if (params?.category) query.set('category', params.category)
  if (params?.status) query.set('status', params.status)
  if (params?.hostId) query.set('hostId', String(params.hostId))
  const data = await request<PaginatedList>(`${BASE}?${query.toString()}`)
  return data.list
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
