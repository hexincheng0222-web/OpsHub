// src/stores/topology.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { TopologyEdge, TopologyNode } from '../types/topology'
import * as api from '../api/topology'
import { fetchAllDevices } from '../api/devices'
import { computeLayout, NODE_W, NODE_H, TOPO_W, TOPO_H } from '../composables/useTopologyLayout'

export interface DeviceItem {
  id: number
  name: string
  type: string
  ip: string | null
  ports: number
}

export const useTopologyStore = defineStore('topology', () => {
  const nodes = ref<TopologyNode[]>([])
  const edges = ref<TopologyEdge[]>([])
  const allDevices = ref<DeviceItem[]>([])
  const loading = ref(false)

  // 交互状态
  const selectedDeviceId = ref<number | null>(null)
  const connectDialog = ref<{ a: TopologyNode; b: TopologyNode } | null>(null)

  const nodeMap = computed(() => new Map(nodes.value.map(n => [n.device_id, n])))
  const deviceMap = computed(() => new Map(allDevices.value.map(d => [d.id, d])))
  // 未上画布的本地设备（设备库列表）
  const availableDevices = computed(() =>
    allDevices.value.filter(d => !nodeMap.value.has(d.id))
  )
  const edgeCountByDevice = computed(() => {
    const m = new Map<number, number>()
    for (const e of edges.value) {
      m.set(e.source_device_id, (m.get(e.source_device_id) || 0) + 1)
      m.set(e.target_device_id, (m.get(e.target_device_id) || 0) + 1)
    }
    return m
  })

  async function load(): Promise<void> {
    loading.value = true
    try {
      const [topo, devices] = await Promise.all([api.fetchTopology(), fetchAllDevices()])
      nodes.value = topo.nodes
      edges.value = topo.edges
      allDevices.value = devices.map(d => ({ id: d.id, name: d.name, type: d.type, ip: d.ip, ports: d.ports }))
    } catch (e: any) {
      ElMessage.error(e.message || '加载拓扑失败')
    } finally {
      loading.value = false
    }
  }

  /** 添加设备到画布：自动找空白位置 */
  async function addNode(deviceId: number): Promise<void> {
    try {
      const pos = findEmptySpot()
      const node = await api.addTopologyNode(deviceId, pos.x, pos.y)
      nodes.value.push(node)
    } catch (e: any) {
      ElMessage.error(e.message || '添加节点失败')
      throw e
    }
  }

  /** 在 1600×900 画布上找第一个不重叠的空白位（返回中心点坐标） */
  function findEmptySpot(): { x: number; y: number } {
    const stepX = NODE_W + 30
    const stepY = NODE_H + 30
    for (let y = NODE_H / 2 + 20; y < TOPO_H - NODE_H / 2; y += stepY) {
      for (let x = NODE_W / 2 + 20; x < TOPO_W - NODE_W / 2; x += stepX) {
        const occupied = nodes.value.some(n =>
          Math.abs(n.x - x) < NODE_W && Math.abs(n.y - y) < NODE_H
        )
        if (!occupied) return { x, y }
      }
    }
    return { x: NODE_W / 2 + 20, y: NODE_H / 2 + 20 }
  }

  /** 移除节点（后端级联删连线） */
  async function removeNode(deviceId: number): Promise<void> {
    try {
      await api.removeTopologyNode(deviceId)
      nodes.value = nodes.value.filter(n => n.device_id !== deviceId)
      edges.value = edges.value.filter(e => e.source_device_id !== deviceId && e.target_device_id !== deviceId)
      if (selectedDeviceId.value === deviceId) selectedDeviceId.value = null
    } catch (e: any) {
      ElMessage.error(e.message || '移除节点失败')
      throw e
    }
  }

  /** 更新节点位置（乐观更新 + 落库） */
  async function updatePos(deviceId: number, x: number, y: number): Promise<void> {
    const node = nodes.value.find(n => n.device_id === deviceId)
    if (node) { node.x = x; node.y = y }
    try { await api.updateTopologyNodePosition(deviceId, x, y) } catch { /* 位置保存失败静默 */ }
  }

  /** 批量保存位置（自动布局） */
  async function bulkUpdatePos(items: { device_id: number; x: number; y: number }[]): Promise<void> {
    try {
      await api.bulkUpdateTopologyNodes(items)
      for (const it of items) {
        const node = nodes.value.find(n => n.device_id === it.device_id)
        if (node) { node.x = it.x; node.y = it.y }
      }
    } catch (e: any) {
      ElMessage.error(e.message || '保存布局失败')
    }
  }

  /** 自动布局全部节点 */
  async function setAutoLayout(): Promise<void> {
    const layout = computeLayout(nodes.value.map(n => ({ device_id: n.device_id, name: n.name, type: n.type })))
    await bulkUpdatePos([...layout].map(([device_id, pos]) => ({ device_id, x: pos.x, y: pos.y })))
  }

  async function addEdge(payload: {
    source_device_id: number
    source_port: string
    target_device_id: number
    target_port: string
    protocol?: string
  }): Promise<void> {
    try {
      const edge = await api.addTopologyEdge(payload)
      edges.value.push(edge)
    } catch (e: any) {
      ElMessage.error(e.message || '添加连线失败')
      throw e
    }
  }

  async function removeEdge(id: number): Promise<void> {
    try {
      await api.removeTopologyEdge(id)
      edges.value = edges.value.filter(e => e.id !== id)
    } catch (e: any) {
      ElMessage.error(e.message || '删除连线失败')
      throw e
    }
  }

  return {
    nodes, edges, allDevices, loading,
    selectedDeviceId, connectDialog,
    nodeMap, deviceMap, availableDevices, edgeCountByDevice,
    load, addNode, removeNode, updatePos, bulkUpdatePos, setAutoLayout, addEdge, removeEdge,
  }
})
