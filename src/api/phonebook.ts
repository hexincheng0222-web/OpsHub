// src/api/phonebook.ts
import { request } from '../utils/http'

const BASE = '/api/v1/phones'

export interface PhonebookContact {
  id: number
  name: string
  number: string
  department: string
  position: string
  type: 'internal' | 'external'
  notes: string
}

// 获取电话簿列表
export async function fetchPhonebook(): Promise<PhonebookContact[]> {
  return request(`${BASE}/phonebook`)
}

// 新增联系人
export async function createContact(data: Omit<PhonebookContact, 'id'>): Promise<any> {
  return request(`${BASE}/phonebook`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// 修改联系人
export async function updateContact(id: number, data: Partial<PhonebookContact>): Promise<any> {
  return request(`${BASE}/phonebook/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// 删除联系人
export async function deleteContact(id: number): Promise<void> {
  await request(`${BASE}/phonebook/${id}`, { method: 'DELETE' })
}

// 批量删除
export async function batchDeleteContacts(ids: number[]): Promise<any> {
  return request(`${BASE}/phonebook/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

// 从 PBX 同步
export async function syncFromPbx(): Promise<{ synced: number }> {
  return request(`${BASE}/phonebook/sync-from-pbx`, { method: 'POST' })
}

// 导入联系人
export async function importContacts(rows: Partial<PhonebookContact>[]): Promise<{ imported: number; errors: any[] }> {
  return request(`${BASE}/phonebook/import`, {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
}

// 获取在线话机列表
export async function fetchOnlinePhones(): Promise<any[]> {
  const devices = await request<any[]>(`${BASE}`)
  return (devices || []).filter((d: any) => d.online)
}

// 推送电话簿到话机
export async function deployPhonebook(phoneIds: string[], mode: string): Promise<{ success: number; failed: number }> {
  return request(`${BASE}/phonebook/deploy`, {
    method: 'POST',
    body: JSON.stringify({ phoneIds, mode }),
  })
}
