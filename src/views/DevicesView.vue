<!-- src/views/DevicesView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDevicesStore } from '../stores/devices'
import type { Device, Rack } from '../mock/devices'
import type { SlotInfo } from '../utils/rack-utils'
import { DEVICE_TYPE_LABELS } from '../utils/rack-utils'
import RackCard from '../components/devices/RackCard.vue'
import DeviceForm from '../components/devices/DeviceForm.vue'
import { useDragDrop } from '../components/devices/useDragDrop'
import { fetchDict } from '../api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const store = useDevicesStore()

// 设备型号详情（从后端字典加载）
const deviceModels = ref<any[]>([])

onMounted(() => {
  store.loadRacks()
  store.loadFloors()
  store.loadDeviceTypes()
  fetchDict('device-models').then(data => { deviceModels.value = data }).catch(() => {})
})

// 根据型号名查找详细信息
function getModelDetail(modelName: string) {
  return deviceModels.value.find(m => m.name === modelName) || null
}

// --- Floor filter ---
const activeFloor = computed({
  get: () => store.selectedFloor,
  set: (v) => { store.selectedFloor = v },
})

// --- Search & filter ---
const searchQuery = ref('')
const searchQueryInput = ref('')
let devSearchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQueryInput, (v) => {
  if (devSearchTimer) clearTimeout(devSearchTimer)
  devSearchTimer = setTimeout(() => { searchQuery.value = v }, 300)
})
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
const stoppedCount = computed(() => store.total - store.normalCount)
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

async function confirmAddRack() {
  if (!newRackForm.value.name.trim()) { ElMessage.warning('请输入机柜名称'); return }
  try {
    await store.addRackToServer(newRackForm.value.name, newRackForm.value.floor, newRackForm.value.totalU)
    ElMessage.success('机柜创建成功')
    showAddRackDialog.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '创建失败')
  }
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

