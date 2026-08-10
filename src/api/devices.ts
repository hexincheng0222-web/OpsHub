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

// ===== 设备实时监控（LibreNMS）=====

export interface DeviceSnapshot {
  cpuUsage: number | null
  memUsage: number | null
  memUsedMb: number | null
  memTotalMb: number | null
  temperature: number | null
  ports: { name: string; status: 'up' | 'down'; rxBps: number; txBps: number }[]
  collectedAt: string
}

export interface MonitorSnapshotResult {
  available: boolean
  reason?: 'disabled' | 'pending' | 'unreachable'
  snapshot?: DeviceSnapshot
}

// 实时快照（读缓存）
export async function fetchDeviceSnapshot(id: number): Promise<MonitorSnapshotResult> {
  return request(`${BASE_DEVICES}/${id}/monitor/snapshot`)
}

// 历史趋势（查表）
export async function fetchDeviceHistory(id: number, hours = 24): Promise<{ points: { collectedAt: string; cpuUsage: number | null; memUsage: number | null; temperature: number | null }[] }> {
  return request(`${BASE_DEVICES}/${id}/monitor/history?hours=${hours}`)
}

// 端口豁免白名单
export interface PortWhitelistItem {
  id: number
  device_id: number
  device_name: string
  device_ip: string | null
  if_index: number
  if_name: string
  reason: string
  created_at: string
}

export async function fetchPortWhitelist(): Promise<PortWhitelistItem[]> {
  return request(`${BASE_DEVICES}/alerts/port-whitelist`)
}

export async function addPortWhitelist(data: { deviceId: number; ifName: string; reason?: string }): Promise<void> {
  await request(`${BASE_DEVICES}/alerts/port-whitelist`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function removePortWhitelist(id: number): Promise<void> {
  await request(`${BASE_DEVICES}/alerts/port-whitelist/${id}`, { method: 'DELETE' })
}

/** 读取设备最新采集到的 up 端口列表（用于豁免添加弹窗选择） */
export async function fetchDeviceUpPorts(deviceId: number): Promise<{ name: string; speedBps: number | null }[]> {
  return request(`${BASE_DEVICES}/${deviceId}/monitor/ports`)
}
