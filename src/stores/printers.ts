import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { type Printer } from '../mock/printers'

export const usePrintersStore = defineStore('printers', () => {
  const printers = ref<Printer[]>([])

  const total = computed(() => printers.value.length)
  const normalCount = computed(() => printers.value.filter(p => p.status === '正常').length)
  const lowInkCount = computed(() => printers.value.filter(p => p.status === '缺墨' || p.status === '故障').length)

  function addPrinter(printer: Printer) { printers.value.push(printer) }
  function updatePrinter(id: number, data: Partial<Printer>) {
    const idx = printers.value.findIndex(p => p.id === id)
    if (idx !== -1) printers.value[idx] = { ...printers.value[idx], ...data }
  }
  function deletePrinter(id: number) { printers.value = printers.value.filter(p => p.id !== id) }
  function deletePrinters(ids: number[]) {
    printers.value = printers.value.filter(p => !ids.includes(p.id))
  }
  function batchImport(imported: Printer[]) {
    const maxId = printers.value.reduce((max, p) => Math.max(max, p.id), 0)
    imported.forEach((p, i) => {
      printers.value.push({ ...p, id: maxId + i + 1 })
    })
  }

  return { printers, total, normalCount, lowInkCount, addPrinter, updatePrinter, deletePrinter, deletePrinters, batchImport }
})
