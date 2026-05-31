<template>
  <div class="devices-page">
    <div class="top-bar">
      <span class="back-btn" @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon> 返回首页
      </span>
      <h3>设备信息</h3>
      <el-button type="primary" @click="openAddRackDialog">
        <el-icon><Plus /></el-icon> 添加机柜
      </el-button>
    </div>

    <!-- 楼层标签 -->
    <div class="floor-tabs">
      <div
        v-for="floor in store.floors"
        :key="floor"
        class="floor-tab"
        :class="{ active: store.selectedFloor === floor }"
        @click="store.selectedFloor = floor"
      >
        {{ floor }}
      </div>
    </div>

    <!-- 搜索筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索设备..."
        clearable
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="filterType" placeholder="类型" clearable class="filter-select">
        <el-option label="服务器" value="server" />
        <el-option label="交换机" value="switch" />
        <el-option label="存储" value="storage" />
        <el-option label="路由器" value="router" />
        <el-option label="防火墙" value="firewall" />
        <el-option label="UPS" value="ups" />
        <el-option label="PDU" value="pdu" />
      </el-select>
      <span v-if="searchQuery || filterType" class="filter-result">
        {{ filteredDeviceCount }} 个
      </span>
    </div>

    <!-- 机柜视图 -->
    <div class="rack-wrapper">
      <div v-for="rack in store.floorRacks" :key="rack.id" class="rack-container">
        <div class="rack-title-row">
          <span class="rack-title">{{ rack.name }}</span>
          <div class="rack-actions">
            <button class="rack-action-btn" @click="openEditRackDialog(rack)" title="编辑名称">
              <el-icon :size="14"><Edit /></el-icon>
            </button>
            <el-popconfirm title="确定删除此机柜？" @confirm="deleteRack(rack.id)">
              <template #reference>
                <button class="rack-action-btn danger" title="删除机柜">
                  <el-icon :size="14"><Delete /></el-icon>
                </button>
              </template>
            </el-popconfirm>
          </div>
        </div>
        <div class="rack">
          <div class="rack-top">
            <div class="vent" v-for="i in 5" :key="i"></div>
          </div>
          <div class="rack-units">
            <div class="u-labels">
              <div v-for="u in rack.totalU" :key="u" class="u-label">{{ rack.totalU - u + 1 }}</div>
            </div>
            <div class="u-slots">
              <div
                v-for="(slot, index) in getSlotData(rack)"
                :key="index"
                class="u-slot"
                :class="getSlotClass(slot)"
                :style="getSlotStyle(slot)"
                :data-u-offset="slot._uOffset"
                @click="onSlotClick(rack, index, slot)"
              >
                <span v-if="slot.type === 'empty'" class="empty-slot-icon">+</span>
                <template v-if="slot && slot.type === 'device'">
                  <div
                    class="device-inner"
                    :class="{
                      dimmed: slot.hidden,
                      disabled: slot.device!.status === '停用'
                    }"
                    @mousedown.stop="onMouseDown"
                  >
                    <div class="device-leds" :class="{ 'led-off': slot.device!.status === '停用' }">
                      <div class="led led-solid"></div>
                      <div class="led led-blink"></div>
                    </div>
                    <span class="device-u-badge">{{ getUBadge(slot, index) }}</span>
                    <span class="device-name">{{ slot.device!.name }}</span>
                    <span class="device-model">{{ slot.device!.model }}</span>
                    <div v-if="slot.device!.ports > 0" class="device-ports">
                      <div
                        v-for="p in Math.min(Math.floor(slot.device!.ports / 8), 6)"
                        :key="p"
                        class="port"
                        :class="{ active: p <= Math.floor(slot.device!.ports / 8 * 0.6) }"
                      ></div>
                    </div>
                    <span v-if="slot.device!.u > 1" class="device-badge">{{ slot.device!.u }}U</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <div class="rack-bottom">
            <div class="feet" style="margin-right:60px"></div>
            <div class="feet" style="margin-left:60px"></div>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="rack-stats">
          <div class="stat">
            <div class="stat-value used">{{ getUsedU(rack) }}</div>
            <div class="stat-label">已用 U</div>
          </div>
          <div class="stat">
            <div class="stat-value free">{{ rack.totalU - getUsedU(rack) }}</div>
            <div class="stat-label">空闲 U</div>
          </div>
          <div class="stat">
            <div class="stat-value total">{{ rack.totalU }}</div>
            <div class="stat-label">总 U 数</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图例 -->
    <div class="legend">
      <div class="legend-item"><div class="legend-color lc-server"></div>服务器</div>
      <div class="legend-item"><div class="legend-color lc-switch"></div>交换机</div>
      <div class="legend-item"><div class="legend-color lc-storage"></div>存储</div>
      <div class="legend-item"><div class="legend-color lc-router"></div>路由器</div>
      <div class="legend-item"><div class="legend-color lc-firewall"></div>防火墙</div>
      <div class="legend-item"><div class="legend-color lc-ups"></div>UPS</div>
      <div class="legend-item"><div class="legend-color lc-pdu"></div>PDU</div>
    </div>

    <!-- 统计概览 -->
    <div class="stats-overview">
      <h4 class="stats-title">统计概览</h4>
      <div class="stats-grid">
        <!-- 楼层使用率 -->
        <div class="stats-card">
          <div class="stats-card-title">楼层机柜使用率</div>
          <div class="floor-stats">
            <div v-for="floor in store.floors" :key="floor" class="floor-stat-row">
              <span class="floor-stat-label">{{ floor }}</span>
              <div class="floor-stat-bar">
                <div class="floor-stat-fill" :style="{ width: getFloorUsagePercent(floor) + '%' }"></div>
              </div>
              <span class="floor-stat-value">{{ getFloorUsedU(floor) }}/{{ getFloorTotalU(floor) }}U</span>
            </div>
          </div>
        </div>
        <!-- 设备类型分布 -->
        <div class="stats-card">
          <div class="stats-card-title">设备类型分布</div>
          <div class="type-stats">
            <div v-for="item in deviceTypeStats" :key="item.type" class="type-stat-row">
              <div class="type-stat-color" :class="'lc-' + item.type"></div>
              <span class="type-stat-label">{{ item.label }}</span>
              <span class="type-stat-count">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加机柜弹窗 -->
    <el-dialog v-model="showAddRackDialog" title="添加机柜" width="400px">
      <el-form :model="newRackForm" label-width="80px">
        <el-form-item label="机柜名称">
          <el-input v-model="newRackForm.name" placeholder="如：机柜 C" />
        </el-form-item>
        <el-form-item label="U 位数">
          <el-select v-model="newRackForm.totalU" style="width: 100%">
            <el-option label="42U（标准机柜）" :value="42" />
            <el-option label="24U（中型机柜）" :value="24" />
            <el-option label="12U（小型机柜）" :value="12" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddRackDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmAddRack">确定添加</el-button>
      </template>
    </el-dialog>

    <!-- 编辑机柜名称弹窗 -->
    <el-dialog v-model="showEditRackDialog" title="编辑机柜名称" width="400px">
      <el-input v-model="editRackName" placeholder="请输入机柜名称" />
      <template #footer>
        <el-button @click="showEditRackDialog = false">取消</el-button>
        <el-button type="primary" @click="saveRackName">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加设备弹窗 -->
    <el-dialog v-model="showAddDeviceDialog" title="添加设备" width="480px">
      <el-form :model="deviceForm" label-width="80px">
        <el-form-item label="设备名称">
          <el-input v-model="deviceForm.name" placeholder="如：ESXi-01" />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-select v-model="deviceForm.type" style="width: 100%">
            <el-option label="服务器" value="server" />
            <el-option label="交换机" value="switch" />
            <el-option label="存储" value="storage" />
            <el-option label="路由器" value="router" />
            <el-option label="防火墙" value="firewall" />
            <el-option label="UPS" value="ups" />
            <el-option label="PDU" value="pdu" />
          </el-select>
        </el-form-item>
        <el-form-item label="品牌型号">
          <el-input v-model="deviceForm.model" placeholder="如：Dell R750" />
        </el-form-item>
        <el-form-item label="占用 U 数">
          <el-input-number v-model="deviceForm.u" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="端口数">
          <el-input-number v-model="deviceForm.ports" :min="0" :max="48" />
        </el-form-item>
        <el-form-item v-if="needsIp" label="IP 地址">
          <el-input v-model="deviceForm.ip" placeholder="如：10.0.1.100" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="deviceForm.status">
            <el-radio value="正常">正常</el-radio>
            <el-radio value="停用">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDeviceDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmAddDevice">确定添加</el-button>
      </template>
    </el-dialog>

    <!-- 设备详情抽屉 -->
    <Transition name="drawer-slide">
      <div v-if="drawerVisible" class="drawer-overlay" @click.self="drawerVisible = false">
        <div class="drawer-panel" v-if="selectedDevice">
          <div class="drawer-header">
            <h3>{{ selectedDevice.name }}</h3>
            <button class="drawer-close" @click="drawerVisible = false">✕</button>
          </div>
          <div class="drawer-content">
            <div class="drawer-icon" :class="'device-' + selectedDevice.type">
              <el-icon :size="32"><component :is="getTypeIcon(selectedDevice.type)" /></el-icon>
            </div>
            <el-tag :type="getTypeTagType(selectedDevice.type)" size="small" effect="dark">
              {{ getTypeLabel(selectedDevice.type) }}
            </el-tag>

            <div class="drawer-section">
              <div class="drawer-label">品牌型号</div>
              <div class="drawer-value">{{ selectedDevice.model }}</div>
            </div>

            <div v-if="selectedDevice.ip" class="drawer-section">
              <div class="drawer-label">IP 地址</div>
              <div class="drawer-value drawer-ip">{{ selectedDevice.ip }}</div>
            </div>

            <div class="drawer-section">
              <div class="drawer-label">占用 U 数</div>
              <div class="drawer-value">{{ selectedDevice.u }}U</div>
            </div>

            <div class="drawer-section">
              <div class="drawer-label">端口数</div>
              <div class="drawer-value">{{ selectedDevice.ports }}</div>
            </div>

            <div class="drawer-section">
              <div class="drawer-label">状态</div>
              <el-radio-group v-model="selectedDevice.status" @change="updateDeviceStatus">
                <el-radio value="正常">正常</el-radio>
                <el-radio value="停用">停用</el-radio>
              </el-radio-group>
            </div>
          </div>
          <div class="drawer-footer">
            <div class="drawer-actions-left">
              <el-button @click="openEditDialog">
                <el-icon><Edit /></el-icon> 编辑
              </el-button>
              <el-popconfirm
                :title="`确定删除「${selectedDevice?.name}」吗？`"
                @confirm="deleteSelectedDevice"
              >
                <template #reference>
                  <el-button type="danger">
                    <el-icon><Delete /></el-icon> 删除
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useDevicesStore } from '../stores/devices'
import type { Device, Rack } from '../mock/devices'

