import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mockRacks, FLOORS } from '../mock/devices'
import type { Device, Rack } from '../mock/devices'
import { buildOccupied, buildCompactDevices, canPlaceAt } from '../utils/rack-utils'

export const useDevicesStore = defineStore('devices', () => {
  const racks = ref<Rack[]>([...mockRacks])
  const floors = FLOORS
  const selectedFloor = ref(FLOORS[0])

  const floorRacks = computed(() =>
    racks.value.filter(r => r.floor === selectedFloor.value)
  )

  function addRack(rack: Rack) {
    racks.value.push(rack)
  }

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
    const occupied = buildOccupied(rack)
    for (let i = uPosition; i < uPosition + device.u && i < rack.totalU; i++) {
      if (occupied[i]) return
    }
    for (let i = uPosition; i < uPosition + device.u && i < rack.totalU; i++) {
      occupied[i] = device
    }
    rack.devices = buildCompactDevices(occupied, rack.totalU)
  }

  function removeDeviceFromRack(rackId: string, deviceId: number) {
    const rack = racks.value.find(r => r.id === rackId)
    if (!rack) return
    const occupied = buildOccupied(rack)
    for (let i = 0; i < rack.totalU; i++) {
      if (occupied[i]?.id === deviceId) {
        occupied[i] = null
      }
    }
    rack.devices = buildCompactDevices(occupied, rack.totalU)
  }

  function moveDevice(sourceRackId: string, targetRackId: string, targetOffset: number, deviceId: number) {
    const sourceRack = racks.value.find(r => r.id === sourceRackId)
    const targetRack = racks.value.find(r => r.id === targetRackId)
    if (!sourceRack || !targetRack) return
    const sourceOccupied = buildOccupied(sourceRack)
    const device = sourceOccupied.find(d => d?.id === deviceId)
    if (!device) return
    if (!canPlaceAt(targetRack, targetOffset, device.u, deviceId)) return
    removeDeviceFromRack(sourceRackId, deviceId)
    if (sourceRackId === targetRackId) {
      const newOccupied = buildOccupied(sourceRack)
      for (let i = targetOffset; i < targetOffset + device.u; i++) {
        newOccupied[i] = device
      }
      targetRack.devices = buildCompactDevices(newOccupied, targetRack.totalU)
    } else {
      addDeviceToRack(targetRackId, targetOffset, device)
    }
  }

  function updateDevice(deviceId: number, data: Partial<Device>) {
    for (const rack of racks.value) {
      for (const dev of rack.devices) {
        if (dev?.id === deviceId) {
          Object.assign(dev, data)
          return
        }
      }
    }
  }

  function deleteDevice(deviceId: number) {
    for (const rack of racks.value) {
      removeDeviceFromRack(rack.id, deviceId)
    }
  }

  const total = computed(() => {
    let count = 0
    for (const rack of racks.value) {
      for (const dev of rack.devices) {
        if (dev) count++
      }
    }
    return count
  })

  const normalCount = computed(() => {
    let count = 0
    for (const rack of racks.value) {
      for (const dev of rack.devices) {
        if (dev?.status === '正常') count++
      }
    }
    return count
  })

  return {
    racks, floors, selectedFloor, floorRacks,
    addRack, deleteRack, updateRackName,
    addDeviceToRack, removeDeviceFromRack, moveDevice,
    updateDevice, deleteDevice, total, normalCount,
  }
})
