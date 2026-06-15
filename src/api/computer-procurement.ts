import type { ComputerProcurement } from '../stores/procurement'
import { request } from '../utils/http'

const BASE = '/api/v1/computer-procurement'

function fromApi(r: any): ComputerProcurement {
  return {
    id: r.id, model: r.model, department: r.department, applicant: r.applicant,
    macAddress: r.macAddress, deviceModel: r.deviceModel, ceNumber: r.ceNumber,
    actualUser: r.actualUser, approvalNumber: r.approvalNumber, receiveDate: r.receiveDate,
    assetNumber: r.assetNumber, deliveryDate: r.deliveryDate, deliveryPerson: r.deliveryPerson,
    pickupApproval: r.pickupApproval, ceProcessed: r.ceProcessed, price: r.price,
  }
}

export async function fetchComputers(params: { page?: number; pageSize?: number; search?: string; department?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.search) qs.set('search', params.search)
  if (params.department) qs.set('department', params.department)
  const data = await request<any>(`${BASE}?${qs}`)
  return { list: data.list.map(fromApi), total: data.total }
}

export async function createComputer(d: Omit<ComputerProcurement, 'id'>) {
  return fromApi(await request<any>(BASE, { method: 'POST', body: JSON.stringify(d) }))
}

export async function updateComputer(id: number, d: Partial<ComputerProcurement>) {
  return fromApi(await request<any>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(d) }))
}

export async function deleteComputer(id: number) {
  await request(`${BASE}/${id}`, { method: 'DELETE' })
}

export async function batchDeleteComputers(ids: number[]) {
  await request(`${BASE}/batch-delete`, { method: 'POST', body: JSON.stringify({ ids }) })
}

export async function importComputers(rows: Partial<ComputerProcurement>[]) {
  return request<{ imported: number; errors: string[] }>(`${BASE}/import`, { method: 'POST', body: JSON.stringify({ rows }) })
}
