<!-- src/views/DevicesView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDevicesStore } from '../stores/devices'
import type { Device, Rack } from '../types'
import type { SlotInfo } from '../utils/rack-utils'
import { DEVICE_TYPE_LABELS } from '../utils/rack-utils'
import RackCard from '../components/devices/RackCard.vue'
import DeviceForm from '../components/devices/DeviceForm.vue'
import { useDragDrop } from '../components/devices/useDragDrop'
import { fetchDict } from '../api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

import DevicesKpiBar from '../components/devices/DevicesKpiBar.vue'
import DevicesToolbar from '../components/devices/DevicesToolbar.vue'
import DevicesStatsPanel from '../components/devices/DevicesStatsPanel.vue'
import RackEditDialog from '../components/devices/RackEditDialog.vue'
import DeviceDrawer from '../components/devices/DeviceDrawer.vue'
import BackButton from '../components/BackButton.vue'

const store = useDevicesStore()
const route = useRoute()
const router = useRouter()

// 设备型号详情
const deviceModels = ref<any[]>([])

onMounted(() => {
  store.loadRacks()
  store.loadFloors()
  store.loadDeviceTypes()
  fetchDict('device-models').then(data => { deviceModels.value = data }).catch((e: any) => console.warn('加载设备型号失败:', e.message))
})

// --- Floor filter ---
const activeFloor = computed({
  get: () => store.selectedFloor,
  set: (v) => { store.selectedFloor = v },
})

// --- Search & filter ---
const searchQuery = ref('')
const searchQueryInput = ref((route.query.search as string) || '')
let devSearchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQueryInput, (v) => {
  if (devSearchTimer) clearTimeout(devSearchTimer)
  devSearchTimer = setTimeout(() => { searchQuery.value = v }, 300)
  router.replace({ query: { ...route.query, search: v || undefined } })
})
const filterType = ref((route.query.type as string) || '')
watch(filterType, (v) => {
  router.replace({ query: { ...route.query, type: v || undefined } })
})
const filteredDeviceCount = computed(() => {
  let count = 0
  for (const rack of store.floorRacks) {
    for (const dev of rack.devices) {
      if (!dev) continue
      if (filterType.value && dev.type !== filterType.value) continue
      if (searchQuery.value && !dev.name.toLowerCase().includes(searchQuery.value.toLowerCase())) continue
      count++
    }
  }
  return count
})

// --- KPI stats (单次遍历所有指标) ---
const deviceStats = computed(() => {
  let totalDevices = 0, normalDevices = 0
  let totalU = 0, usedU = 0
  const floorUsage: Record<string, { total: number; used: number }> = {}
  const typeCounts: Record<string, number> = {}

  for (const rack of store.racks) {
    totalU += rack.totalU
    if (!floorUsage[rack.floor]) floorUsage[rack.floor] = { total: 0, used: 0 }
    floorUsage[rack.floor].total += rack.totalU
    for (const dev of rack.devices) {
      if (!dev) continue
      totalDevices++
      if (dev.status === '正常') normalDevices++
      usedU += dev.u
      floorUsage[rack.floor].used += dev.u
      typeCounts[dev.type] = (typeCounts[dev.type] || 0) + 1
    }
  }

  const typeStats = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, label: DEVICE_TYPE_LABELS[type] || type, count, pct: totalDevices ? Math.round((count / totalDevices) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  return {
    totalDevices, normalDevices,
    stoppedDevices: totalDevices - normalDevices,
    overallUsagePercent: totalU ? Math.round((usedU / totalU) * 100) : 0,
    floorUsagePercent: Object.fromEntries(
      Object.entries(floorUsage).map(([f, u]) => [f, u.total ? Math.round((u.used / u.total) * 100) : 0])
    ),
    typeStats,
  }
})

// --- Rack dialogs (新建/编辑) ---
const showRackDialog = ref(false)
const editingRack = ref<Rack | null>(null)

function openAddRackDialog() {
  editingRack.value = null
  showRackDialog.value = true
}

function openEditRackDialog(rack: Rack) {
  editingRack.value = rack
  showRackDialog.value = true
}

async function handleCreateRack(data: { name: string; totalU: number; floor: string }) {
  try {
    await store.addRackToServer(data.name, data.floor, data.totalU)
    ElMessage.success('机柜创建成功')
    showRackDialog.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '创建失败')
  }
}

