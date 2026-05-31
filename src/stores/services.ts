import { defineStore } from 'pinia'
import { ref } from 'vue'
import { mockServices, type Service } from '../mock/services'

export const useServicesStore = defineStore('services', () => {
  const services = ref<Service[]>([...mockServices])
  const checking = ref(false)

  async function pingService(svc: Service): Promise<'online' | 'offline'> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      await fetch(svc.url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal })
      clearTimeout(timeout)
      // no-cors 返回 opaque response 代表服务器可达
      return 'online'
    } catch {
      // 网络错误 / 超时 → 不可达
      return 'offline'
    }
  }

  async function checkAllServices() {
    checking.value = true
    // 先全部标为 checking
    services.value.forEach(s => { s.status = 'checking' })

    await Promise.allSettled(
      services.value.map(async (svc) => {
        const result = await pingService(svc)
        svc.status = result
      })
    )

    checking.value = false
  }

  function addService(service: Omit<Service, 'id'>) {
    const maxId = services.value.reduce((max, s) => Math.max(max, s.id), 0)
    services.value.push({ ...service, id: maxId + 1 })
  }

  function updateService(id: number, data: Partial<Service>) {
    const idx = services.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      services.value[idx] = { ...services.value[idx], ...data }
    }
  }

  function deleteService(id: number) {
    services.value = services.value.filter(s => s.id !== id)
  }

  return { services, checking, checkAllServices, addService, updateService, deleteService }
})