async function saveRackName() {
  if (editingRack.value && editRackName.value) {
    try {
      await store.updateRackOnServer(editingRack.value.id, editRackName.value)
      ElMessage.success('修改成功')
    } catch (e: any) {
      ElMessage.error(e.message || '修改失败')
    }
  }
  showEditRackDialog.value = false
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

  // 从点击的 U 位置开始检查是否可放下
  const offset = addDeviceUOffset.value
  const occupied: (Device | null)[] = new Array(rack.totalU).fill(null)
  let pos = 0
  for (const dev of rack.devices) {
    if (pos >= rack.totalU) break
    if (dev) { for (let i = 0; i < dev.u; i++) occupied[pos + i] = dev; pos += dev.u }
    else pos++
  }

  // 检查点击位置是否能放下
  let canPlace = true
  if (offset + data.u > rack.totalU) {
    canPlace = false
  } else {
    for (let j = offset; j < offset + data.u; j++) {
      if (occupied[j]) { canPlace = false; break }
    }
  }

  // 如果点击位置放不下，找第一个可用位置
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

  if (targetOffset < 0) return
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

async function updateDeviceStatus(status: Device['status']) {
  if (drawerDevice.value) {
    try {
      await store.updateDeviceOnServer(drawerDevice.value.id, { status })
    } catch (e: any) {
      ElMessage.error(e.message || '更新失败')
    }
  }
}

// --- Drag and drop ---
const { onMouseDown } = useDragDrop(
  () => store.racks,
  (_sourceRackId, targetRackId, targetOffset, deviceId) => {
    store.moveDeviceOnServer(deviceId, targetRackId, targetOffset)
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
      <button class="back-btn" @click="router.push('/')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回</span>
      </button>
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
        <div class="kpi-data"><span class="kpi-number">{{ stoppedCount }}</span><span class="kpi-unit">台</span></div>
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
      <el-input v-model="searchQueryInput" placeholder="搜索设备..." clearable size="small" style="width:180px" />
      <el-select v-model="filterType" placeholder="全部类型" clearable size="small" style="width:120px">
        <el-option label="全部类型" value="" />
        <el-option v-for="(label, key) in DEVICE_TYPE_LABELS" :key="key" :label="label" :value="key" />
      </el-select>
      <span class="filter-count" v-if="searchQuery || filterType">{{ filteredDeviceCount }} 台设备</span>
    </div>

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
            <span class="df-tag">{{ store.getTypeInfo(drawerDevice?.type || '')?.name || DEVICE_TYPE_LABELS[drawerDevice?.type || ''] }}</span>
            <button class="drawer-close" @click="closeDrawer">✕</button>
          </div>
          <div class="drawer-body">
            <div class="drawer-field"><span class="field-label">型号</span><span class="field-value">{{ drawerDevice?.model }}</span></div>
            <template v-if="getModelDetail(drawerDevice?.model || '')">
              <div class="drawer-field"><span class="field-label">厂商</span><span class="field-value">{{ getModelDetail(drawerDevice?.model || '')?.manufacturer || '—' }}</span></div>
              <div class="drawer-field" v-if="getModelDetail(drawerDevice?.model || '')?.description"><span class="field-label">描述</span><span class="field-value">{{ getModelDetail(drawerDevice?.model || '')?.description }}</span></div>
              <div class="drawer-field" v-if="getModelDetail(drawerDevice?.model || '')?.power_watts"><span class="field-label">功耗</span><span class="field-value">{{ getModelDetail(drawerDevice?.model || '')?.power_watts }}W</span></div>
            </template>
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
.devices-page { max-width: 1500px; margin: 0 auto; padding: 24px; min-height: 100vh; background: var(--dv-page-bg); }
.page-header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding: 14px 0; border-bottom: 1px solid var(--dv-header-border); }
.back-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px 6px 10px;
  background: var(--dv-kpi-bg);
  border: 1px solid var(--dv-kpi-border);
  border-radius: 20px;
  color: var(--dv-light-muted);
  cursor: pointer; font-size: 12px; font-family: inherit;
  transition: all 0.2s ease;
}
.back-btn svg { transition: transform 0.2s ease; }
.back-btn:hover { color: var(--dv-accent-blue-glow); border-color: rgba(88,166,255,0.3); background: rgba(88,166,255,0.06); }
.back-btn:hover svg { transform: translateX(-2px); }
.header-divider { width: 1px; height: 18px; background: var(--dv-header-divider); }
.page-title { font-size: 18px; color: var(--dv-light-text); margin: 0; font-weight: 700; letter-spacing: -0.3px; }
.add-rack-btn { background: rgba(88,166,255,0.08); color: var(--dv-accent-blue-glow); border: 1px solid rgba(88,166,255,0.2); padding: 7px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.15s; font-family: inherit; }
.add-rack-btn:hover { background: rgba(88,166,255,0.15); border-color: rgba(88,166,255,0.35); }

/* --- KPI --- */
.kpi-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.kpi-card { flex: 1; background: var(--dv-kpi-bg); border: 1px solid var(--dv-kpi-border); border-radius: 10px; padding: 12px; text-align: center; }
.kpi-data { display: flex; align-items: baseline; justify-content: center; gap: 2px; }
.kpi-number { font-size: 24px; font-weight: 700; color: var(--dv-light-text); }
.kpi-unit { font-size: 12px; color: var(--dv-light-dim); }
.kpi-label { font-size: 11px; color: var(--dv-light-dim); margin-top: 4px; }
.kpi-online .kpi-number { color: var(--dv-accent-green); }
.kpi-offline .kpi-number { color: var(--dv-accent-red-dim); }
.kpi-usage .kpi-number { color: var(--dv-accent-blue-glow); }

/* --- Toolbar --- */
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; padding: 10px 12px; background: var(--dv-kpi-bg); border: 1px solid var(--dv-kpi-border); border-radius: 8px; flex-wrap: wrap; }
.floor-tabs { display: flex; gap: 8px; }
.floor-tab { padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; background: var(--dv-kpi-bg); border: 1px solid var(--dv-kpi-border); color: var(--dv-light-muted); transition: all 0.2s; }
.floor-tab.active { background: rgba(88,166,255,0.15); border-color: rgba(88,166,255,0.3); color: var(--dv-accent-blue-glow); }
.floor-tab:hover { border-color: var(--dv-header-border); }
.search-input { background: var(--dv-bar-track); border: 1px solid var(--dv-kpi-border); color: var(--dv-light-muted); padding: 6px 10px; border-radius: 6px; font-size: 12px; flex: 1; min-width: 150px; }
.filter-select { background: var(--dv-bar-track); border: 1px solid var(--dv-kpi-border); color: var(--dv-light-muted); padding: 6px 10px; border-radius: 6px; font-size: 12px; width: 100px; }
.filter-count { font-size: 11px; color: var(--dv-light-dim); white-space: nowrap; }

/* --- Rack Area --- */
.rack-area { display: flex; flex-wrap: wrap; gap: 40px; justify-content: center; align-items: flex-start; margin-bottom: 24px; }

