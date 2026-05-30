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
    // 直接在指定位置放入设备，getSlotData 会根据 device.u 自动跨越多个U位
    rack.devices[uPosition] = device
  }

  function removeDeviceFromRack(rackId: string, deviceId: number) {
    const rack = racks.value.find(r => r.id === rackId)
    if (!rack) return
    const idx = rack.devices.findIndex(d => d !== null && d.id === deviceId)
    if (idx === -1) return
    const device = rack.devices[idx]!
    // 清除设备和占用的 U 位
    for (let k = 0; k < device.u; k++) {
      if (idx + k < rack.totalU) rack.devices[idx + k] = null
    }
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
