<!-- src/views/DevicesView.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDevicesStore } from '../stores/devices'
import type { Device, Rack } from '../mock/devices'
import type { SlotInfo } from '../utils/rack-utils'
import { DEVICE_TYPE_LABELS } from '../utils/rack-utils'
import RackCard from '../components/devices/RackCard.vue'
import DeviceForm from '../components/devices/DeviceForm.vue'
import { useDragDrop } from '../components/devices/useDragDrop'

const router = useRouter()
const store = useDevicesStore()

// --- Floor filter ---
const activeFloor = computed({
  get: () => store.selectedFloor,
  set: (v) => { store.selectedFloor = v },
})

// --- Search & filter ---
const searchQuery = ref('')
const filterType = ref('')
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

// --- KPI stats ---
const offlineCount = computed(() => store.total - store.normalCount)
const overallUsagePercent = computed(() => {
  let totalU = 0, usedU = 0
  for (const rack of store.racks) {
    totalU += rack.totalU
    for (const dev of rack.devices) {
      if (dev) usedU += dev.u
    }
  }
  return totalU ? Math.round((usedU / totalU) * 100) : 0
})

// --- Floor stats ---
const floorUsagePercent = computed(() => {
  const result: Record<string, number> = {}
  for (const floor of store.floors) {
    let totalU = 0, usedU = 0
    for (const rack of store.racks) {
      if (rack.floor !== floor) continue
      totalU += rack.totalU
      for (const dev of rack.devices) {
        if (dev) usedU += dev.u
      }
    }
    result[floor] = totalU ? Math.round((usedU / totalU) * 100) : 0
  }
  return result
})

// --- Device type stats ---
const deviceTypeStats = computed(() => {
  const counts: Record<string, number> = {}
  for (const rack of store.racks) {
    for (const dev of rack.devices) {
      if (dev) counts[dev.type] = (counts[dev.type] || 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, label: DEVICE_TYPE_LABELS[type] || type, count }))
    .sort((a, b) => b.count - a.count)
})

// --- Add rack dialog ---
const showAddRackDialog = ref(false)
const newRackForm = ref({ name: '', totalU: 42, floor: store.selectedFloor })

function openAddRackDialog() {
  newRackForm.value = { name: '', totalU: 42, floor: store.selectedFloor }
  showAddRackDialog.value = true
}

function confirmAddRack() {
  if (!newRackForm.value.name) return
  store.addRack({
    id: 'rack-' + Date.now(),
    name: newRackForm.value.name,
    totalU: newRackForm.value.totalU,
    floor: newRackForm.value.floor,
    devices: [],
  })
  showAddRackDialog.value = false
}

// --- Edit rack ---
const showEditRackDialog = ref(false)
const editingRack = ref<Rack | null>(null)
const editRackName = ref('')

function openEditRackDialog(rack: Rack) {
  editingRack.value = rack
  editRackName.value = rack.name
  showEditRackDialog.value = true
}

function saveRackName() {
  if (editingRack.value && editRackName.value) {
    store.updateRackName(editingRack.value.id, editRackName.value)
  }
  showEditRackDialog.value = false
}

// --- Add device dialog ---
const showAddDeviceDialog = ref(false)
const addDeviceRackId = ref('')

function onSlotClick(rack: Rack, _index: number, slot: SlotInfo) {
  if (slot.type === 'empty') {
    addDeviceRackId.value = rack.id
    showAddDeviceDialog.value = true
  } else if (slot.type === 'device' && slot.device) {
    openDeviceDrawer(slot.device, rack.id)
  }
}

function onDeviceSubmit(data: Omit<Device, 'id'>) {
  const rack = store.racks.find(r => r.id === addDeviceRackId.value)
  if (!rack) return
  const occupied: (Device | null)[] = new Array(rack.totalU).fill(null)
  let pos = 0
  for (const dev of rack.devices) {
    if (pos >= rack.totalU) break
    if (dev) { for (let i = 0; i < dev.u; i++) occupied[pos + i] = dev; pos += dev.u }
    else pos++
  }
  let targetOffset = -1
  for (let i = 0; i <= rack.totalU - data.u; i++) {
    let free = true
    for (let j = i; j < i + data.u; j++) { if (occupied[j]) { free = false; break } }
    if (free) { targetOffset = i; break }
  }
  if (targetOffset < 0) return
  store.addDeviceToRack(addDeviceRackId.value, targetOffset, {
    id: Date.now(), ...data,
  } as Device)
  showAddDeviceDialog.value = false
}

