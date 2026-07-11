import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Printer } from '../types'
import * as api from '../api/printers'
import { ElMessage } from 'element-plus'

const PRINTERS_CACHE_KEY = 'opshub_printers_cache'
const PRINTERS_TTL = 5 * 60 * 1000 // 5 分钟

function readPrintersCache(): { list: Printer[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(PRINTERS_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}
function writePrintersCache(list: Printer[]) {
  try { localStorage.setItem(PRINTERS_CACHE_KEY, JSON.stringify({ list, ts: Date.now() })) } catch {}
}
function clearPrintersCache() {
  try { localStorage.removeItem(PRINTERS_CACHE_KEY) } catch {}
}

export const usePrintersStore = defineStore('printers', () => {
  const printers = ref<Printer[]>([])
  const loading = ref(false)

  const total = computed(() => printers.value.length)
  const normalCount = computed(() => printers.value.filter(p => p.status === '正常').length)
  const lowInkCount = computed(() => printers.value.filter(p => p.status === '缺墨' || p.status === '故障').length)

  async function loadPrinters() {
    const cached = readPrintersCache()
    if (cached) {
      printers.value = cached.list
      if (Date.now() - cached.ts < PRINTERS_TTL) return
    }
    loading.value = true
    try {
      const { list } = await api.fetchPrinters()
      printers.value = list
      writePrintersCache(list)
    } catch (e: any) {
      if (!cached) ElMessage.error(e.message || '加载打印机数据失败')
      else console.warn('[printers] 静默刷新失败:', e.message)
    } finally {
      loading.value = false
    }
  }

  async function addPrinter(printer: Omit<Printer, 'id'>) {
    const created = await api.createPrinter(printer)
    printers.value.push(created)
    clearPrintersCache()
    return created
  }

  async function updatePrinter(id: number, data: Partial<Printer>) {
    await api.updatePrinter(id, data)
    const idx = printers.value.findIndex(p => p.id === id)
    if (idx !== -1) printers.value[idx] = { ...printers.value[idx], ...data }
    clearPrintersCache()
  }

  async function deletePrinter(id: number) {
    await api.deletePrinter(id)
    printers.value = printers.value.filter(p => p.id !== id)
    clearPrintersCache()
  }

  async function deletePrinters(ids: number[]) {
    await api.batchDeletePrinters(ids)
    printers.value = printers.value.filter(p => !ids.includes(p.id))
    clearPrintersCache()
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