const store = useDevicesStore()

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('selectstart', preventDragSelect)
})

// 拖拽过程中阻止文本选择
function preventDragSelect(e: Event) {
  if (dragState.active) {
    e.preventDefault()
  }
}

const showAddDeviceDialog = ref(false)
const showAddRackDialog = ref(false)
const pendingRackId = ref('')
const pendingSlotIndex = ref(0)
const drawerVisible = ref(false)
const selectedDevice = ref<Device | null>(null)
const selectedRackId = ref('')
const showEditRackDialog = ref(false)
const editingRack = ref<Rack | null>(null)
const editRackName = ref('')
const searchQuery = ref('')
const filterType = ref('')
const newRackForm = reactive({
  name: '',
  totalU: 42
})

// ---- 鼠标拖拽系统 ----
const dragState = {
  active: false,
  rackId: '',
  startOffset: -1,    // 源位置：从顶部起的 0-based 偏移量
  devId: -1,
  targetRackId: '',   // 目标机柜 ID
  targetOffset: -1,   // 目标位置：从顶部起的 0-based 偏移量
  ghostEl: null as HTMLElement | null,
  sourceEl: null as HTMLElement | null,
  currentHighlight: null as HTMLElement | null,
}

const filteredDeviceCount = computed(() => {
  let count = 0
  for (const rack of store.floorRacks) {
    for (const dev of rack.devices) {
      if (dev && matchesFilter(dev)) count++
    }
  }
  return count
})

