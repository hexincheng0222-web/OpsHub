import type { Device, Rack } from '../types'

export interface SlotInfo {
  type: 'device' | 'empty' | 'occupied'
  device?: Device
  uSize?: number
  uOffset: number
  hidden?: boolean
}

export function buildOccupied(rack: Rack): (Device | null)[] {
  const occupied: (Device | null)[] = new Array(rack.totalU).fill(null)
  let pos = 0
  for (const dev of rack.devices) {
    if (pos >= rack.totalU) break
    if (dev) {
      for (let i = 0; i < dev.u && pos + i < rack.totalU; i++) {
        occupied[pos + i] = dev
      }
      pos += dev.u
    } else {
      pos++
    }
  }
  return occupied
}

export function buildCompactDevices(occupied: (Device | null)[], totalU: number): (Device | null)[] {
  const result: (Device | null)[] = []
  const seen = new Set<number>()
  for (let i = 0; i < totalU; i++) {
    const dev = occupied[i]
    if (dev) {
      if (!seen.has(dev.id)) {
        result.push(dev)
        seen.add(dev.id)
      }
    } else {
      result.push(null)
    }
  }
  return result
}

export function buildSlotData(rack: Rack): SlotInfo[] {
  const occupied = buildOccupied(rack)
  const slots: SlotInfo[] = []
  const seen = new Set<number>()
  for (let i = 0; i < rack.totalU; i++) {
    const dev = occupied[i]
    if (!dev) {
      slots.push({ type: 'empty', uOffset: i })
    } else if (!seen.has(dev.id)) {
      slots.push({ type: 'device', device: dev, uSize: dev.u, uOffset: i })
      seen.add(dev.id)
    }
    // 多 U 设备的后续 U 位跳过，由 grid-row: span 自动占据
  }
  return slots
}

export function canPlaceAt(rack: Rack, offset: number, uSize: number, excludeDevId?: number): boolean {
  if (offset < 0 || offset + uSize > rack.totalU) return false
  const occupied = buildOccupied(rack)
  for (let i = offset; i < offset + uSize; i++) {
    const dev = occupied[i]
    if (dev && dev.id !== excludeDevId) return false
  }
  return true
}

export function getUBadgeLabel(slot: SlotInfo): string {
  if (slot.uSize && slot.uSize > 1) {
    return `U${slot.uOffset + slot.uSize}-${slot.uOffset + 1}`
  }
  return `U${slot.uOffset + 1}`
}

export const DEVICE_TYPE_LABELS: Record<string, string> = {
  server: '服务器',
  switch: '交换机',
  storage: '存储',
  router: '路由器',
  firewall: '防火墙',
  ups: 'UPS',
  pdu: 'PDU',
}
