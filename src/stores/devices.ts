import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { FLOORS } from '../mock/devices'
import type { Device, Rack } from '../mock/devices'
import { buildOccupied, buildCompactDevices } from '../utils/rack-utils'
import * as api from '../api/devices'
import { fetchDict } from '../api/admin'

export const useDevicesStore = defineStore('devices', () => {
  const racks = ref<Rack[]>([])
  const floors = ref<string[]>([...FLOORS])
  const selectedFloor = ref(FLOORS[0])
  const loading = ref(false)

  // 设备类型字典（从后端加载，供卡片等组件使用）
  const deviceTypes = ref<{ key: string; name: string; abbr: string; icon: string; color: string }[]>([])

  async function loadDeviceTypes() {
    try {
      const data = await fetchDict('device-types')
      if (data.length > 0) deviceTypes.value = data
    } catch (e) {
      console.error('加载设备类型失败:', e)
    }
  }

  function getTypeInfo(typeKey: string) {
    return deviceTypes.value.find(t => t.key === typeKey) || null
  }

  // 从 API 加载楼层列表
  async function loadFloors() {
    try {
      const data = await fetchDict('device-floors')
      if (data.length > 0) {
        floors.value = data.map((f: any) => f.name)
        if (!floors.value.includes(selectedFloor.value)) {
          selectedFloor.value = floors.value[0]
        }
      }
    } catch (e) {
      console.error('加载楼层列表失败:', e)
    }
  }

  const floorRacks = computed(() =>
    racks.value.filter(r => r.floor === selectedFloor.value)
  )

  // 从后端加载数据
  async function loadRacks() {
    loading.value = true
    try {
      const data = await api.fetchRacks()
      const loaded: Rack[] = []
      for (const r of data.racks) {
        const detail = await api.fetchRackSlots(r.id)
        const devices: (Device | null)[] = []
        let i = 0
        while (i < detail.slots.length) {
          const slot = detail.slots[i]
          if (slot.device) {
            devices.push(slot.device as Device)
            i += slot.device.u
          } else {
            devices.push(null)
            i++
          }
        }
        loaded.push({ id: r.id, name: r.name, floor: r.floor, totalU: r.totalU, devices })
      }
      racks.value = loaded
    } catch (err) {
      console.error('[devices] 加载失败:', err)
    } finally {
      loading.value = false
    }
  }

  function addRack(rack: Rack) {
    racks.value.push(rack)
  }

  async function addRackToServer(name: string, floor: string, totalU: number) {
    try {
      await api.createRack({ name, floor, totalU })
      await loadRacks()
    } catch (err) {
      console.error('[devices] 创建机柜失败:', err)
      throw err
    }
  }

  function deleteRack(rackId: string) {
    racks.value = racks.value.filter(r => r.id !== rackId)
  }

  async function deleteRackFromServer(rackId: string) {
    try {
      await api.deleteRack(rackId)
      racks.value = racks.value.filter(r => r.id !== rackId)
    } catch (err) {
      console.error('[devices] 删除机柜失败:', err)
      throw err
    }
  }

  function updateRackName(rackId: string, name: string) {
    const rack = racks.value.find(r => r.id === rackId)
    if (rack) rack.name = name
  }

  async function updateRackOnServer(rackId: string, name: string, floor?: string) {
    try {
      await api.updateRack(rackId, { name, floor })
      const rack = racks.value.find(r => r.id === rackId)
      if (rack) { rack.name = name; if (floor) rack.floor = floor }
    } catch (err) {
      console.error('[devices] 更新机柜失败:', err)
      throw err
    }
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

  async function addDeviceToRackOnServer(rackId: string, uOffset: number, data: Omit<Device, 'id'>) {
    try {
      const device = await api.addDeviceToRack(rackId, { ...data, uOffset } as any)
      addDeviceToRack(rackId, uOffset, device as Device)
      return device
    } catch (err) {
      console.error('[devices] 添加设备失败:', err)
      throw err
    }
  }

  function removeDeviceFromRack(rackId: string, deviceId: number) {
    const rack = racks.value.find(r => r.id === rackId)
    if (!rack) return
    const occupied = buildOccupied(rack)
    for (let i = 0; i < rack.totalU; i++) {
      if (occupied[i]?.id === deviceId) occupied[i] = null
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
    removeDeviceFromRack(sourceRackId, deviceId)
    if (sourceRackId === targetRackId) {
      const newOccupied = buildOccupied(sourceRack)
      for (let i = targetOffset; i < targetOffset + device.u; i++) newOccupied[i] = device
      targetRack.devices = buildCompactDevices(newOccupied, targetRack.totalU)
    } else {
      addDeviceToRack(targetRackId, targetOffset, device)
    }
  }

  async function moveDeviceOnServer(deviceId: number, targetRackId: string, targetUOffset: number) {
    let sourceRackId = ''
    for (const rack of racks.value) {
      const occupied = buildOccupied(rack)
      if (occupied.find(d => d?.id === deviceId)) { sourceRackId = rack.id; break }
    }
    if (!sourceRackId) return
    try {
      await api.moveDevice(deviceId, targetRackId, targetUOffset)
      moveDevice(sourceRackId, targetRackId, targetUOffset, deviceId)
    } catch (err) {
      console.error('[devices] 移动设备失败:', err)
      throw err
    }
  }

  function updateDevice(deviceId: number, data: Partial<Device>) {
    for (const rack of racks.value) {
      for (const dev of rack.devices) {
        if (dev?.id === deviceId) { Object.assign(dev, data); return }
      }
    }
  }

  async function updateDeviceOnServer(deviceId: number, data: Partial<Device>) {
    try {
      await api.updateDevice(deviceId, data)
      updateDevice(deviceId, data)
    } catch (err) {
      console.error('[devices] 更新设备失败:', err)
      throw err
    }
  }

  function deleteDevice(deviceId: number) {
    for (const rack of racks.value) removeDeviceFromRack(rack.id, deviceId)
  }

  async function deleteDeviceFromServer(deviceId: number) {
    try {
      await api.deleteDevice(deviceId)
      deleteDevice(deviceId)
    } catch (err) {
      console.error('[devices] 删除设备失败:', err)
      throw err
    }
  }

  const total = computed(() => {
    let count = 0
    for (const rack of racks.value) for (const dev of rack.devices) if (dev) count++
    return count
  })

  const normalCount = computed(() => {
    let count = 0
    for (const rack of racks.value) for (const dev of rack.devices) if (dev?.status === '正常') count++
    return count
  })

  return {
    racks, floors, selectedFloor, floorRacks, loading,
    deviceTypes, loadDeviceTypes, getTypeInfo,
    loadRacks, loadFloors,
    addRack, addRackToServer,
    deleteRack, deleteRackFromServer,
    updateRackName, updateRackOnServer,
    addDeviceToRack, addDeviceToRackOnServer,
    removeDeviceFromRack,
    moveDevice, moveDeviceOnServer,
    updateDevice, updateDeviceOnServer,
    deleteDevice, deleteDeviceFromServer,
    total, normalCount,
  }
})