const deviceForm = reactive({
  name: '',
  type: 'server' as Device['type'],
  model: '',
  u: 1,
  ports: 4,
  status: '正常' as Device['status'],
  ip: ''
})

const needsIp = computed(() => {
  return ['server', 'switch', 'router', 'firewall', 'storage'].includes(deviceForm.type)
})

interface SlotInfo {
  type: 'device' | 'empty'
  device?: Device
  hidden?: boolean
  uSize?: number  // 设备占用的U数，仅首U位有值
}

function getSlotData(rack: Rack): SlotInfo[] {
  const slots: SlotInfo[] = []
  let currentU = 0

  for (const dev of rack.devices) {
    if (dev === null) {
      const slot: SlotInfo = { type: 'empty' }
      ;(slot as any)._uOffset = currentU
      slots.push(slot)
      currentU++
    } else {
      const matches = matchesFilter(dev)
      const slot: SlotInfo = {
        type: 'device',
        device: dev,
        hidden: !matches,
        uSize: dev.u
      }
      ;(slot as any)._uOffset = currentU
      slots.push(slot)
      currentU += dev.u
    }
  }

  // 补齐剩余空位
  while (slots.length < rack.totalU) {
    const slot: SlotInfo = { type: 'empty' }
    ;(slot as any)._uOffset = currentU
    slots.push(slot)
    currentU++
  }

  return slots
}

function matchesFilter(dev: Device): boolean {
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    if (!dev.name.toLowerCase().includes(q) && !dev.model.toLowerCase().includes(q)) {
      return false
    }
  }
  if (filterType.value && dev.type !== filterType.value) return false
  return true
}

function getSlotClass(slot: SlotInfo): string {
  if (!slot || slot.type === 'empty') return 'empty'
  if (slot.type === 'device' && slot.device) return `device device-${slot.device.type}`
  return ''
}

function getSlotStyle(slot: SlotInfo): Record<string, string> {
  if (slot.type === 'device' && slot.device && slot.uSize) {
    return {
      flex: String(slot.uSize),
      minHeight: (slot.uSize * 18) + 'px'
    }
  }
  return {}
}

function getUsedU(rack: Rack): number {
  let used = 0
  for (const dev of rack.devices) {
    if (dev !== null) used += dev.u
  }
  return used
}

function onSlotClick(rack: Rack, index: number, slot: SlotInfo) {
  if (slot.type === 'empty') {
    pendingRackId.value = rack.id
    // 使用 U 位 offset 而非 slot 数组索引
    pendingSlotIndex.value = (slot as any)._uOffset
    // 重置表单
    deviceForm.name = ''
    deviceForm.type = 'server'
    deviceForm.model = ''
    deviceForm.u = 1
    deviceForm.ports = 4
    deviceForm.status = '正常'
    deviceForm.ip = ''
    showAddDeviceDialog.value = true
  } else if (slot.type === 'device' && slot.device) {
    openDeviceDrawer(rack.id, slot.device)
  }
}

function confirmAddDevice() {
  if (!deviceForm.name || !deviceForm.model) return
  const newDevice: Device = {
    id: Date.now(),
    ...deviceForm
  }
  store.addDeviceToRack(pendingRackId.value, pendingSlotIndex.value, newDevice)
  showAddDeviceDialog.value = false
}

function openDeviceDrawer(rackId: string, device: Device) {
  selectedDevice.value = device
  selectedRackId.value = rackId
  drawerVisible.value = true
}

function openEditDialog() {
  if (!selectedDevice.value) return
  drawerVisible.value = false
  deviceForm.name = selectedDevice.value.name
  deviceForm.type = selectedDevice.value.type
  deviceForm.model = selectedDevice.value.model
  deviceForm.u = selectedDevice.value.u
  deviceForm.ports = selectedDevice.value.ports
  deviceForm.ip = selectedDevice.value.ip || ''
  showAddDeviceDialog.value = true
}

function deleteSelectedDevice() {
  if (!selectedDevice.value) return
  store.deleteDevice(selectedDevice.value.id)
  drawerVisible.value = false
  selectedDevice.value = null
}

function updateDeviceStatus() {
  if (!selectedDevice.value) return
  store.updateDevice(selectedDevice.value.id, { status: selectedDevice.value.status })
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    server: 'Monitor', switch: 'Connection', storage: 'Box',
    router: 'Share', firewall: 'Lock', ups: 'Lightning', pdu: 'Plug'
  }
  return icons[type] || 'Monitor'
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    server: '服务器', switch: '交换机', storage: '存储',
    router: '路由器', firewall: '防火墙', ups: 'UPS', pdu: 'PDU'
  }
  return labels[type] || type
}

function getTypeTagType(type: string): string {
  const types: Record<string, string> = {
    server: 'primary', switch: 'success', storage: 'warning',
    router: 'danger', firewall: 'danger', ups: 'info', pdu: 'info'
  }
  return types[type] || 'info'
}

// 统计概览
function getFloorUsedU(floor: string): number {
  let used = 0
  for (const rack of store.racks.filter(r => r.floor === floor)) {
    for (const dev of rack.devices) {
      if (dev !== null) used += dev.u
    }
  }
  return used
}

function getFloorTotalU(floor: string): number {
  return store.racks.filter(r => r.floor === floor).reduce((sum, r) => sum + r.totalU, 0)
}

