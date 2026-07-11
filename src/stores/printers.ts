import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Printer } from '../types'
import * as api from '../api/printers'
import { ElMessage } from 'element-plus'

export const usePrintersStore = defineStore('printers', () => {
  const printers = ref<Printer[]>([])
  const loading = ref(false)

  const total = computed(() => printers.value.length)
  const normalCount = computed(() => printers.value.filter(p => p.status === '正常').length)
  const lowInkCount = computed(() => printers.value.filter(p => p.status === '缺墨' || p.status === '故障').length)

  async function loadPrinters() {
    loading.value = true
    try {
      const { list } = await api.fetchPrinters()
      printers.value = list
    } catch (e: any) {
      console.error('[printers] 加载失败:', e)
      ElMessage.error(e.message || '加载打印机数据失败')
    } finally {
      loading.value = false
    }
  }

  async function addPrinter(printer: Omit<Printer, 'id'>) {
    const created = await api.createPrinter(printer)
    printers.value.push(created)
    return created
  }

  async function updatePrinter(id: number, data: Partial<Printer>) {
    await api.updatePrinter(id, data)
    const idx = printers.value.findIndex(p => p.id === id)
    if (idx !== -1) printers.value[idx] = { ...printers.value[idx], ...data }
  }

  async function deletePrinter(id: number) {
    await api.deletePrinter(id)
    printers.value = printers.value.filter(p => p.id !== id)
  }

  async function deletePrinters(ids: number[]) {
    await api.batchDeletePrinters(ids)
    printers.value = printers.value.filter(p => !ids.includes(p.id))
  }

  async function batchImport(rows: Partial<Printer>[], autoCreateDict = false) {
    const result = await api.importPrinters(rows, autoCreateDict)
    await loadPrinters() // 重新加载以获取数据库分配的 id
    return result
  }

  async function restorePrinters(rows: Partial<Printer>[]) {
    await api.batchCreatePrinters(rows)
    await loadPrinters()
  }

  return {
    printers, loading, total, normalCount, lowInkCount,
    loadPrinters, addPrinter, updatePrinter, deletePrinter, deletePrinters, batchImport, restorePrinters,
  }
})
