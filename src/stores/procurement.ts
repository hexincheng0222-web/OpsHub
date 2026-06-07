import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as computerApi from '../api/computer-procurement'
import * as phoneApi from '../api/phone-procurement'

export interface ComputerProcurement {
  id: number
  model: string
  department: string
  applicant: string
  macAddress: string
  deviceModel: string
  ceNumber: string
  actualUser: string
  approvalNumber: string
  receiveDate: string
  assetNumber: string
  deliveryDate: string
  deliveryPerson: string
  pickupApproval: string
  ceProcessed: boolean
  price: number
}

export interface PhoneProcurement {
  id: number
  assetNumber: string
  partNo: string
  serialNo: string
  imei: string
  arrivalDate: string
  pickupDate: string
  brand: string
  model: string
  assetLink: string
  department: string
  handler: string
  recipient: string
  dingtalkCreator: string
  purchaseType: string
  dingtalkFlow: string
  originalOwner: string
  notes: string
}

// ===== 电脑采购 Store =====
export const useComputerProcurementStore = defineStore('computerProcurement', () => {
  const computers = ref<ComputerProcurement[]>([])
  const total = computed(() => computers.value.length)

  async function loadComputers(params?: { page?: number; pageSize?: number; search?: string; department?: string }) {
    const { list } = await computerApi.fetchComputers(params)
    computers.value = list
  }

  async function addComputer(c: Omit<ComputerProcurement, 'id'>) {
    const created = await computerApi.createComputer(c)
    computers.value.push(created)
    return created
  }

  async function updateComputer(id: number, data: Partial<ComputerProcurement>) {
    await computerApi.updateComputer(id, data)
    const idx = computers.value.findIndex(c => c.id === id)
    if (idx !== -1) computers.value[idx] = { ...computers.value[idx], ...data }
  }

  async function deleteComputer(id: number) {
    await computerApi.deleteComputer(id)
    computers.value = computers.value.filter(c => c.id !== id)
  }

  async function batchDelete(ids: number[]) {
    await computerApi.batchDeleteComputers(ids)
    computers.value = computers.value.filter(c => !ids.includes(c.id))
  }

  async function batchImport(rows: Partial<ComputerProcurement>[]) {
    const result = await computerApi.importComputers(rows)
    await loadComputers()
    return result
  }

  return { computers, total, loadComputers, addComputer, updateComputer, deleteComputer, batchDelete, batchImport }
})

// ===== 手机采购 Store =====
export const usePhoneProcurementStore = defineStore('phoneProcurement', () => {
  const phones = ref<PhoneProcurement[]>([])
  const total = computed(() => phones.value.length)

  async function loadPhones(params?: { page?: number; pageSize?: number; search?: string; department?: string; purchaseType?: string }) {
    const { list } = await phoneApi.fetchPhones(params)
    phones.value = list
  }

  async function addPhone(p: Omit<PhoneProcurement, 'id'>) {
    const created = await phoneApi.createPhone(p)
    phones.value.push(created)
    return created
  }

  async function updatePhone(id: number, data: Partial<PhoneProcurement>) {
    await phoneApi.updatePhone(id, data)
    const idx = phones.value.findIndex(p => p.id === id)
    if (idx !== -1) phones.value[idx] = { ...phones.value[idx], ...data }
  }

  async function deletePhone(id: number) {
    await phoneApi.deletePhone(id)
    phones.value = phones.value.filter(p => p.id !== id)
  }

  async function batchDelete(ids: number[]) {
    await phoneApi.batchDeletePhones(ids)
    phones.value = phones.value.filter(p => !ids.includes(p.id))
  }

  async function batchImport(rows: Partial<PhoneProcurement>[]) {
    const result = await phoneApi.importPhones(rows)
    await loadPhones()
    return result
  }

  return { phones, total, loadPhones, addPhone, updatePhone, deletePhone, batchDelete, batchImport }
})