function getFloorUsagePercent(floor: string): number {
  const total = getFloorTotalU(floor)
  if (total === 0) return 0
  return Math.round((getFloorUsedU(floor) / total) * 100)
}

const deviceTypeStats = computed(() => {
  const counts: Record<string, number> = {}
  for (const rack of store.racks) {
    for (const dev of rack.devices) {
      if (dev !== null) {
        counts[dev.type] = (counts[dev.type] || 0) + 1
      }
    }
  }
  const labels: Record<string, string> = {
    server: '服务器', switch: '交换机', storage: '存储',
    router: '路由器', firewall: '防火墙', ups: 'UPS', pdu: 'PDU'
  }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, label: labels[type] || type, count }))
    .sort((a, b) => b.count - a.count)
})

// 机柜管理
function openAddRackDialog() {
  newRackForm.name = ''
  newRackForm.totalU = 42
  showAddRackDialog.value = true
}

function confirmAddRack() {
  if (!newRackForm.name) return
  const newRack: Rack = {
    id: 'rack-' + Date.now(),
    name: newRackForm.name,
    floor: store.selectedFloor,
    totalU: newRackForm.totalU,
    devices: []
  }
  store.addRack(newRack)
  showAddRackDialog.value = false
}

function deleteRack(rackId: string) {
  store.deleteRack(rackId)
}

function openEditRackDialog(rack: Rack) {
  editingRack.value = rack
  editRackName.value = rack.name
  showEditRackDialog.value = true
}

function saveRackName() {
  if (editingRack.value && editRackName.value) {
    store.updateRackName(editingRack.value.id, editRackName.value)
    showEditRackDialog.value = false
  }
}

// ---- 鼠标拖拽系统 ----
// 统一坐标：offset = 从顶部起的 0-based 偏移量（索引0 = 最顶部U位）
function onMouseDown(e: MouseEvent) {
  const slotEl = (e.target as HTMLElement).closest('.u-slot.device') as HTMLElement | null
  if (!slotEl) return

  const container = slotEl.closest('.rack-container')
  const titleEl = container?.querySelector('.rack-title')
  const rackName = titleEl?.textContent?.trim() || ''
  const rack = store.floorRacks.find(r => r.name === rackName)
  if (!rack) return

  const slotsEl = slotEl.closest('.u-slots')
  if (!slotsEl) return
  const slotEls = Array.from(slotsEl.children).filter(el => el.classList.contains('u-slot'))
  const index = slotEls.indexOf(slotEl)
  if (index < 0) return

  const slotData = getSlotData(rack)[index]
  if (!slotData || slotData.type !== 'device' || !slotData.device) return

  dragState.active = true
  dragState.rackId = rack.id
  dragState.startOffset = index        // 从顶部起的偏移量
  dragState.devId = slotData.device.id
  dragState.sourceEl = slotEl

  // 给源设备 slot 添加 drag-source 类
  slotEl.classList.add('drag-source')
  dragState.startOffset = index

  // 注册拖拽时阻止文本选择
  document.addEventListener('selectstart', preventDragSelect)

  // 创建 ghost：克隆当前 slot（已包含完整设备高度）
  const ghost = slotEl.cloneNode(true) as HTMLElement
  ghost.classList.add('ghost')
  // ghost 尺寸跟随原 slot（已通过 flex: uSize 设置高度）
  ghost.style.width = slotEl.offsetWidth + 'px'
  ghost.style.height = slotEl.offsetHeight + 'px'
  ghost.style.left = (e.clientX - slotEl.offsetWidth / 2) + 'px'
  ghost.style.top = (e.clientY - slotEl.offsetHeight / 2) + 'px'
  document.body.appendChild(ghost)
  dragState.ghostEl = ghost

  e.preventDefault()
}

// ---- 鼠标拖拽：mousemove ----
function onMouseMove(e: MouseEvent) {
  if (!dragState.active || !dragState.ghostEl) return

  dragState.ghostEl.style.left = (e.clientX - dragState.ghostEl.offsetWidth / 2) + 'px'
  dragState.ghostEl.style.top = (e.clientY - 14) + 'px'

  // 临时隐藏 ghost 以便 elementFromPoint 获取下方元素
  dragState.ghostEl.style.display = 'none'
  const elBelow = document.elementFromPoint(e.clientX, e.clientY)
  dragState.ghostEl.style.display = ''

  clearHighlights()
  if (!elBelow) return

  const targetSlot = elBelow.closest('.u-slot') as HTMLElement | null
  if (!targetSlot) return

  const targetRackEl = targetSlot.closest('.rack-container')
  const targetRackTitle = targetRackEl?.querySelector('.rack-title')?.textContent?.trim() || ''
  const targetRack = store.floorRacks.find(r => r.name === targetRackTitle)
  if (!targetRack) return

  const targetUOffset = parseInt(targetSlot.dataset.uOffset || '-1')
  if (targetUOffset < 0) return

  const device = findDevice(dragState.devId)
  if (!device) return

  if (canPlaceAtOffset(targetRack, targetUOffset, device.u, dragState.devId)) {
    highlightDropZone(targetRack, targetUOffset, device.u, true)
  } else {
    targetSlot.classList.add('drop-no')
  }
  dragState.currentHighlight = targetSlot
  dragState.targetRackId = targetRack.id
  dragState.targetOffset = targetUOffset
}

