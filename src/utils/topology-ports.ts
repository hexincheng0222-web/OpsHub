// src/utils/topology-ports.ts — 端口名生成/合并工具
import { fetchDeviceSnapshot } from '../api/devices'

// 会话级缓存：device_id -> 实时端口名列表
const portCache = new Map<number, string[]>()

/** 获取设备端口列表：优先实时采集，否则按数量生成占位 */
export async function getDevicePorts(deviceId: number, devicePorts: number, deviceType: string): Promise<string[]> {
  const cached = portCache.get(deviceId)
  if (cached) return cached

  try {
    const res = await fetchDeviceSnapshot(deviceId)
    if (res.available && res.snapshot?.ports?.length) {
      const names = res.snapshot.ports.map(p => p.name)
      portCache.set(deviceId, names)
      return names
    }
  } catch { /* 采集不可用走生成占位 */ }

  const count = Math.min(Math.max(devicePorts, 0), 200)
  const names: string[] = []
  for (let i = 1; i <= count; i++) {
    if (deviceType === 'server' || deviceType === 'storage') {
      names.push(`${deviceType === 'server' ? 'eth' : 'Eth'}${i - 1}`)
    } else if (deviceType === 'firewall') {
      names.push(`port${i}`)
    } else {
      names.push(`GigabitEthernet0/0/${i}`)
    }
  }
  portCache.set(deviceId, names)
  return names
}

export function clearPortCache(): void {
  portCache.clear()
}