// --- Device drawer ---
const drawerVisible = ref(false)
const drawerDevice = ref<Device | null>(null)
const drawerRackId = ref('')

function openDeviceDrawer(device: Device, rackId: string) {
  drawerDevice.value = device
  drawerRackId.value = rackId
  drawerVisible.value = true
}

function closeDrawer() {
  drawerVisible.value = false
  drawerDevice.value = null
}

function deleteSelectedDevice() {
  if (drawerDevice.value) {
    store.deleteDevice(drawerDevice.value.id)
    closeDrawer()
  }
}

function updateDeviceStatus(status: Device['status']) {
  if (drawerDevice.value) {
    store.updateDevice(drawerDevice.value.id, { status })
  }
}

// --- Drag and drop ---
const { onMouseDown } = useDragDrop(
  () => store.racks,
  (sourceRackId, targetRackId, targetOffset, deviceId) => {
    store.moveDevice(sourceRackId, targetRackId, targetOffset, deviceId)
  }
)

function handleDragStart(e: MouseEvent, device: Device, rackId: string) {
  const slotEl = (e.target as HTMLElement).closest('.u-slot') as HTMLElement
  const offset = slotEl ? parseInt(slotEl.dataset.uOffset || '0', 10) : 0
  onMouseDown(e, device, rackId, offset)
}
</script>