// ---- 鼠标拖拽：mouseup ----
function onMouseUp(_e: MouseEvent) {
  if (!dragState.active) return

  // 清除源设备 slot 的 drag-source 类
  dragState.sourceEl?.classList.remove('drag-source')
  dragState.ghostEl?.remove()

  clearHighlights()

  // 使用 move 阶段记录的目标位置执行移动
  if (dragState.targetRackId && dragState.targetOffset >= 0) {
    const targetRack = store.racks.find(r => r.id === dragState.targetRackId)
    const device = findDevice(dragState.devId)
    if (targetRack && device && canPlaceAtOffset(targetRack, dragState.targetOffset, device.u, dragState.devId)) {
      doMove(targetRack, dragState.targetOffset, device)
    }
  }

  dragState.active = false
  dragState.rackId = ''
  dragState.startOffset = -1
  dragState.devId = -1
  dragState.ghostEl = null
  dragState.sourceEl = null
  dragState.currentHighlight = null
  dragState.targetRackId = ''
  dragState.targetOffset = -1

  // 移除拖拽时阻止文本选择的监听
  document.removeEventListener('selectstart', preventDragSelect)
}

// ---- 拖拽辅助函数 ----
// 所有坐标统一为 offset（从顶部起的 0-based 偏移量）

function findDevice(devId: number): Device | null {
  for (const rack of store.racks) {
    for (const dev of rack.devices) {
      if (dev && dev.id === devId) return dev
    }
  }
  return null
}

// 获取指定 offset 位置的设备（返回 null=空位, undefined=越界, Device=设备）
function getDeviceAtOffset(rack: Rack, offset: number): Device | null | undefined {
  if (offset < 0 || offset >= rack.totalU) return undefined
  // rack.devices 按从顶部到底部的顺序排列
  // 需要遍历 devices 数组，累加 U 位来找到 offset 位置的设备
  let pos = 0
  for (const dev of rack.devices) {
    if (dev === null) {
      // 空位占 1U
      if (pos === offset) return null
      pos++
    } else {
      // 设备占 dev.u 个 U 位
      for (let k = 0; k < dev.u; k++) {
        if (pos + k === offset) return dev
      }
      pos += dev.u
    }
    if (pos > rack.totalU) break
  }
  // 超出 devices 范围，说明是空位
  return pos <= rack.totalU && offset >= pos ? null : undefined
}

// 检查从 offset 开始放置 uSize 个 U 的设备是否可行
function canPlaceAtOffset(targetRack: Rack, offset: number, uSize: number, excludeDevId: number): boolean {
  if (offset < 0 || offset + uSize > targetRack.totalU) return false
  for (let i = offset; i < offset + uSize; i++) {
    const dev = getDeviceAtOffset(targetRack, i)
    if (dev === undefined) return false  // 越界
    if (dev === null) continue           // 空位
    if (dev.id === excludeDevId) continue // 是自己（源位置）
    return false                          // 被其他设备占用
  }
  return true
}

// 高亮多 U 设备的放置区域
function highlightDropZone(rack: Rack, offset: number, uSize: number, ok: boolean) {
  const rackEls = document.querySelectorAll('.rack-container')
  for (const rackEl of rackEls) {
    const titleEl = rackEl.querySelector('.rack-title')
    if (titleEl?.textContent?.trim() === rack.name) {
      const slotsEl = rackEl.querySelector('.u-slots')
      if (!slotsEl) return
      const slotEls = Array.from(slotsEl.children).filter(el => el.classList.contains('u-slot'))
      // 根据 U 位 offset 查找对应的 slot 元素
      for (let u = offset; u < offset + uSize; u++) {
        const slotEl = slotEls.find(el => parseInt((el as HTMLElement).dataset.uOffset || '-1') === u)
        if (slotEl) {
          slotEl.classList.add(ok ? 'drop-ok' : 'drop-no')
        }
      }
      return
    }
  }
}

// 执行移动：从源机柜移除设备，插入到目标机柜的指定 offset
function doMove(targetRack: Rack, targetOffset: number, device: Device) {
  const sourceRack = store.racks.find(r => r.devices.some(d => d && d.id === device.id))
  if (!sourceRack) return

  const sameRack = sourceRack.id === targetRack.id

  if (sameRack) {
    // 同一机柜内移动：直接操作 occupied 映射
    moveWithinRack(targetRack, device, targetOffset)
  } else {
    // 跨机柜移动
    // 1. 先收集目标位置的设备（要在移除源设备之前做）
    const existingDev = getDeviceAtOffset(targetRack, targetOffset)
    // 2. 从源机柜移除
    store.removeDeviceFromRack(sourceRack.id, device.id)
    // 3. 如果目标位置有设备，先移除
    if (existingDev && existingDev.id !== device.id) {
      store.removeDeviceFromRack(targetRack.id, existingDev.id)
      // 把原设备放回源机柜原来的位置
      insertDeviceAtOffset(sourceRack, dragState.startOffset, existingDev)
    }
    // 4. 插入到目标位置
    insertDeviceAtOffset(targetRack, targetOffset, device)
  }
}