async function handleSaveRack(data: { id: string; name: string }) {
  try {
    await store.updateRackOnServer(data.id, data.name)
    ElMessage.success('修改成功')
    showRackDialog.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '修改失败')
  }
}

// --- Add device dialog ---
const showAddDeviceDialog = ref(false)
const addDeviceRackId = ref('')
const addDeviceUOffset = ref(0)

function onSlotClick(rack: Rack, _index: number, slot: SlotInfo) {
  if (slot.type === 'empty') {
    addDeviceRackId.value = rack.id
    addDeviceUOffset.value = slot.uOffset
    showAddDeviceDialog.value = true
  } else if (slot.type === 'device' && slot.device) {
    openDeviceDrawer(slot.device, rack.id)
  }
}

async function onDeviceSubmit(data: Omit<Device, 'id'>) {
  const rack = store.racks.find(r => r.id === addDeviceRackId.value)
  if (!rack) return

  const offset = addDeviceUOffset.value
  const occupied: (Device | null)[] = new Array(rack.totalU).fill(null)
  let pos = 0
  for (const dev of rack.devices) {
    if (pos >= rack.totalU) break
    if (dev) { for (let i = 0; i < dev.u; i++) occupied[pos + i] = dev; pos += dev.u }
    else pos++
  }

  let canPlace = true
  if (offset + data.u > rack.totalU) {
    canPlace = false
  } else {
    for (let j = offset; j < offset + data.u; j++) {
      if (occupied[j]) { canPlace = false; break }
    }
  }

  let targetOffset = -1
  if (canPlace) {
    targetOffset = offset
  } else {
    for (let i = 0; i <= rack.totalU - data.u; i++) {
      let free = true
      for (let j = i; j < i + data.u; j++) { if (occupied[j]) { free = false; break } }
      if (free) { targetOffset = i; break }
    }
  }

  if (targetOffset < 0) { ElMessage.warning('机柜剩余 U 不足，请选择其他位置'); return }
  try {
    await store.addDeviceToRackOnServer(addDeviceRackId.value, targetOffset, data)
    ElMessage.success('设备添加成功')
  } catch (e: any) {
    ElMessage.error(e.message || '添加失败')
  }
  showAddDeviceDialog.value = false
}

// --- Device drawer ---
const drawerVisible = ref(false)
const drawerDevice = ref<Device | null>(null)

function openDeviceDrawer(device: Device, _rackId: string) {
  drawerDevice.value = device
  drawerVisible.value = true
}

function closeDrawer() {
  drawerVisible.value = false
  drawerDevice.value = null
}

function deleteSelectedDevice() {
  if (!drawerDevice.value) return
  ElMessageBox.confirm(`确定删除设备「${drawerDevice.value.name}」？`, '确认删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      await store.deleteDeviceFromServer(drawerDevice.value!.id)
      ElMessage.success('删除成功')
      closeDrawer()
    } catch (e: any) {
      ElMessage.error(e.message || '删除失败')
    }
  }).catch(() => {})
}

async function updateDeviceStatus(status: string) {
  if (drawerDevice.value) {
    try {
      await store.updateDeviceOnServer(drawerDevice.value.id, { status: status as Device['status'] })
    } catch (e: any) {
      ElMessage.error(e.message || '更新失败')
    }
  }
}

// --- Drag and drop ---
const { onMouseDown } = useDragDrop(
  () => store.racks,
  async (_sourceRackId, targetRackId, targetOffset, deviceId) => {
    try {
      await store.moveDeviceOnServer(deviceId, targetRackId, targetOffset)
    } catch (e: any) {
      ElMessage.error(e.message || '移动设备失败')
    }
  }
)

function handleDragStart(e: MouseEvent, device: Device, rackId: string) {
  const slotEl = (e.target as HTMLElement).closest('.u-slot') as HTMLElement
  const offset = slotEl ? parseInt(slotEl.dataset.uOffset || '0', 10) : 0
  onMouseDown(e, device, rackId, offset)
}
</script>

