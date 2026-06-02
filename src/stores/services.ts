import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Service } from '../mock/services'
import * as api from '../api/services'

export const useServicesStore = defineStore('services', () => {
  const services = ref<Service[]>([])
  const checking = ref(false)
  const loading = ref(false)

  // 启动时从后端加载数据
  async function loadServices() {
    loading.value = true
    try {
      const data = await api.fetchServices({ pageSize: 100 })
      services.value = data.list
    } catch (err) {
      console.error('[services] 加载失败:', err)
    } finally {
      loading.value = false
    }
  }

  // 批量检测连通性
  async function checkAllServices() {
    checking.value = true
    services.value.forEach(s => { s.status = 'checking' })

    try {
      const result = await api.checkAllServices()
      // 根据后端返回更新状态
      for (const r of result.results) {
        const svc = services.value.find(s => s.id === r.id)
        if (svc) {
          svc.status = r.status as Service['status']
        }
      }
    } catch (err) {
      console.error('[services] 检测失败:', err)
    } finally {
      checking.value = false
    }
  }

  // 新增服务
  async function addService(service: Omit<Service, 'id'>) {
    try {
      const created = await api.createService(service)
      services.value.push(created)
    } catch (err) {
      console.error('[services] 创建失败:', err)
      throw err
    }
  }

  // 更新服务
  async function updateService(id: number, data: Partial<Service>) {
    try {
      if (Object.keys(data).length <= 3 && (data.status || data.notes || data.description)) {
        // 部分更新
        const updated = await api.patchService(id, data)
        const idx = services.value.findIndex(s => s.id === id)
        if (idx !== -1) services.value[idx] = updated
      } else {
        // 全量更新
        const updated = await api.updateService(id, data as any)
        const idx = services.value.findIndex(s => s.id === id)
        if (idx !== -1) services.value[idx] = updated
      }
    } catch (err) {
      console.error('[services] 更新失败:', err)
      throw err
    }
  }

  // 删除服务
  async function deleteService(id: number) {
    try {
      await api.deleteService(id)
      services.value = services.value.filter(s => s.id !== id)
    } catch (err) {
      console.error('[services] 删除失败:', err)
      throw err
    }
  }

  return { services, checking, loading, loadServices, checkAllServices, addService, updateService, deleteService }
})
