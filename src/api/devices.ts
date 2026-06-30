// src/api/devices.ts
import type { Device } from '../types'
import { request } from '../utils/http'

const BASE_RACKS = '/api/v1/racks'
const BASE_DEVICES = '/api/v1/devices'

// 1. 获取所有机柜
export async function fetchRacks(floor?: string): Promise<{ racks: any[]; stats: any }> {
  const qs = floor ? '?floor=' + floor + '&include_devices=true' : '?include_devices=true'
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
  await request(`${BASE_RACKS}/${id}`, { method: 'DELETE' })
}

// 5. 添加设备到机柜
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
  await request(`${BASE_DEVICES}/${id}`, { method: 'DELETE' })
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
