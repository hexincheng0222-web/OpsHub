import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as computerApi from '../api/computer-procurement'
import * as phoneApi from '../api/phone-procurement'
import { ElMessage } from 'element-plus'

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
  const loading = ref(false)

  async function loadComputers(params?: { page?: number; pageSize?: number; search?: string; department?: string }) {
    loading.value = true
    try {
      const { list } = await computerApi.fetchComputers({ pageSize: 9999, ...params })
      computers.value = list
    } catch (e: any) {
      ElMessage.error(e.message || '加载电脑采购数据失败')
    } finally {
      loading.value = false
    }
  }

  async function addComputer(c: Omit<ComputerProcurement, 'id'>) {
    const created = await computerApi.createComputer(c)
    computers.value.push(created)
    return created
  }

  async function updateComputer(id: number, data: Partial<ComputerProcurement>) {
    const updated = await computerApi.updateComputer(id, data)  // 拿后端 toApi 响应
    const idx = computers.value.findIndex(c => c.id === id)
    if (idx !== -1) computers.value[idx] = updated  // 用后端响应而非请求体
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

  return { computers, total, loading, loadComputers, addComputer, updateComputer, deleteComputer, batchDelete, batchImport }
})

// ===== 手机采购 Store =====
export const usePhoneProcurementStore = defineStore('phoneProcurement', () => {
  const phones = ref<PhoneProcurement[]>([])
  const total = computed(() => phones.value.length)
  const loading = ref(false)

  async function loadPhones(params?: { page?: number; pageSize?: number; search?: string; department?: string; purchaseType?: string }) {
    loading.value = true
    try {
      const { list } = await phoneApi.fetchPhones({ pageSize: 9999, ...params })
      phones.value = list
    } catch (e: any) {
      ElMessage.error(e.message || '加载手机采购数据失败')
    } finally {
      loading.value = false
    }
  }

  async function addPhone(p: Omit<PhoneProcurement, 'id'>) {
    const created = await phoneApi.createPhone(p)
    phones.value.push(created)
    return created
  }

  async function updatePhone(id: number, data: Partial<PhoneProcurement>) {
    const updated = await phoneApi.updatePhone(id, data)  // 拿后端 toApi 响应
    const idx = phones.value.findIndex(p => p.id === id)
    if (idx !== -1) phones.value[idx] = updated  // 用后端响应而非请求体
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

  return { phones, total, loading, loadPhones, addPhone, updatePhone, deletePhone, batchDelete, batchImport }
})
