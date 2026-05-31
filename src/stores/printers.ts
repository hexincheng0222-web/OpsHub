import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mockPrinters, type Printer } from '../mock/printers'

export const usePrintersStore = defineStore('printers', () => {
  const printers = ref<Printer[]>([...mockPrinters])

  const total = computed(() => printers.value.length)
  const normalCount = computed(() => printers.value.filter(p => p.status === '正常').length)
  const lowInkCount = computed(() => printers.value.filter(p => p.status === '缺墨' || p.inkLevel < 20).length)

  function addPrinter(printer: Printer) { printers.value.push(printer) }
  function updatePrinter(id: number, data: Partial<Printer>) {
    const idx = printers.value.findIndex(p => p.id === id)
    if (idx !== -1) printers.value[idx] = { ...printers.value[idx], ...data }
  }
  function deletePrinter(id: number) { printers.value = printers.value.filter(p => p.id !== id) }

  return { printers, total, normalCount, lowInkCount, addPrinter, updatePrinter, deletePrinter }
})
