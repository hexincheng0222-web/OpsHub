import type { PhoneProcurement } from '../stores/procurement'
import { request } from '../utils/http'

const BASE = '/api/v1/phone-procurement'

function fromApi(r: any): PhoneProcurement {
  return {
    id: r.id, assetNumber: r.assetNumber, partNo: r.partNo, serialNo: r.serialNo,
    imei: r.imei, arrivalDate: r.arrivalDate, pickupDate: r.pickupDate,
    brand: r.brand, model: r.model, assetLink: r.assetLink, department: r.department,
    handler: r.handler, recipient: r.recipient, dingtalkCreator: r.dingtalkCreator,
    purchaseType: r.purchaseType, dingtalkFlow: r.dingtalkFlow,
    originalOwner: r.originalOwner, notes: r.notes,
  }
}

export async function fetchPhones(params: { page?: number; pageSize?: number; search?: string; department?: string; purchaseType?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.search) qs.set('search', params.search)
  if (params.department) qs.set('department', params.department)
  if (params.purchaseType) qs.set('purchaseType', params.purchaseType)
  const data = await request<any>(`${BASE}?${qs}`)
  return { list: data.list.map(fromApi), total: data.total }
}

export async function createPhone(d: Omit<PhoneProcurement, 'id'>) {
  return fromApi(await request<any>(BASE, { method: 'POST', body: JSON.stringify(d) }))
}

export async function updatePhone(id: number, d: Partial<PhoneProcurement>) {
  return fromApi(await request<any>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(d) }))
}

export async function deletePhone(id: number) {
  await request(`${BASE}/${id}`, { method: 'DELETE' })
}

export async function batchDeletePhones(ids: number[]) {
  await request(`${BASE}/batch-delete`, { method: 'POST', body: JSON.stringify({ ids }) })
}

export async function importPhones(rows: Partial<PhoneProcurement>[]) {
  return request<{ imported: number; errors: string[] }>(`${BASE}/import`, { method: 'POST', body: JSON.stringify({ rows }) })
}

// ===== 回收站（#29 软删除）=====
export async function fetchPhoneTrash() {
  const data = await request<{ list: any[]; total: number }>(`${BASE}/trash`)
  return { list: data.list.map(fromApi), total: data.total }
}
export async function restorePhone(ids: number[]) {
  return request(`${BASE}/trash/restore`, { method: 'POST', body: JSON.stringify({ ids }) })
}
export async function purgePhone(ids: number[]) {
  return request(`${BASE}/trash/purge`, { method: 'DELETE', body: JSON.stringify({ ids }) })
}
