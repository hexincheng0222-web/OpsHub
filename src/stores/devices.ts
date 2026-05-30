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

  function addDeviceToRack(rackId: string, uPosition: number, device: Device) {
    const rack = racks.value.find(r => r.id === rackId)
    if (!rack) return
    // 标记占用的 U 位
    rack.devices[uPosition] = device
    for (let k = 1; k < device.u; k++) {
      if (uPosition + k < rack.totalU) {
        rack.devices[uPosition + k] = null // 占位标记
      }
    }
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

  return { racks, floors, selectedFloor, floorRacks, addRack, addDeviceToRack, removeDeviceFromRack, updateDevice, deleteDevice }
})