<template>
  <div class="devices-page">
    <!-- Header -->
    <div class="page-header">
      <button class="back-btn" @click="router.push('/')">← 返回</button>
      <span class="header-divider" />
      <h1 class="page-title">数据中心管理</h1>
      <div style="flex:1" />
      <button class="add-rack-btn" @click="openAddRackDialog">+ 新建机柜</button>
    </div>

    <!-- KPI Bar -->
    <div class="kpi-bar">
      <div class="kpi-card kpi-total">
        <div class="kpi-data"><span class="kpi-number">{{ store.total }}</span><span class="kpi-unit">台</span></div>
        <div class="kpi-label">设备总数</div>
      </div>
      <div class="kpi-card kpi-online">
        <div class="kpi-data"><span class="kpi-number">{{ store.normalCount }}</span><span class="kpi-unit">台</span></div>
        <div class="kpi-label">在线</div>
      </div>
      <div class="kpi-card kpi-offline">
        <div class="kpi-data"><span class="kpi-number">{{ offlineCount }}</span><span class="kpi-unit">台</span></div>
        <div class="kpi-label">停用</div>
      </div>
      <div class="kpi-card kpi-rack">
        <div class="kpi-data"><span class="kpi-number">{{ store.racks.length }}</span><span class="kpi-unit">个</span></div>
        <div class="kpi-label">机柜</div>
      </div>
      <div class="kpi-card kpi-usage">
        <div class="kpi-data"><span class="kpi-number">{{ overallUsagePercent }}</span><span class="kpi-unit">%</span></div>
        <div class="kpi-label">U位使用率</div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="floor-tabs">
        <button v-for="floor in store.floors" :key="floor" class="floor-tab" :class="{ active: activeFloor === floor }" @click="activeFloor = floor">{{ floor }}</button>
      </div>
      <input v-model="searchQuery" class="search-input" placeholder="搜索设备...">
      <select v-model="filterType" class="filter-select">
        <option value="">全部类型</option>
        <option v-for="(label, key) in DEVICE_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <span class="filter-count" v-if="searchQuery || filterType">{{ filteredDeviceCount }} 台设备</span>
    </div>

    <!-- Rack Area -->
    <div class="rack-area">
      <RackCard
        v-for="rack in store.floorRacks"
        :key="rack.id"
        :rack="rack"
        @edit-rack="openEditRackDialog"
        @delete-rack="(id: string) => store.deleteRack(id)"
        @slot-click="onSlotClick"
        @drag-start="handleDragStart"
      />
    </div>

    <!-- Stats Section -->
    <div class="stats-section">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-header">楼层使用率</div>
          <div v-for="floor in store.floors" :key="floor" class="fb-row">
            <span class="fb-label">{{ floor }}</span>
            <div class="fb-bar-track"><div class="fb-bar-fill" :style="{ width: (floorUsagePercent[floor] || 0) + '%' }" /></div>
            <span class="fb-pct">{{ floorUsagePercent[floor] || 0 }}%</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">设备类型分布</div>
          <div v-for="item in deviceTypeStats" :key="item.type" class="tb-row">
            <span class="tb-dot" :class="'dot-' + item.type" />
            <span class="tb-label">{{ item.label }}</span>
            <div class="tb-bar-track"><div class="tb-bar-fill" :class="'bg-' + item.type" :style="{ width: ((item.count / store.total) * 100) + '%' }" /></div>
            <span class="tb-count">{{ item.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Rack Dialog -->
    <Teleport to="body">
      <div v-if="showAddRackDialog" class="df-overlay" @click.self="showAddRackDialog = false">
        <div class="df-dialog">
          <div class="df-header">新建机柜</div>
          <div class="df-body">
            <label class="df-field"><span class="df-label">机柜名称</span><input v-model="newRackForm.name" class="df-input" placeholder="如 A区-01号"></label>
            <div class="df-row">
              <label class="df-field" style="flex:1">
                <span class="df-label">U 位数</span>
                <div class="df-radio-group">
                  <label class="df-radio-card" :class="{ active: newRackForm.totalU === 42 }">
                    <input type="radio" v-model.number="newRackForm.totalU" :value="42" />
                    <span class="df-radio-num">42U</span>
                    <span class="df-radio-tag">标准</span>
                  </label>
                  <label class="df-radio-card" :class="{ active: newRackForm.totalU === 24 }">
                    <input type="radio" v-model.number="newRackForm.totalU" :value="24" />
                    <span class="df-radio-num">24U</span>
                    <span class="df-radio-tag">中型</span>
                  </label>
                  <label class="df-radio-card" :class="{ active: newRackForm.totalU === 12 }">
                    <input type="radio" v-model.number="newRackForm.totalU" :value="12" />
                    <span class="df-radio-num">12U</span>
                    <span class="df-radio-tag">小型</span>
                  </label>
                </div>
              </label>
              <label class="df-field" style="flex:1"><span class="df-label">楼层</span><select v-model="newRackForm.floor" class="df-input"><option v-for="f in store.floors" :key="f" :value="f">{{ f }}</option></select></label>
            </div>
          </div>
          <div class="df-footer">
            <button class="df-btn df-btn-cancel" @click="showAddRackDialog = false">取消</button>
            <button class="df-btn df-btn-confirm" @click="confirmAddRack">确定</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Rack Dialog -->
    <Teleport to="body">
      <div v-if="showEditRackDialog" class="df-overlay" @click.self="showEditRackDialog = false">
        <div class="df-dialog">
          <div class="df-header">编辑机柜名称</div>
          <div class="df-body">
            <label class="df-field"><span class="df-label">机柜名称</span><input v-model="editRackName" class="df-input"></label>
          </div>
          <div class="df-footer">
            <button class="df-btn df-btn-cancel" @click="showEditRackDialog = false">取消</button>
            <button class="df-btn df-btn-confirm" @click="saveRackName">保存</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Device Form -->
    <DeviceForm
      :visible="showAddDeviceDialog"
      :rack-id="addDeviceRackId"
      :rack-total-u="store.racks.find(r => r.id === addDeviceRackId)?.totalU || 42"
      @close="showAddDeviceDialog = false"
      @submit="onDeviceSubmit"
    />

    <!-- Device Drawer -->
    <Transition name="drawer-slide">
      <div v-if="drawerVisible" class="drawer-overlay" @click.self="closeDrawer">
        <div class="drawer-panel">
          <div class="drawer-header">
            <span class="drawer-title">{{ drawerDevice?.name }}</span>
            <span class="df-tag">{{ DEVICE_TYPE_LABELS[drawerDevice?.type || ''] }}</span>
            <button class="drawer-close" @click="closeDrawer">✕</button>
          </div>
          <div class="drawer-body">
            <div class="drawer-field"><span class="field-label">型号</span><span class="field-value">{{ drawerDevice?.model }}</span></div>
            <div class="drawer-field"><span class="field-label">IP 地址</span><span class="field-value ip-value">{{ drawerDevice?.ip || '—' }}</span></div>
            <div class="drawer-field"><span class="field-label">U 高度</span><span class="field-value">{{ drawerDevice?.u }}U</span></div>
            <div class="drawer-field"><span class="field-label">端口数</span><span class="field-value">{{ drawerDevice?.ports }}</span></div>
            <div class="drawer-field">
              <span class="field-label">状态</span>
              <div class="df-row">
                <label class="df-radio"><input type="radio" value="正常" :checked="drawerDevice?.status === '正常'" @change="updateDeviceStatus('正常')"> 正常</label>
                <label class="df-radio"><input type="radio" value="停用" :checked="drawerDevice?.status === '停用'" @change="updateDeviceStatus('停用')"> 停用</label>
              </div>
            </div>
          </div>
          <div class="drawer-footer">
            <button class="df-btn df-btn-danger" @click="deleteSelectedDevice">删除设备</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* --- Page Layout --- */
.devices-page { max-width: 1500px; margin: 0 auto; padding: 24px; min-height: 100vh; background: #080b11; }
.page-header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding: 14px 0; border-bottom: 1px solid #1a2230; }
.back-btn { background: none; border: 1px solid transparent; color: #6a7888; cursor: pointer; font-size: 12px; padding: 4px 10px; border-radius: 6px; transition: all 0.15s; font-family: inherit; }
.back-btn:hover { color: #79c0ff; background: rgba(88,166,255,0.06); border-color: rgba(88,166,255,0.15); }
.header-divider { width: 1px; height: 18px; background: #222a38; }
.page-title { font-size: 18px; color: #d8dfe8; margin: 0; font-weight: 700; letter-spacing: -0.3px; }
.add-rack-btn { background: rgba(88,166,255,0.08); color: #79c0ff; border: 1px solid rgba(88,166,255,0.2); padding: 7px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.15s; font-family: inherit; }
.add-rack-btn:hover { background: rgba(88,166,255,0.15); border-color: rgba(88,166,255,0.35); }

/* --- KPI --- */
.kpi-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.kpi-card { flex: 1; background: #141924; border: 1px solid #2a3040; border-radius: 10px; padding: 12px; text-align: center; }
.kpi-data { display: flex; align-items: baseline; justify-content: center; gap: 2px; }
.kpi-number { font-size: 24px; font-weight: 700; color: #e6edf3; }
.kpi-unit { font-size: 12px; color: #606878; }
.kpi-label { font-size: 11px; color: #606878; margin-top: 4px; }
.kpi-online .kpi-number { color: #4af0c0; }
.kpi-offline .kpi-number { color: #ff6b6b; }
.kpi-usage .kpi-number { color: #79c0ff; }

/* --- Toolbar --- */
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; padding: 10px 12px; background: #141924; border: 1px solid #2a3040; border-radius: 8px; flex-wrap: wrap; }
.floor-tabs { display: flex; gap: 8px; }
.floor-tab { padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; background: #141924; border: 1px solid #2a3040; color: #8b9bb4; transition: all 0.2s; }
.floor-tab.active { background: rgba(88,166,255,0.15); border-color: rgba(88,166,255,0.3); color: #79c0ff; }
.floor-tab:hover { border-color: #3a4458; }
.search-input { background: #0d1117; border: 1px solid #2a3040; color: #8b9bb4; padding: 6px 10px; border-radius: 6px; font-size: 12px; flex: 1; min-width: 150px; }
.filter-select { background: #0d1117; border: 1px solid #2a3040; color: #8b9bb4; padding: 6px 10px; border-radius: 6px; font-size: 12px; width: 100px; }
.filter-count { font-size: 11px; color: #606878; white-space: nowrap; }

/* --- Rack Area --- */
.rack-area { display: flex; flex-wrap: wrap; gap: 40px; justify-content: center; align-items: flex-start; margin-bottom: 24px; }

/* --- Stats --- */
.stats-section { margin-top: 32px; padding-top: 24px; border-top: 1px solid #1e2433; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.stat-card { background: #141924; border: 1px solid #2a3040; border-radius: 10px; padding: 16px; }
.stat-card-header { font-size: 12px; color: #606878; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.fb-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.fb-label { font-size: 11px; color: #8b9bb4; width: 30px; flex-shrink: 0; }
.fb-bar-track { flex: 1; height: 6px; background: #1e2433; border-radius: 3px; overflow: hidden; }
.fb-bar-fill { height: 100%; background: linear-gradient(90deg, #4af0c0, #79c0ff); border-radius: 3px; transition: width 0.3s; }
.fb-pct { font-size: 11px; color: #606878; width: 32px; text-align: right; }
.tb-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.tb-dot { width: 8px; height: 8px; border-radius: 50%; }
.tb-label { font-size: 11px; color: #8b9bb4; width: 48px; }
.tb-bar-track { flex: 1; height: 6px; background: #1e2433; border-radius: 3px; overflow: hidden; }
.tb-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.tb-count { font-size: 11px; color: #606878; width: 20px; text-align: right; }
.bg-server { background: #1e4470; } .bg-switch { background: #1e5a44; } .bg-storage { background: #443070; }
.bg-router { background: #70441e; } .bg-firewall { background: #701e1e; } .bg-ups { background: #4a441e; } .bg-pdu { background: #1e3a3a; }
.dot-server { background: #2a5a8a; } .dot-switch { background: #2a7a5a; } .dot-storage { background: #5a3a8a; }
.dot-router { background: #8a5a2a; } .dot-firewall { background: #8a2a2a; } .dot-ups { background: #6a6a2a; } .dot-pdu { background: #2a4a4a; }

/* --- Dialogs --- */
.df-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; }
.df-dialog { background: #141924; border: 1px solid #2a3040; border-radius: 10px; padding: 20px; width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.df-header { font-size: 16px; font-weight: 600; color: #e6edf3; margin-bottom: 16px; }
.df-body { display: flex; flex-direction: column; gap: 12px; }
.df-field { display: flex; flex-direction: column; gap: 4px; }
.df-label { font-size: 12px; color: #606878; }
.df-input { background: #0d1117; border: 1px solid #2a3040; border-radius: 6px; padding: 6px 10px; color: #8b9bb4; font-size: 13px; outline: none; }
.df-input:focus { border-color: #79c0ff; }
.df-row { display: flex; gap: 12px; }
.df-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.df-btn { padding: 6px 16px; border-radius: 6px; border: none; font-size: 13px; cursor: pointer; transition: all 0.2s; }
.df-btn-cancel { background: #1e2433; color: #8b9bb4; }
.df-btn-confirm { background: rgba(88,166,255,0.15); color: #79c0ff; border: 1px solid rgba(88,166,255,0.3); font-weight: 600; }
.df-btn-danger { background: rgba(220,50,50,0.15); color: #ff6b6b; border: 1px solid rgba(220,50,50,0.3); }
.df-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #1e2433; color: #606878; }
.df-radio { font-size: 12px; color: #8b9bb4; display: flex; align-items: center; gap: 4px; }

/* U 位数单选框组 */
.df-radio-group { display: flex; gap: 6px; }
.df-radio-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border-radius: 6px;
  border: 1px solid #2a3040;
  background: #0d1117;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.df-radio-card input { display: none; }
.df-radio-card:hover { border-color: #3a4a60; background: #141c28; }
.df-radio-card.active {
  border-color: rgba(88,166,255,0.4);
  background: rgba(88,166,255,0.08);
  box-shadow: 0 0 8px rgba(88,166,255,0.1);
}
.df-radio-num { font-size: 14px; font-weight: 700; color: #e6edf3; }
.df-radio-tag { font-size: 9px; color: #606878; }

/* --- Drawer --- */
.drawer-overlay { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,0.4); }
.drawer-panel { position: fixed; right: 0; top: 0; bottom: 0; width: 360px; background: #141924; border-left: 1px solid #2a3040; padding: 20px; overflow-y: auto; }
.drawer-header { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
.drawer-title { font-size: 16px; font-weight: 600; color: #e6edf3; }
.drawer-close { margin-left: auto; background: none; border: none; color: #606878; cursor: pointer; font-size: 16px; }
.drawer-body { display: flex; flex-direction: column; gap: 16px; }
.drawer-field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 11px; color: #606878; text-transform: uppercase; }
.field-value { font-size: 13px; color: #8b9bb4; }
.ip-value { font-family: monospace; color: #79c0ff; }
.drawer-footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e2433; }

/* --- Drag (global) --- */
:global(.drag-source) { opacity: 0.35 !important; }
:global(.u-slot.drop-ok) { background: rgba(74,240,192,0.2) !important; border: 2px dashed #4af0c0 !important; box-shadow: 0 0 16px rgba(74,240,192,0.4), inset 0 0 8px rgba(74,240,192,0.1); }
:global(.u-slot.drop-no) { background: rgba(248, 113, 113, 0.1) !important; }

/* --- Transitions --- */
.drawer-slide-enter-active, .drawer-slide-leave-active { transition: transform 0.25s ease; }
.drawer-slide-enter-from .drawer-panel, .drawer-slide-leave-to .drawer-panel { transform: translateX(100%); }
</style>
