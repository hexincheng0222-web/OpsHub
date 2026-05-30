<template>
  <div class="devices-page">
    <div class="top-bar">
      <span class="back-btn" @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon> 返回首页
      </span>
      <h3>设备信息</h3>
      <el-button type="primary" @click="addRack">
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
                @click="onSlotClick(rack, index, slot)"
              >
                <template v-if="slot && slot.type !== 'empty' && slot.type !== 'occupied'">
                  <div class="device-inner">
                    <div class="device-leds" :style="{ '--led-color': getLedColor(slot.device!.type) }">
                      <div v-for="l in Math.min(slot.device!.u * 2, 4)" :key="l" class="led"></div>
                    </div>
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
        <el-form-item label="所属部门">
          <el-select v-model="deviceForm.dept" style="width: 100%">
            <el-option label="技术部" value="技术部" />
            <el-option label="运维部" value="运维部" />
            <el-option label="产品部" value="产品部" />
          </el-select>
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

            <div class="drawer-section">
              <div class="drawer-label">占用 U 数</div>
              <div class="drawer-value">{{ selectedDevice.u }}U</div>
            </div>

            <div class="drawer-section">
              <div class="drawer-label">端口数</div>
              <div class="drawer-value">{{ selectedDevice.ports }}</div>
            </div>

            <div class="drawer-section">
              <div class="drawer-label">所属部门</div>
              <div class="drawer-value">{{ selectedDevice.dept }}</div>
            </div>

            <div class="drawer-section">
              <div class="drawer-label">状态</div>
              <div class="drawer-value">{{ selectedDevice.status }}</div>
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
import { ref, reactive } from 'vue'
import { useDevicesStore } from '../stores/devices'
import type { Device, Rack } from '../mock/devices'

const store = useDevicesStore()

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

const deviceForm = reactive({
  name: '',
  type: 'server' as Device['type'],
  model: '',
  u: 1,
  ports: 4,
  dept: '技术部'
})

interface SlotInfo {
  type: 'device' | 'empty' | 'occupied'
  device?: Device
}

function getSlotData(rack: Rack): SlotInfo[] {
  const slots: SlotInfo[] = new Array(rack.totalU).fill(null).map(() => ({ type: 'empty' }))

  // 设备从顶部(U42)开始放置
  let currentU = 0
  for (const dev of rack.devices) {
    if (dev === null) {
      currentU++
    } else {
      if (currentU < rack.totalU) {
        slots[currentU] = { type: 'device', device: dev }
      }
      currentU += dev.u
    }
  }

  return slots // 顶部在前（索引0 = U42）
}

function getSlotClass(slot: SlotInfo): string {
  if (!slot || slot.type === 'empty') return 'empty'
  if (slot.type === 'device' && slot.device) return `device device-${slot.device.type}`
  return ''
}

function getSlotStyle(slot: SlotInfo): Record<string, string> {
  if (slot.type === 'device' && slot.device) {
    return {
      flex: String(slot.device.u),
      minHeight: (slot.device.u * 18) + 'px'
    }
  }
  return {}
}

function getLedColor(type: string): string {
  const colors: Record<string, string> = {
    server: '#4af0c0', switch: '#4af0c0', storage: '#a070ff',
    router: '#ffb04a', firewall: '#ff4a4a', ups: '#e0d04a', pdu: '#7090ff'
  }
  return colors[type] || '#4af0c0'
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
    pendingSlotIndex.value = index
    // 重置表单
    deviceForm.name = ''
    deviceForm.type = 'server'
    deviceForm.model = ''
    deviceForm.u = 1
    deviceForm.ports = 4
    deviceForm.dept = '技术部'
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
  deviceForm.dept = selectedDevice.value.dept
  showAddDeviceDialog.value = true
}

function deleteSelectedDevice() {
  if (!selectedDevice.value) return
  store.deleteDevice(selectedDevice.value.id)
  drawerVisible.value = false
  selectedDevice.value = null
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

// 机柜管理
function addRack() {
  const newRack: Rack = {
    id: 'rack-' + Date.now(),
    name: '新机柜',
    floor: store.selectedFloor,
    totalU: 42,
    devices: []
  }
  store.addRack(newRack)
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
</script>

<style scoped>
.devices-page {
  max-width: 1200px;
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
  width: 420px;
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
  border-color: #2a3040;
}
.u-slot.empty:hover::after {
  content: '+ 添加设备';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #4a5568;
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
.u-slot.device:hover { filter: brightness(1.15); z-index: 1; }

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
  background: var(--led-color);
  box-shadow: 0 0 4px var(--led-color), 0 0 8px var(--led-color);
  animation: led-blink 2s ease-in-out infinite;
}
.led:nth-child(2) { animation-delay: 0.3s; }
.led:nth-child(3) { animation-delay: 0.6s; }
.led:nth-child(4) { animation-delay: 0.9s; }

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