/* --- Stats --- */
.stats-section { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--dv-header-border); }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.stat-card { background: var(--dv-stat-card-bg); border: 1px solid var(--dv-stat-card-border); border-radius: 10px; padding: 16px; }
.stat-card-header { font-size: 12px; color: var(--dv-light-dim); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.fb-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.fb-label { font-size: 11px; color: var(--dv-light-muted); width: 30px; flex-shrink: 0; }
.fb-bar-track { flex: 1; height: 6px; background: var(--dv-bar-track); border-radius: 3px; overflow: hidden; }
.fb-bar-fill { height: 100%; background: linear-gradient(90deg, var(--dv-accent-green), var(--dv-accent-blue-glow)); border-radius: 3px; transition: width 0.3s; }
.fb-pct { font-size: 11px; color: var(--dv-light-dim); width: 32px; text-align: right; }
.tb-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.tb-dot { width: 8px; height: 8px; border-radius: 50%; }
.tb-label { font-size: 11px; color: var(--dv-light-muted); width: 48px; }
.tb-bar-track { flex: 1; height: 6px; background: var(--dv-bar-track); border-radius: 3px; overflow: hidden; }
.tb-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.tb-count { font-size: 11px; color: var(--dv-light-dim); width: 20px; text-align: right; }
.bg-server { background: #1e4470; } .bg-switch { background: #1e5a44; } .bg-storage { background: #443070; }
.bg-router { background: #70441e; } .bg-firewall { background: #701e1e; } .bg-ups { background: #4a441e; } .bg-pdu { background: #1e3a3a; }
.dot-server { background: #2a5a8a; } .dot-switch { background: #2a7a5a; } .dot-storage { background: #5a3a8a; }
.dot-router { background: #8a5a2a; } .dot-firewall { background: #8a2a2a; } .dot-ups { background: #6a6a2a; } .dot-pdu { background: #2a4a4a; }

/* --- Dialogs --- */
.df-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.df-dialog { background: var(--dv-stat-card-bg); border: 1px solid var(--dv-stat-card-border); border-radius: 10px; padding: 20px; width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.df-header { font-size: 16px; font-weight: 600; color: var(--dv-light-text); margin-bottom: 16px; }
.df-body { display: flex; flex-direction: column; gap: 12px; }
.df-field { display: flex; flex-direction: column; gap: 4px; }
.df-label { font-size: 12px; color: var(--dv-light-dim); }
.df-input { background: var(--dv-bar-track); border: 1px solid var(--dv-kpi-border); color: var(--dv-light-muted); border-radius: 6px; padding: 6px 10px; font-size: 13px; outline: none; }
.df-input:focus { border-color: var(--dv-accent-blue-glow); }
.df-row { display: flex; gap: 12px; }
.df-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.df-btn { padding: 6px 16px; border-radius: 6px; border: none; font-size: 13px; cursor: pointer; transition: all 0.2s; }
.df-btn-cancel { background: var(--dv-bar-track); color: var(--dv-light-muted); }
.df-btn-confirm { background: rgba(88,166,255,0.15); color: var(--dv-accent-blue-glow); border: 1px solid rgba(88,166,255,0.3); font-weight: 600; }
.df-btn-danger { background: rgba(220,50,50,0.15); color: var(--dv-accent-red-dim); border: 1px solid rgba(220,50,50,0.3); }
.df-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--dv-bar-track); color: var(--dv-light-dim); }
.df-radio { font-size: 12px; color: var(--dv-light-dim); display: flex; align-items: center; gap: 4px; }

/* U 位数单选框组 */
.df-radio-group { display: flex; gap: 6px; }
.df-radio-card {
  border: 1px solid var(--dv-kpi-border);
  background: var(--dv-bar-track);
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.df-radio-card input { display: none; }
.df-radio-card:hover { border-color: var(--dv-header-border); background: var(--dv-kpi-bg); }
.df-radio-card.active {
  border-color: rgba(88,166,255,0.4);
  background: rgba(88,166,255,0.08);
  box-shadow: 0 0 8px rgba(88,166,255,0.1);
}
.df-radio-num { font-size: 14px; font-weight: 700; color: var(--dv-light-text); }
.df-radio-tag { font-size: 9px; color: var(--dv-light-dim); }

/* --- Drawer --- */
.drawer-overlay { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,0.4); }
.drawer-panel { position: fixed; right: 0; top: 0; bottom: 0; width: 360px; background: var(--dv-stat-card-bg); border-left: 1px solid var(--dv-stat-card-border); padding: 20px; overflow-y: auto; }
.drawer-header { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
.drawer-title { font-size: 16px; font-weight: 600; color: var(--dv-light-text); }
.drawer-close { margin-left: auto; background: none; border: none; color: var(--dv-light-dim); cursor: pointer; font-size: 16px; }
.drawer-body { display: flex; flex-direction: column; gap: 16px; }
.drawer-field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 11px; color: var(--dv-light-dim); text-transform: uppercase; }
.field-value { font-size: 13px; color: var(--dv-light-muted); }
.ip-value { font-family: monospace; color: var(--dv-accent-blue-glow); }
.drawer-footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--dv-header-border); }

/* --- Drag (global) --- */
:global(.drag-source) { opacity: 0.35 !important; }
:global(.u-slot.drop-ok) { background: rgba(74,240,192,0.2) !important; border: 2px dashed var(--dv-accent-green) !important; box-shadow: 0 0 16px rgba(74,240,192,0.4), inset 0 0 8px rgba(74,240,192,0.1); }
:global(.u-slot.drop-no) { background: rgba(248, 113, 113, 0.1) !important; }

/* --- Transitions --- */
.drawer-slide-enter-active, .drawer-slide-leave-active { transition: transform 0.25s ease; }
.drawer-slide-enter-from .drawer-panel, .drawer-slide-leave-to .drawer-panel { transform: translateX(100%); }
</style>
