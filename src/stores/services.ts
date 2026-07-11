import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Service } from '../types'
import * as api from '../api/services'
import { ElMessage } from 'element-plus'

const SVC_CACHE_KEY = 'opshub_services_cache'
const SVC_TTL = 5 * 60 * 1000 // 5 分钟

function readSvcCache(): { list: Service[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(SVC_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}
function writeSvcCache(list: Service[]) {
  try { localStorage.setItem(SVC_CACHE_KEY, JSON.stringify({ list, ts: Date.now() })) } catch {}
}
function clearSvcCache() {
  try { localStorage.removeItem(SVC_CACHE_KEY) } catch {}
}

export const useServicesStore = defineStore('services', () => {
  const services = ref<Service[]>([])
  const checkResults = ref<Record<number, { status: string; latencyMs: number | null }>>({})
  const loading = ref(false)
  const checking = ref(false)

  const total = computed(() => services.value.length)
  const onlineCount = computed(() => services.value.filter(s => s.status === 'online').length)
  const offlineCount = computed(() => services.value.filter(s => s.status === 'offline').length)
  const maintenanceCount = computed(() => services.value.filter(s => s.status === 'maintenance').length)

  const favorites = ref<Set<number>>(new Set())

  async function refreshFavorites() {
    try {
      const list = await api.fetchFavorites()
      favorites.value = new Set(list.map(s => s.id))
    } catch { /* 非阻塞 */}
  }
  function isFavorite(id: number) { return favorites.value.has(id) }
  async function toggleFavorite(id: number) {
    if (favorites.value.has(id)) {
      await api.removeFavorite(id)
      favorites.value.delete(id)
    } else {
      await api.addFavorite(id)
      favorites.value.add(id)
    }
  }

  async function loadServices() {
    const cached = readSvcCache()
    if (cached) {
      services.value = cached.list
      if (Date.now() - cached.ts < SVC_TTL) return
    }
    loading.value = true
    try {
      const list = await api.fetchAllServices()
      services.value = list
      writeSvcCache(list)
    } catch (e: any) {
      if (!cached) ElMessage.error(e.message || '加载服务数据失败')
      else console.warn('服务数据静默刷新失败:', e.message)
    } finally {
      loading.value = false
    }
  }

  async function addService(svc: Omit<Service, 'id'>) {
    const created = await api.createService(svc)
    services.value.push(created)
    clearSvcCache()
    return created
  }

  async function updateService(id: number, data: Partial<Service>) {
    await api.updateService(id, data as any)
    const idx = services.value.findIndex(s => s.id === id)
    if (idx !== -1) services.value[idx] = { ...services.value[idx], ...data }
    clearSvcCache()
  }

  async function patchService(id: number, data: Partial<Service>) {
    await api.patchService(id, data)
    const idx = services.value.findIndex(s => s.id === id)
    if (idx !== -1) services.value[idx] = { ...services.value[idx], ...data }
    clearSvcCache()
  }

  async function deleteService(id: number) {
    await api.deleteService(id)
    services.value = services.value.filter(s => s.id !== id)
    delete checkResults.value[id]
    clearSvcCache()
  }

  async function checkAllServices() {
    checking.value = true
    try {
      const data = await api.checkAllServices()
      const map = new Map(data.results.map(r => [r.id, r]))
      for (const s of services.value) {
        const r = map.get(s.id)
        if (r) s.status = r.status as Service['status']
      }
      for (const r of data.results) {
        checkResults.value[r.id] = { status: r.status, latencyMs: r.latencyMs }
      }
      // 同步缓存，避免下次 loadServices 命中旧缓存把状态冲回去
      writeSvcCache(services.value)
    } catch (e: any) {
      console.warn('连通性检测失败:', e.message)
      ElMessage.warning(e.message || '连通性检测失败')
    } finally {
      checking.value = false
    }
  }

  async function checkService(id: number) {
    const result = await api.checkService(id)
    const idx = services.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      services.value[idx].status = result.status as Service['status']
      writeSvcCache(services.value) // 同步缓存
    }
    checkResults.value[id] = { status: result.status, latencyMs: result.latencyMs }
    return result
  }

  return {
    services, checkResults, loading, checking,
    total, onlineCount, offlineCount, maintenanceCount,
    loadServices, addService, updateService, patchService, deleteService,
    checkAllServices, checkService,
    favorites, refreshFavorites, isFavorite, toggleFavorite,
  }
})
