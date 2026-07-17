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

// 全量列表 — 分页拉取合并，避免 pageSize 上限截断 (#15)
export async function fetchAllServices(params?: {
  keyword?: string; category?: string; status?: string; hostId?: number
}): Promise<Service[]> {
  const PAGE_SIZE = 500
  let page = 1
  const all: Service[] = []
  // 最多拉 50 页（10000 条）防止无限循环
  for (let i = 0; i < 50; i++) {
    const query = new URLSearchParams()
    query.set('page', String(page))
    query.set('pageSize', String(PAGE_SIZE))
    if (params?.keyword) query.set('keyword', params.keyword)
    if (params?.category) query.set('category', params.category)
    if (params?.status) query.set('status', params.status)
    if (params?.hostId) query.set('hostId', String(params.hostId))
    const data = await request<PaginatedList>(`${BASE}?${query.toString()}`)
    all.push(...data.list)
    if (data.list.length < PAGE_SIZE) break  // 最后一页
    page++
  }
  return all
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

// 9. 收藏服务
export async function addFavorite(serviceId: number): Promise<void> {
  await request(`${BASE}/${serviceId}/favorite`, { method: 'POST' })
}

// 10. 取消收藏
export async function removeFavorite(serviceId: number): Promise<void> {
  await request(`${BASE}/${serviceId}/favorite`, { method: 'DELETE' })
}

// 11. 获取收藏列表
export async function fetchFavorites(): Promise<Service[]> {
  return request<Service[]>(`${BASE}/favorites`)
}

// 12. 获取健康历史
export async function fetchHistory(id: number, hours = 24): Promise<{ points: any[] }> {
  return request<any>(`${BASE}/${id}/history?hours=${hours}`)
}
