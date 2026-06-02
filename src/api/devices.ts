// src/api/devices.ts
import type { Device } from '../mock/devices'

const BASE_RACKS = '/api/v1/racks'
const BASE_DEVICES = '/api/v1/devices'

interface ApiResponse<T> {
  code: number
  data: T
  message?: string
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json: ApiResponse<T> = await res.json()
  if (json.code >= 400) throw new Error(json.message || `HTTP ${json.code}`)
  return json.data
}

// 1. 获取所有机柜
export async function fetchRacks(floor?: string): Promise<{ racks: any[]; stats: any }> {
  const qs = floor ? '?floor=' + floor : ''
  return request(BASE_RACKS + qs)
}

// 2. 创建机柜
export async function createRack(data: { name: string; floor: string; totalU?: number }): Promise<any> {
  return request(BASE_RACKS, { method: 'POST', body: JSON.stringify(data) })
}

// 3. 更新机柜
export async function updateRack(id: string, data: { name: string; floor?: string }): Promise<any> {
  return request(`${BASE_RACKS}/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

// 4. 删除机柜
export async function deleteRack(id: string): Promise<void> {
  await fetch(`${BASE_RACKS}/${id}`, { method: 'DELETE' })
}

// 5. 获取机柜详情（含设备布局）
export async function fetchRackSlots(rackId: string): Promise<{ rack: any; slots: any[] }> {
  return request(`${BASE_RACKS}/${rackId}/slots`)
}

// 6. 添加设备到机柜
export async function addDeviceToRack(rackId: string, data: Omit<Device, 'id'> & { uOffset: number }): Promise<Device> {
  return request(`${BASE_RACKS}/${rackId}/devices`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// 7. 更新设备
export async function updateDevice(id: number, data: Partial<Device>): Promise<Device> {
  return request(`${BASE_DEVICES}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// 8. 删除设备
export async function deleteDevice(id: number): Promise<void> {
  await fetch(`${BASE_DEVICES}/${id}`, { method: 'DELETE' })
}

// 9. 移动设备
export async function moveDevice(
  deviceId: number,
  targetRackId: string,
  targetUOffset: number
): Promise<any> {
  return request(`${BASE_DEVICES}/${deviceId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetRackId, targetUOffset }),
  })
}

// 10. 获取统计
export async function fetchStats(): Promise<any> {
  return request(`${BASE_RACKS}/stats`)
}

// 11. 获取楼层列表
export async function fetchFloors(): Promise<string[]> {
  const data = await request<{ floors: string[] }>(`${BASE_RACKS}/floors`)
  return data.floors
}
