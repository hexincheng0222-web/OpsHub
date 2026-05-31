import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mockRacks, FLOORS, type Rack, type Device } from '../mock/devices'

export const useDevicesStore = defineStore('devices', () => {
  const racks = ref<Rack[]>([...mockRacks])
  const floors = FLOORS
  const selectedFloor = ref(FLOORS[0])

  const floorRacks = computed(() =>
    racks.value.filter(r => r.floor === selectedFloor.value)
  )

  function addRack(rack: Rack) { racks.value.push(rack) }

  function deleteRack(rackId: string) {
    racks.value = racks.value.filter(r => r.id !== rackId)
  }

  function updateRackName(rackId: string, name: string) {
    const rack = racks.value.find(r => r.id === rackId)
    if (rack) rack.name = name
  }

  function addDeviceToRack(rackId: string, uPosition: number, device: Device) {
    const rack = racks.value.find(r => r.id === rackId)
    if (!rack) return
    const totalU = rack.totalU

    // 构建 occupied 映射
    const occupied: (Device | null)[] = new Array(totalU).fill(null)
    let pos = 0
    for (const dev of rack.devices) {
      if (dev === null) { pos++ }
      else {
        for (let k = 0; k < dev.u && pos + k < totalU; k++) occupied[pos + k] = dev
        pos += dev.u
      }
      if (pos >= totalU) break
    }

    // 检查目标区域
    for (let k = 0; k < device.u; k++) {
      if (uPosition + k >= totalU || occupied[uPosition + k] !== null) return
    }

    // 放置
    for (let k = 0; k < device.u; k++) occupied[uPosition + k] = device

    // 重建：只存设备，跳过多U设备的后续位置
    rack.devices = buildCompactDevices(occupied, totalU)
  }

  function buildCompactDevices(occupied: (Device | null)[], totalU: number): (Device | null)[] {
    const result: (Device | null)[] = []
    const seen = new Set<number>()
    for (let i = 0; i < totalU; i++) {
      const dev = occupied[i]
      if (dev === null) {
        result.push(null)
      } else if (!seen.has(dev.id)) {
        seen.add(dev.id)
        result.push(dev)
      }
      // 多U设备的后续位置不加入数组
    }
    return result
  }

  function removeDeviceFromRack(rackId: string, deviceId: number) {
    const rack = racks.value.find(r => r.id === rackId)
    if (!rack) return
    const totalU = rack.totalU
    const occupied: (Device | null)[] = new Array(totalU).fill(null)
    let pos = 0
    for (const dev of rack.devices) {
      if (dev === null) { pos++ }
      else {
        for (let k = 0; k < dev.u && pos + k < totalU; k++) occupied[pos + k] = dev
        pos += dev.u
      }
      if (pos >= totalU) break
    }

    // 清除目标设备
    for (let i = 0; i < totalU; i++) {
      if (occupied[i] && occupied[i]!.id === deviceId) {
        const uSize = occupied[i]!.u
        for (let k = 0; k < uSize; k++) {
          if (i + k < totalU) occupied[i + k] = null
        }
        break
      }
    }

    rack.devices = buildCompactDevices(occupied, totalU)
  }

  function updateDevice(deviceId: number, data: Partial<Device>) {
    for (const rack of racks.value) {
      const idx = rack.devices.findIndex(d => d !== null && d!.id === deviceId)
      if (idx !== -1) {
        rack.devices[idx] = { ...rack.devices[idx]!, ...data }
        break
      }
    }
  }

  function deleteDevice(deviceId: number) {
    for (const rack of racks.value) {
      removeDeviceFromRack(rack.id, deviceId)
    }
  }

  // 统计
  const total = computed(() => {
    let count = 0
    for (const rack of racks.value) {
      for (const dev of rack.devices) {
        if (dev !== null) count++
      }
    }
    return count
  })

  const normalCount = computed(() => {
    let count = 0
    for (const rack of racks.value) {
      for (const dev of rack.devices) {
        if (dev !== null && dev.status === '正常') count++
      }
    }
    return count
  })

  return { racks, floors, selectedFloor, floorRacks, addRack, deleteRack, updateRackName, addDeviceToRack, removeDeviceFromRack, updateDevice, deleteDevice, total, normalCount }
})