// 同一机柜内移动设备
function moveWithinRack(rack: Rack, device: Device, targetOffset: number) {
  const totalU = rack.totalU
  const uSize = device.u

  // 构建 occupied 映射
  const occupied: (Device | null)[] = new Array(totalU).fill(null)
  let pos = 0
  for (const dev of rack.devices) {
    if (dev === null) {
      if (pos < totalU) occupied[pos] = null
      pos++
    } else {
      for (let k = 0; k < dev.u && pos + k < totalU; k++) {
        occupied[pos + k] = dev
      }
      pos += dev.u
    }
    if (pos >= totalU) break
  }

  // 找到设备当前占用的起始位置
  let devStart = -1
  for (let i = 0; i < totalU; i++) {
    if (occupied[i] && occupied[i]!.id === device.id) {
      devStart = i
      break
    }
  }
  if (devStart === -1) return

  // 收集目标区域中已有的其他设备（需要交换）
  const displacedDevices: { device: Device; originalOffset: number }[] = []
  for (let i = targetOffset; i < targetOffset + uSize && i < totalU; i++) {
    const dev = occupied[i]
    if (dev && dev.id !== device.id) {
      // 检查是否已经在列表中（多 U 设备）
      if (!displacedDevices.some(d => d.device.id === dev.id)) {
        displacedDevices.push({ device: dev, originalOffset: i })
      }
    }
  }

  // 从 occupied 中移除被拖拽设备
  for (let k = 0; k < uSize; k++) {
    if (devStart + k < totalU) occupied[devStart + k] = null
  }

  // 从 occupied 中移除被挤占的设备
  for (const displaced of displacedDevices) {
    for (let k = 0; k < displaced.device.u; k++) {
      if (displaced.originalOffset + k < totalU) {
        occupied[displaced.originalOffset + k] = null
      }
    }
  }

  // 在目标位置放置被拖拽设备
  for (let k = 0; k < uSize && targetOffset + k < totalU; k++) {
    occupied[targetOffset + k] = device
  }

  // 把被挤占的设备放到源位置（如果源位置现在为空）
  let sourcePtr = devStart
  for (const displaced of displacedDevices) {
    const dSize = displaced.device.u
    // 检查源区域是否足够放下
    let canFit = true
    for (let k = 0; k < dSize; k++) {
      if (sourcePtr + k >= totalU || (occupied[sourcePtr + k] !== null && occupied[sourcePtr + k]!.id !== displaced.device.id)) {
        canFit = false
        break
      }
    }
    if (canFit) {
      for (let k = 0; k < dSize; k++) {
        occupied[sourcePtr + k] = displaced.device
      }
      sourcePtr += dSize
    } else {
      // 放不下，找第一个可用的空位
      let placed = false
      for (let i = 0; i < totalU; i++) {
        let slotOk = true
        for (let k = 0; k < dSize; k++) {
          if (i + k >= totalU || (occupied[i + k] !== null && occupied[i + k]!.id !== displaced.device.id)) {
            slotOk = false
            break
          }
        }
        if (slotOk) {
          for (let k = 0; k < dSize; k++) {
            occupied[i + k] = displaced.device
          }
          placed = true
          break
        }
      }
    }
  }

  // 从 occupied 重建紧凑的 devices 数组
  rack.devices = buildCompact(occupied, totalU)
}

// 在机柜的指定 offset 位置插入设备（用于跨机柜）
function insertDeviceAtOffset(rack: Rack, offset: number, device: Device) {
  // 把 rack.devices 展开为每个 U 位的占用映射，然后重建
  const totalU = rack.totalU
  const occupied: (Device | null)[] = new Array(totalU).fill(null)

  // 按现有顺序填充
  let pos = 0
  for (const dev of rack.devices) {
    if (dev === null) {
      if (pos < totalU) occupied[pos] = null
      pos++
    } else {
      for (let k = 0; k < dev.u && pos + k < totalU; k++) {
        occupied[pos + k] = dev
      }
      pos += dev.u
    }
    if (pos >= totalU) break
  }

  // 在 offset 位置放置新设备
  for (let k = 0; k < device.u && offset + k < totalU; k++) {
    occupied[offset + k] = device
  }

  // 从 occupied 重建紧凑的 devices 数组
  rack.devices = buildCompact(occupied, totalU)
}

function buildCompact(occupied: (Device | null)[], totalU: number): (Device | null)[] {
  const result: (Device | null)[] = []
  const seen = new Set<number>()
  for (let i = 0; i < totalU; i++) {
    const dev = occupied[i]
    if (dev === null) {
      result.push(null)
    } else if (!seen.has(dev.id)) {
      seen.add(dev.id)
      result.push(dev)
    }
  }
  return result
}

function clearHighlights() {
  document.querySelectorAll('.drop-ok, .drop-no').forEach(el => {
    el.classList.remove('drop-ok', 'drop-no')
  })
}

function getUBadge(slot: SlotInfo, index: number): string {
  if (!slot.device) return ''
  // 找到包含当前 slot 的 rack，需要从 DOM 反向查找
  // 模板中每个 rack 渲染时调用此函数，我们需要找到对应的 rack totalU
  // 使用一个简单方法：遍历所有 floorRacks，通过设备 ID 匹配
  const device = slot.device
  for (const rack of store.floorRacks) {
    if (rack.devices.some(d => d && d.id === device.id)) {
      const totalU = rack.totalU
      const startU = totalU - index
      const endU = startU - device.u + 1
      return device.u > 1 ? `U${endU}-${startU}` : `U${startU}`
    }
  }
  // 兜底
  return device.u > 1 ? `${device.u}U` : ''
}
</script>

