import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mockDevices, type Device } from '../mock/devices'

export const useDevicesStore = defineStore('devices', () => {
  const devices = ref<Device[]>([...mockDevices])

  const total = computed(() => devices.value.length)
  const normalCount = computed(() => devices.value.filter(d => d.status === '正常').length)
  const repairCount = computed(() => devices.value.filter(d => d.status === '维修中').length)

  function addDevice(device: Device) { devices.value.push(device) }
  function updateDevice(id: number, data: Partial<Device>) {
    const idx = devices.value.findIndex(d => d.id === id)
    if (idx !== -1) devices.value[idx] = { ...devices.value[idx], ...data }
  }
  function deleteDevice(id: number) { devices.value = devices.value.filter(d => d.id !== id) }

  return { devices, total, normalCount, repairCount, addDevice, updateDevice, deleteDevice }
})
