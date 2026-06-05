import type { Printer } from '../mock/printers'

const BASE = '/api/v1/printers'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (json.code >= 400) throw new Error(json.message || `HTTP ${json.code}`)
  return json.data
}

function fromApi(r: any): Printer {
  return {
    id: r.id,
    floor: r.floor,
    location: r.location,
    manufacturer: r.manufacturer,
    model: r.model,
    tonerModel: r.tonerModel,
    notes: r.notes,
    status: r.status,
  }
}

export async function fetchPrinters(params: {
  floor?: string; status?: string; keyword?: string
} = {}): Promise<{ list: Printer[]; total: number }> {
  const qs = new URLSearchParams()
  if (params.floor) qs.set('floor', params.floor)
  if (params.status) qs.set('status', params.status)
  if (params.keyword) qs.set('keyword', params.keyword)
  const data = await request<any>(`${BASE}?${qs}`)
  return { list: data.list.map(fromApi), total: data.total }
}

export async function createPrinter(printer: Omit<Printer, 'id'>): Promise<Printer> {
  const data = await request<any>(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(printer),
  })
  return fromApi(data)
}

export async function updatePrinter(id: number, data: Partial<Printer>): Promise<Printer> {
  const res = await request<any>(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return fromApi(res)
}

export async function deletePrinter(id: number): Promise<void> {
  await request(`${BASE}/${id}`, { method: 'DELETE' })
}

export async function batchDeletePrinters(ids: number[]): Promise<void> {
  await request(`${BASE}/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export async function importPrinters(rows: Partial<Printer>[]): Promise<{ imported: number; errors: string[] }> {
  return request(`${BASE}/import`, {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
}

export async function fetchPrinterStats(): Promise<{ total: number; normal: number; lowInk: number; fault: number }> {
  return request(`${BASE}/stats`)
}