<template>
  <div class="devices-page" v-loading="store.loading" element-loading-text="加载中...">
    <!-- Header -->
    <div class="page-header">
      <BackButton to="/" />
      <span class="header-divider" />
      <h1 class="page-title">数据中心管理</h1>
      <div style="flex:1" />
      <button class="add-rack-btn" @click="openAddRackDialog">+ 新建机柜</button>
    </div>

    <DevicesKpiBar
      :total-devices="deviceStats.totalDevices"
      :normal-devices="deviceStats.normalDevices"
      :stopped-devices="deviceStats.stoppedDevices"
      :rack-count="store.racks.length"
      :usage-percent="deviceStats.overallUsagePercent"
    />

    <DevicesToolbar
      :floors="store.floors"
      :active-floor="activeFloor"
      :search="searchQueryInput"
      :type-filter="filterType"
      :filtered-count="filteredDeviceCount"
      :device-type-labels="DEVICE_TYPE_LABELS"
      @update:activeFloor="activeFloor = $event"
      @update:search="searchQueryInput = $event"
      @update:typeFilter="filterType = $event"
    />

    <!-- Rack Area -->
    <div class="rack-area">
      <RackCard
        v-for="rack in store.floorRacks"
        :key="rack.id"
        :rack="rack"
        @edit-rack="openEditRackDialog"
        @delete-rack="async (id: string) => { try { await ElMessageBox.confirm('确定删除该机柜？所有设备将被移除。', '确认删除', { type: 'warning' }); await store.deleteRackFromServer(id); ElMessage.success('删除成功') } catch (e: any) { if (e !== 'cancel') ElMessage.error(e.message || '删除失败') } }"
        @slot-click="onSlotClick"
        @drag-start="handleDragStart"
      />
    </div>

    <DevicesStatsPanel
      :floors="store.floors"
      :floor-usage="deviceStats.floorUsagePercent"
      :type-stats="deviceStats.typeStats"
    />

    <RackEditDialog
      v-model="showRackDialog"
      :floors="store.floors"
      :rack="editingRack"
      @create="handleCreateRack"
      @save="handleSaveRack"
    />

    <DeviceForm
      :visible="showAddDeviceDialog"
      :rack-id="addDeviceRackId"
      :rack-total-u="store.racks.find(r => r.id === addDeviceRackId)?.totalU || 42"
      @close="showAddDeviceDialog = false"
      @submit="onDeviceSubmit"
    />

    <DeviceDrawer
      :visible="drawerVisible"
      :device="drawerDevice"
      :device-models="deviceModels"
      :type-info="drawerDevice ? store.getTypeInfo(drawerDevice.type) : null"
      @close="closeDrawer"
      @delete="deleteSelectedDevice"
      @update-status="updateDeviceStatus"
    />
  </div>
</template>

<style scoped>
/* --- Page Layout --- */
.devices-page { padding: 24px; min-height: 100vh; background: var(--dv-page-bg); }
.page-header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding: 14px 0; border-bottom: 1px solid var(--dv-header-border); }
.header-divider { width: 1px; height: 18px; background: var(--dv-header-divider); }
.page-title { font-size: 18px; color: var(--dv-light-text); margin: 0; font-weight: 700; letter-spacing: -0.3px; }
.add-rack-btn { background: rgba(88,166,255,0.08); color: var(--dv-accent-blue-glow); border: 1px solid rgba(88,166,255,0.2); padding: 7px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.15s; font-family: inherit; }
.add-rack-btn:hover { background: rgba(88,166,255,0.15); border-color: rgba(88,166,255,0.35); }

/* --- Rack Area --- */
.rack-area { display: flex; flex-wrap: wrap; gap: 40px; justify-content: flex-start; align-items: flex-start; margin-bottom: 24px; }

/* --- Drag (global) --- */
:global(.drag-source) { opacity: 0.35 !important; }
:global(.u-slot.drop-ok) { background: rgba(74,240,192,0.2) !important; border: 2px dashed var(--dv-accent-green) !important; box-shadow: 0 0 16px rgba(74,240,192,0.4), inset 0 0 8px rgba(74,240,192,0.1); }
:global(.u-slot.drop-no) { background: rgba(248, 113, 113, 0.1) !important; }
</style>