<style scoped>
.devices-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  background: #0a0e17;
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
  padding: 16px 0;
  border-bottom: 1px solid #1e2433;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #8b9bb4;
  cursor: pointer;
  transition: color 0.2s;
}
.back-btn:hover { color: #79c0ff; }

.top-bar h3 {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: #e6edf3;
  margin: 0;
}

/* 楼层标签 */
.floor-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.floor-tab {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  background: #141924;
  border: 1px solid #2a3040;
  color: #8b9bb4;
  transition: all 0.2s;
}

.floor-tab.active {
  background: rgba(88,166,255,0.15);
  border-color: rgba(88,166,255,0.3);
  color: #79c0ff;
}

.floor-tab:hover { border-color: #3a4458; }

/* 搜索筛选栏 */
.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  padding: 10px 12px;
  background: #141924;
  border: 1px solid #2a3040;
  border-radius: 8px;
  align-items: center;
}

.search-input { flex: 1; min-width: 150px; }
.filter-select { width: 100px; }

.filter-result {
  font-size: 11px;
  color: #606878;
  white-space: nowrap;
}

/* 设备高亮/暗淡 */
.device-inner.dimmed { opacity: 0.3; }
.device-inner.disabled { opacity: 0.5; filter: grayscale(0.5); }
.device-leds.led-off .led { animation: none; opacity: 0.15; background: #2a3040; box-shadow: none; }

/* 统计概览 */
.stats-overview {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #1e2433;
}

.stats-title {
  font-size: 14px;
  font-weight: 600;
  color: #8b9bb4;
  margin-bottom: 16px;
  text-align: center;
  letter-spacing: 1px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.stats-card {
  background: #141924;
  border: 1px solid #2a3040;
  border-radius: 10px;
  padding: 16px;
}

.stats-card-title {
  font-size: 12px;
  color: #606878;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 楼层使用率 */
.floor-stat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.floor-stat-row:last-child { margin-bottom: 0; }

.floor-stat-label {
  font-size: 11px;
  color: #8b9bb4;
  width: 30px;
  flex-shrink: 0;
}

.floor-stat-bar {
  flex: 1;
  height: 6px;
  background: #0c0f16;
  border-radius: 3px;
  overflow: hidden;
}

.floor-stat-fill {
  height: 100%;
  background: linear-gradient(90deg, #4af0c0, #2a7a5a);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.floor-stat-value {
  font-size: 10px;
  color: #606878;
  font-family: 'Consolas', monospace;
  width: 60px;
  text-align: right;
  flex-shrink: 0;
}

/* 设备类型分布 */
.type-stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.type-stat-row:last-child { margin-bottom: 0; }

.type-stat-color {
  width: 12px;
  height: 8px;
  border-radius: 2px;
}

.type-stat-label {
  font-size: 12px;
  color: #c0c8d4;
  flex: 1;
}

.type-stat-count {
  font-size: 12px;
  color: #8b9bb4;
  font-family: 'Consolas', monospace;
  font-weight: 600;
}

/* 机柜容器 */
.rack-wrapper {
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
  justify-content: center;
}

.rack-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rack-title {
  font-size: 15px;
  font-weight: 600;
  color: #8b9bb4;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.rack-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.rack-actions {
  display: flex;
  gap: 4px;
}

.rack-action-btn {
  background: none;
  border: 1px solid transparent;
  color: #4a5568;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rack-action-btn:hover {
  background: #1e2433;
  color: #c0c8d4;
  border-color: #2a3040;
}
.rack-action-btn.danger:hover {
  background: rgba(220,50,50,0.15);
  color: #ff6b6b;
  border-color: rgba(220,50,50,0.3);
}

/* 机柜主体 */
.rack {
  width: 340px;
  background: linear-gradient(180deg, #141924 0%, #0f131a 100%);
  border: 1px solid #2a3040;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03);
  position: relative;
}

.rack::before, .rack::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #2a3040 0%, #1a1f2e 50%, #2a3040 100%);
}
.rack::before { left: -1px; border-radius: 8px 0 0 8px; }
.rack::after { right: -1px; border-radius: 0 8px 8px 0; }

.rack-top {
  height: 28px;
  background: linear-gradient(180deg, #1a1f2e 0%, #141924 100%);
  border-bottom: 1px solid #2a3040;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.vent {
  width: 60px;
  height: 3px;
  background: #0d1017;
  border-radius: 2px;
}

.rack-bottom {
  height: 24px;
  background: linear-gradient(0deg, #0d1017 0%, #141924 100%);
  border-top: 1px solid #2a3040;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feet {
  width: 36px;
  height: 4px;
  background: #0a0d12;
  border-radius: 2px;
  box-shadow: 0 1px 0 rgba(255,255,255,0.04);
}

/* U位列 */
.rack-units { display: flex; }

.u-labels {
  width: 32px;
  display: flex;
  flex-direction: column;
  background: #0d1017;
  border-right: 1px solid #1e2433;
}

.u-label {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: #3a4458;
  font-weight: 600;
  border-bottom: 1px solid #141924;
  min-height: 18px;
}
.u-label:last-child { border-bottom: none; }

.u-slots {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 3px;
  gap: 1px;
}

/* U位 */
.u-slot {
  flex: 1;
  min-height: 18px;
  background: #0c0f16;
  border: 1px solid #181d28;
  border-radius: 2px;
  position: relative;
  transition: all 0.3s ease;
  cursor: pointer;
}

.u-slot.empty {
  background: repeating-linear-gradient(90deg, #0c0f16 0px, #0c0f16 8px, #0a0d12 8px, #0a0d12 9px);
}
.u-slot.empty:hover {
  background: repeating-linear-gradient(90deg, #10141c 0px, #10141c 8px, #0e1218 8px, #0e1218 9px);
  border-color: #3a4458;
}
.empty-slot-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #4a5568;
  opacity: 0;
  transition: opacity 0.2s;
}
.u-slot.empty:hover .empty-slot-icon { opacity: 1; }

/* 拖拽：源设备半透明 */
.drag-source { opacity: 0.35 !important; }

/* 拖拽：幽灵元素 */
.ghost {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.92;
  filter: brightness(1.15) drop-shadow(0 4px 16px rgba(74,240,192,0.4));
  border: 1px solid rgba(74,240,192,0.5);
  border-radius: 3px;
}

/* 拖拽：目标可放置 */
.u-slot.drop-ok {
  background: rgba(74,240,192,0.2) !important;
  border: 2px dashed #4af0c0 !important;
  box-shadow: 0 0 16px rgba(74,240,192,0.4), inset 0 0 8px rgba(74,240,192,0.1);
}

/* 拖拽：目标不可放置 */
.u-slot.drop-no {
  background: rgba(255,80,80,0.15) !important;
  border: 2px dashed rgba(255,80,80,0.5) !important;
  box-shadow: 0 0 12px rgba(255,80,80,0.2);
}

/* 设备 */
.u-slot.device {
  display: flex;
  align-items: center;
  border-radius: 3px;
  overflow: hidden;
  border: none;
  margin: -1px 0;
}
.u-slot.device:hover { filter: brightness(1.2); z-index: 1; box-shadow: 0 0 12px rgba(74,240,192,0.3); }

.u-slot.device::before, .u-slot.device::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background: #2a3040;
  border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
}
.u-slot.device::before { left: 4px; }
.u-slot.device::after { right: 4px; }

/* 设备U位标签 */
.device-u-badge {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8px;
  color: #8b9bb4;
  font-family: 'Consolas', monospace;
  background: rgba(0,0,0,0.4);
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}

/* 设备类型配色 */
.device-server {
  background: linear-gradient(90deg, #1a3a5c 0%, #1e4470 50%, #1a3a5c 100%);
  border: 1px solid #2a5a8a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(42,90,138,0.2);
}
.device-switch {
  background: linear-gradient(90deg, #1a4a3a 0%, #1e5a44 50%, #1a4a3a 100%);
  border: 1px solid #2a7a5a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(42,122,90,0.2);
}
.device-storage {
  background: linear-gradient(90deg, #3a2a5c 0%, #443070 50%, #3a2a5c 100%);
  border: 1px solid #5a3a8a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(90,58,138,0.2);
}
.device-router {
  background: linear-gradient(90deg, #5c3a1a 0%, #70441e 50%, #5c3a1a 100%);
  border: 1px solid #8a5a2a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(138,90,42,0.2);
}
.device-firewall {
  background: linear-gradient(90deg, #5c1a1a 0%, #701e1e 50%, #5c1a1a 100%);
  border: 1px solid #8a2a2a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(138,42,42,0.2);
}
.device-ups {
  background: linear-gradient(90deg, #3a3a1a 0%, #4a441e 50%, #3a3a1a 100%);
  border: 1px solid #6a6a2a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(106,106,42,0.2);
}
.device-pdu {
  background: linear-gradient(90deg, #2a2a3a 0%, #303044 50%, #2a2a3a 100%);
  border: 1px solid #40405a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(64,64,90,0.2);
}

/* 设备内部结构 */
.device-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 8px;
}

/* LED 指示灯 */
.device-leds {
  --led-color: #4af0c0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  flex-shrink: 0;
}

.led {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #4af0c0;
  box-shadow: 0 0 4px #4af0c0, 0 0 8px #4af0c0;
}

.led-solid {
  opacity: 1;
}

.led-blink {
  animation: led-blink 2s ease-in-out infinite;
}

.device-leds.led-off .led {
  animation: none;
  opacity: 0.15;
  background: #2a3040;
  box-shadow: none;
}

@keyframes led-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.device-name {
  font-size: 11px;
  font-weight: 600;
  color: #d0d8e8;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}

.device-model {
  font-size: 9px;
  color: #606878;
  flex-shrink: 0;
  font-family: 'Consolas', monospace;
}

.device-ports {
  display: flex;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
}

.port {
  width: 6px;
  height: 6px;
  background: #0a0d10;
  border: 1px solid #1e2430;
  border-radius: 1px;
}
.port.active {
  background: #1a2a1a;
  border-color: #2a4a2a;
  box-shadow: inset 0 0 2px #4af0c0;
}

.device-badge {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8px;
  color: #3a4458;
  font-family: 'Consolas', monospace;
  background: rgba(0,0,0,0.3);
  padding: 1px 4px;
  border-radius: 2px;
}

/* 统计信息 */
.rack-stats {
  margin-top: 16px;
  display: flex;
  gap: 30px;
  justify-content: center;
}

.stat { text-align: center; }

.stat-value {
  font-size: 24px;
  font-weight: 700;
  font-family: 'Consolas', monospace;
}
.stat-value.used { color: #4af0c0; }
.stat-value.free { color: #606878; }
.stat-value.total { color: #8b9bb4; }

.stat-label {
  font-size: 10px;
  color: #4a5568;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 2px;
}

/* 图例 */
.legend {
  margin-top: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #606878;
}

.legend-color {
  width: 14px;
  height: 10px;
  border-radius: 2px;
}

.lc-server { background: #1a3a5c; border: 1px solid #2a5a8a; }
.lc-switch { background: #1a4a3a; border: 1px solid #2a7a5a; }
.lc-storage { background: #3a2a5c; border: 1px solid #5a3a8a; }
.lc-router { background: #5c3a1a; border: 1px solid #8a5a2a; }
.lc-firewall { background: #5c1a1a; border: 1px solid #8a2a2a; }
.lc-ups { background: #3a3a1a; border: 1px solid #6a6a2a; }
.lc-pdu { background: #2a2a3a; border: 1px solid #40405a; }

/* 抽屉面板 */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 400px;
  height: 100%;
  background: #141924;
  border-left: 1px solid #2a3040;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #2a3040;
}

.drawer-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #e6edf3;
}

.drawer-close {
  background: none;
  border: none;
  color: #606878;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}
.drawer-close:hover {
  background: #1e2433;
  color: #e6edf3;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drawer-icon.device-server { background: rgba(42,90,138,0.2); color: #4af0c0; }
.drawer-icon.device-switch { background: rgba(42,122,90,0.2); color: #4af0c0; }
.drawer-icon.device-storage { background: rgba(90,58,138,0.2); color: #a070ff; }
.drawer-icon.device-router { background: rgba(138,90,42,0.2); color: #ffb04a; }
.drawer-icon.device-firewall { background: rgba(138,42,42,0.2); color: #ff4a4a; }
.drawer-icon.device-ups { background: rgba(106,106,42,0.2); color: #e0d04a; }
.drawer-icon.device-pdu { background: rgba(64,64,90,0.2); color: #7090ff; }

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-label {
  font-size: 12px;
  color: #4a5568;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.drawer-value {
  font-size: 14px;
  color: #c0c8d4;
  line-height: 1.6;
}

.drawer-ip {
  font-family: 'Consolas', monospace;
  color: #4af0c0;
  background: rgba(74,240,192,0.08);
  padding: 4px 10px;
  border-radius: 4px;
  display: inline-block;
}

.drawer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid #2a3040;
}

.drawer-actions-left {
  display: flex;
  gap: 8px;
}

/* 抽屉动画 */
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: opacity 0.3s ease;
}
.drawer-slide-enter-active .drawer-panel,
.drawer-slide-leave-active .drawer-panel {
  transition: transform 0.3s ease;
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  opacity: 0;
}
.drawer-slide-enter-from .drawer-panel,
.drawer-slide-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>
