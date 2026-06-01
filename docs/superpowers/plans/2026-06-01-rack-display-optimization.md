# 机柜显示优化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 拆分 DevicesView.vue 为独立子组件，重写拖拽系统，实现机柜动态高度、设备卡片信息完善、机柜统计。

**架构：** 将 1688 行单文件组件拆分为 8 个子组件 + 1 个 composable + 1 个工具函数。先提取共享逻辑，再自底向上构建组件，最后重写 DevicesView.vue 引用新组件。

**技术栈：** Vue 3 + TypeScript + Pinia + CSS Grid (subgrid) + CSS custom properties

---

## 文件结构

```
src/
├── utils/
│   └── rack-utils.ts              # 新建：共享 occupied 映射 + buildCompact + 辅助函数
├── components/devices/
│   ├── DeviceCard.vue             # 新建：设备卡片（LED、名称、IP、型号、U标签）
│   ├── USlot.vue                  # 新建：单个 U 位（空位 / 设备占位）
│   ├── RackGrid.vue               # 新建：U 位网格容器（动态行数）
│   ├── RackStats.vue              # 新建：机柜统计信息 + 利用率进度条
│   ├── RackHeader.vue             # 新建：机柜头部（名称、楼层、操作按钮）
│   ├── RackCard.vue               # 新建：机柜容器（组合上述组件）
│   ├── DeviceForm.vue             # 新建：新增/编辑设备表单
│   └── useDragDrop.ts             # 新建：拖拽 composable
├── stores/devices.ts              # 修改：增加 moveDevice 方法
├── views/DevicesView.vue          # 重写：只保留楼层筛选 + 机柜列表 + 统计面板
└── styles/variables.css           # 可能修改：增加设备类型颜色变量
```

---

### 任务 1：共享工具函数 rack-utils.ts

**文件：**
- 创建：`src/utils/rack-utils.ts`
- 修改：`src/stores/devices.ts:25-52, 54-68, 70-97`

- [ ] **步骤 1：创建 rack-utils.ts，提取 occupied 映射**

```typescript
// src/utils/rack-utils.ts
import type { Device, Rack } from '../mock/devices'

export interface SlotInfo {
  type: 'device' | 'empty' | 'occupied'
  device?: Device
  uSize?: number
  uOffset: number
  hidden?: boolean
}

/**
 * 将 rack.devices（紧凑数组）展开为长度 = totalU 的 occupied 映射。
 * occupied[i] = null 表示空位，= Device 表示该 U 位被该设备占用。
 */
export function buildOccupied(rack: Rack): (Device | null)[] {
  const occupied: (Device | null)[] = new Array(rack.totalU).fill(null)
  let pos = 0
  for (const dev of rack.devices) {
    if (pos >= rack.totalU) break
    if (dev) {
      for (let i = 0; i < dev.u && pos + i < rack.totalU; i++) {
        occupied[pos + i] = dev
      }
      pos += dev.u
    } else {
      pos++
    }
  }
  return occupied
}

/**
 * 将 occupied 数组转换为紧凑的 devices 数组（去重多 U 设备）。
 */
export function buildCompactDevices(occupied: (Device | null)[], totalU: number): (Device | null)[] {
  const result: (Device | null)[] = []
  const seen = new Set<number>()
  for (let i = 0; i < totalU; i++) {
    const dev = occupied[i]
    if (dev) {
      if (!seen.has(dev.id)) {
        result.push(dev)
        seen.add(dev.id)
      }
      // skip remaining U positions of this device
    } else {
      result.push(null)
    }
  }
  return result
}

/**
 * 根据 occupied 数组生成 SlotInfo 数组（用于 v-for 渲染）。
 * 多 U 设备只生成一个 slot（type=device），其余标记为 hidden（type=occupied）。
 */
export function buildSlotData(rack: Rack): SlotInfo[] {
  const occupied = buildOccupied(rack)
  const slots: SlotInfo[] = []
  const seen = new Set<number>()

  for (let i = 0; i < rack.totalU; i++) {
    const dev = occupied[i]
    if (!dev) {
      slots.push({ type: 'empty', uOffset: i })
    } else if (!seen.has(dev.id)) {
      slots.push({ type: 'device', device: dev, uSize: dev.u, uOffset: i })
      seen.add(dev.id)
    } else {
      slots.push({ type: 'occupied', uOffset: i })
    }
  }
  return slots
}

/**
 * 检查目标区域 [offset, offset + uSize) 是否全部空闲（可放置设备）。
 * excludeDevId: 排除该设备（拖拽时忽略源位置的设备）。
 */
export function canPlaceAt(rack: Rack, offset: number, uSize: number, excludeDevId?: number): boolean {
  if (offset < 0 || offset + uSize > rack.totalU) return false
  const occupied = buildOccupied(rack)
  for (let i = offset; i < offset + uSize; i++) {
    const dev = occupied[i]
    if (dev && dev.id !== excludeDevId) return false
  }
  return true
}

/**
 * 计算设备的 U 位显示标签，如 "U42" 或 "U39-40"。
 */
export function getUBadgeLabel(slot: SlotInfo): string {
  if (slot.uSize && slot.uSize > 1) {
    return `U${slot.uOffset + slot.uSize}-${slot.uOffset + 1}`
  }
  return `U${slot.uOffset + 1}`
}

/**
 * 获取设备类型对应的颜色（左边框）。
 */
export const DEVICE_TYPE_COLORS: Record<string, string> = {
  server: '#60a5fa',
  switch: '#4ade80',
  storage: '#c084fc',
  router: '#fb923c',
  firewall: '#f87171',
  ups: '#f472b6',
  pdu: '#94a3b8',
}

/**
 * 获取设备类型中文标签。
 */
export const DEVICE_TYPE_LABELS: Record<string, string> = {
  server: '服务器',
  switch: '交换机',
  storage: '存储',
  router: '路由器',
  firewall: '防火墙',
  ups: 'UPS',
  pdu: 'PDU',
}
```

- [ ] **步骤 2：重构 store 使用 rack-utils.ts**

修改 `src/stores/devices.ts`，将 `addDeviceToRack`、`removeDeviceFromRack`、`buildCompactDevices` 中重复的 occupied 逻辑替换为调用 `rack-utils.ts`：

```typescript
// src/stores/devices.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mockRacks, FLOORS } from '../mock/devices'
import type { Rack } from '../mock/devices'
import { buildOccupied, buildCompactDevices } from '../utils/rack-utils'

export const useDevicesStore = defineStore('devices', () => {
  const racks = ref<Rack[]>([...mockRacks])
  const floors = FLOORS
  const selectedFloor = ref(FLOORS[0])

  const floorRacks = computed(() =>
    racks.value.filter(r => r.floor === selectedFloor.value)
  )

  function addRack(rack: Rack) {
    racks.value.push(rack)
  }

  function deleteRack(rackId: string) {
    racks.value = racks.value.filter(r => r.id !== rackId)
  }

  function updateRackName(rackId: string, name: string) {
    const rack = racks.value.find(r => r.id === rackId)
    if (rack) rack.name = name
  }

  function addDeviceToRack(rackId: string, uPosition: number, device: Device) {
    const rack = racks.value.find(r => r.id === rackId)
    if (!rack) return
    const occupied = buildOccupied(rack)
    // Check target area is free
    for (let i = uPosition; i < uPosition + device.u && i < rack.totalU; i++) {
      if (occupied[i]) return
    }
    // Place device
    for (let i = uPosition; i < uPosition + device.u && i < rack.totalU; i++) {
      occupied[i] = device
    }
    rack.devices = buildCompactDevices(occupied, rack.totalU)
  }

  function removeDeviceFromRack(rackId: string, deviceId: number) {
    const rack = racks.value.find(r => r.id === rackId)
    if (!rack) return
    const occupied = buildOccupied(rack)
    for (let i = 0; i < rack.totalU; i++) {
      if (occupied[i]?.id === deviceId) {
        occupied[i] = null
      }
    }
    rack.devices = buildCompactDevices(occupied, rack.totalU)
  }

  function moveDevice(
    sourceRackId: string,
    targetRackId: string,
    targetOffset: number,
    deviceId: number
  ) {
    const sourceRack = racks.value.find(r => r.id === sourceRackId)
    const targetRack = racks.value.find(r => r.id === targetRackId)
    if (!sourceRack || !targetRack) return

    // Find the device
    const sourceOccupied = buildOccupied(sourceRack)
    const device = sourceOccupied.find(d => d?.id === deviceId)
    if (!device) return

    // Check target placement
    if (!canPlaceAt(targetRack, targetOffset, device.u, deviceId)) return

    // Remove from source
    removeDeviceFromRack(sourceRackId, deviceId)

    // If same rack, the occupied mapping needs refresh after removal
    if (sourceRackId === targetRackId) {
      const newOccupied = buildOccupied(sourceRack)
      for (let i = targetOffset; i < targetOffset + device.u; i++) {
        newOccupied[i] = device
      }
      targetRack.devices = buildCompactDevices(newOccupied, targetRack.totalU)
    } else {
      // Cross-rack: place in target
      addDeviceToRack(targetRackId, targetOffset, device)
    }
  }

  function updateDevice(deviceId: number, data: Partial<Device>) {
    for (const rack of racks.value) {
      for (const dev of rack.devices) {
        if (dev?.id === deviceId) {
          Object.assign(dev, data)
          return
        }
      }
    }
  }

  function deleteDevice(deviceId: number) {
    for (const rack of racks.value) {
      removeDeviceFromRack(rack.id, deviceId)
    }
  }

  const total = computed(() => {
    let count = 0
    for (const rack of racks.value) {
      for (const dev of rack.devices) {
        if (dev) count++
      }
    }
    return count
  })

  const normalCount = computed(() => {
    let count = 0
    for (const rack of racks.value) {
      for (const dev of rack.devices) {
        if (dev?.status === '正常') count++
      }
    }
    return count
  })

  return {
    racks, floors, selectedFloor, floorRacks,
    addRack, deleteRack, updateRackName,
    addDeviceToRack, removeDeviceFromRack, moveDevice,
    updateDevice, deleteDevice, total, normalCount,
  }
})
```

- [ ] **步骤 3：验证 TypeScript 编译通过**

运行：`npx vue-tsc --noEmit 2>&1 | head -20`
预期：无新增错误（可能有已有错误但不影响）

- [ ] **步骤 4：Commit**

```bash
git add src/utils/rack-utils.ts src/stores/devices.ts
git commit -m "refactor(devices): 提取 rack-utils 共享工具函数，store 增加 moveDevice"
```

---

### 任务 2：DeviceCard.vue

**文件：**
- 创建：`src/components/devices/DeviceCard.vue`

- [ ] **步骤 1：创建 DeviceCard.vue**

```vue
<!-- src/components/devices/DeviceCard.vue -->
<script setup lang="ts">
import type { Device } from '../../mock/devices'
import { DEVICE_TYPE_COLORS } from '../../utils/rack-utils'

const props = defineProps<{
  device: Device
  uLabel: string
}>()

defineEmits<{
  click: []
  dragStart: [e: MouseEvent]
}>()

const borderColor = DEVICE_TYPE_COLORS[props.device.type] || '#94a3b8'
const isActive = props.device.status === '正常'
</script>

<template>
  <div
    class="device-card"
    :class="{ 'is-offline': !isActive }"
    :style="{ borderLeftColor: borderColor }"
    @click="$emit('click')"
    @mousedown.stop="$emit('dragStart', $event)"
  >
    <div class="dc-top">
      <span class="dc-led" :class="{ active: isActive }" :style="{ background: isActive ? '#4ade80' : '#ef4444' }" />
      <span class="dc-name">{{ device.name }}</span>
      <span v-if="!isActive" class="dc-offline-tag">停用</span>
      <span class="dc-u-badge">{{ uLabel }}</span>
    </div>
    <div class="dc-bottom">
      {{ device.model }}<template v-if="device.ip"> · {{ device.ip }}</template>
    </div>
  </div>
</template>

<style scoped>
.device-card {
  width: 100%;
  padding: 4px 8px;
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
  border-left: 3px solid;
  cursor: grab;
  user-select: none;
}
.device-card.is-offline {
  opacity: 0.6;
}
.device-card.is-offline .dc-name {
  text-decoration: line-through;
}
.dc-top {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dc-led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dc-led.active {
  box-shadow: 0 0 4px #4ade80;
}
.dc-name {
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.dc-offline-tag {
  color: #ef4444;
  font-size: 9px;
  margin-left: 2px;
}
.dc-u-badge {
  color: #666;
  font-size: 10px;
  margin-left: auto;
}
.dc-bottom {
  color: #888;
  font-size: 10px;
  margin-top: 2px;
}
</style>
```

- [ ] **步骤 2：验证组件可被正常导入**

在临时文件中验证：
```bash
grep -q "DeviceCard" src/components/devices/DeviceCard.vue && echo "OK"
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/devices/DeviceCard.vue
git commit -m "feat(devices): 添加 DeviceCard 组件"
```

---

### 任务 3：USlot.vue

**文件：**
- 创建：`src/components/devices/USlot.vue`

- [ ] **步骤 1：创建 USlot.vue**

```vue
<!-- src/components/devices/USlot.vue -->
<script setup lang="ts">
import type { SlotInfo } from '../../utils/rack-utils'
import { getUBadgeLabel } from '../../utils/rack-utils'
import DeviceCard from './DeviceCard.vue'

const props = defineProps<{
  slot: SlotInfo
  rackId: string
}>()

const emit = defineEmits<{
  click: [slot: SlotInfo]
  dragStart: [e: MouseEvent, device: Device]
}>()

const uNumber = props.slot.uOffset + 1
</script>

<template>
  <div
    class="u-slot"
    :class="[slot.type, slot.device ? `device-${slot.device?.type}` : '']"
    :data-rack-id="rackId"
    :data-u-offset="slot.uOffset"
    @click="emit('click', slot)"
  >
    <template v-if="slot.type === 'device' && slot.device">
      <DeviceCard
        :device="slot.device"
        :u-label="getUBadgeLabel(slot)"
        @click="emit('click', slot)"
        @drag-start="(e) => emit('dragStart', e, slot.device!)"
      />
    </template>
    <template v-else-if="slot.type === 'empty'">
      <span class="u-number">{{ uNumber }}</span>
      <span class="empty-plus">+</span>
    </template>
    <!-- occupied slots (hidden by grid-row span of parent device) are invisible -->
  </div>
</template>

<style scoped>
.u-slot {
  display: flex;
  align-items: center;
  padding: 0 4px;
  border-bottom: 1px dashed rgba(255,255,255,0.06);
  min-height: 20px;
  position: relative;
}
.u-slot.empty {
  cursor: pointer;
}
.u-slot.empty:hover {
  background: rgba(255,255,255,0.03);
}
.u-slot.empty:hover .empty-plus {
  opacity: 1;
}
.u-number {
  color: #444;
  font-size: 9px;
  width: 20px;
  text-align: center;
}
.empty-plus {
  color: #555;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.15s;
}
.u-slot.device-server,
.u-slot.device-switch,
.u-slot.device-storage,
.u-slot.device-router,
.u-slot.device-firewall,
.u-slot.device-ups,
.u-slot.device-pdu {
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding: 2px 4px;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/devices/USlot.vue
git commit -m "feat(devices): 添加 USlot 组件"
```

---

### 任务 4：RackGrid.vue

**文件：**
- 创建：`src/components/devices/RackGrid.vue`

- [ ] **步骤 1：创建 RackGrid.vue**

```vue
<!-- src/components/devices/RackGrid.vue -->
<script setup lang="ts">
import type { Rack } from '../../mock/devices'
import { buildSlotData } from '../../utils/rack-utils'
import type { SlotInfo } from '../../utils/rack-utils'
import USlot from './USlot.vue'
import { computed } from 'vue'

const props = defineProps<{
  rack: Rack
}>()

const emit = defineEmits<{
  slotClick: [rack: Rack, index: number, slot: SlotInfo]
  dragStart: [e: MouseEvent, device: Device, rackId: string]
}>()

const slots = computed(() => buildSlotData(props.rack))
const rowHeight = 20 // px per U
const gridStyle = computed(() => ({
  gridTemplateRows: `repeat(${props.rack.totalU}, ${rowHeight}px)`,
}))
</script>

<template>
  <div class="rack-grid" :style="gridStyle">
    <!-- U Labels -->
    <div class="ugrid-labels">
      <div
        v-for="i in rack.totalU"
        :key="i"
        class="u-label"
      >{{ rack.totalU - i + 1 }}</div>
    </div>
    <!-- U Slots -->
    <div class="ugrid-slots">
      <USlot
        v-for="(slot, index) in slots"
        :key="`${rack.id}-${index}`"
        :slot="slot"
        :rack-id="rack.id"
        :style="slot.type === 'device' && slot.uSize ? { gridRow: `span ${slot.uSize}` } : {}"
        @click="(s) => emit('slotClick', rack, index, s)"
        @drag-start="(e, dev) => emit('dragStart', e, dev)"
      />
    </div>
  </div>
</template>

<style scoped>
.rack-grid {
  display: grid;
  grid-template-columns: 32px 1fr;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  overflow: hidden;
}
.ugrid-labels {
  grid-column: 1;
  grid-row: 1 / -1;
  display: grid;
  grid-template-rows: subgrid;
}
.u-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: #555;
  border-right: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px dashed rgba(255,255,255,0.06);
}
.ugrid-slots {
  grid-column: 2;
  grid-row: 1 / -1;
  display: grid;
  grid-template-rows: subgrid;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/devices/RackGrid.vue
git commit -m "feat(devices): 添加 RackGrid 组件（动态 U 行数）"
```

---

### 任务 5：RackStats.vue

**文件：**
- 创建：`src/components/devices/RackStats.vue`

- [ ] **步骤 1：创建 RackStats.vue**

```vue
<!-- src/components/devices/RackStats.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Rack } from '../../mock/devices'
import { buildOccupied } from '../../utils/rack-utils'

const props = defineProps<{
  rack: Rack
}>()

const usedU = computed(() => {
  const occupied = buildOccupied(props.rack)
  let count = 0
  for (const d of occupied) {
    if (d) count++
  }
  return count
})

const deviceCount = computed(() => {
  const seen = new Set<number>()
  const occupied = buildOccupied(props.rack)
  for (const d of occupied) {
    if (d) seen.add(d.id)
  }
  return seen.size
})

const usagePct = computed(() => {
  if (props.rack.totalU === 0) return 0
  return Math.round((usedU.value / props.rack.totalU) * 100)
})
</script>

<template>
  <div class="rack-stats">
    <div class="rs-card">
      <div class="rs-value">{{ rack.totalU }}U</div>
      <div class="rs-label">总容量</div>
    </div>
    <div class="rs-card">
      <div class="rs-value">{{ usedU }}U</div>
      <div class="rs-label">已用</div>
    </div>
    <div class="rs-card">
      <div class="rs-value">{{ deviceCount }}</div>
      <div class="rs-label">设备</div>
    </div>
    <div class="rs-bar-wrap">
      <div class="rs-bar">
        <div class="rs-bar-fill" :style="{ width: `${usagePct}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.rack-stats {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
}
.rs-card {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border-radius: 4px;
  padding: 4px 6px;
  text-align: center;
}
.rs-value {
  font-size: 12px;
  font-weight: 600;
  color: #e0e0e0;
}
.rs-label {
  font-size: 9px;
  color: #888;
}
.rs-bar-wrap {
  flex: 2;
}
.rs-bar {
  height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  overflow: hidden;
}
.rs-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ade80, #22d3ee);
  border-radius: 2px;
  transition: width 0.3s;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/devices/RackStats.vue
git commit -m "feat(devices): 添加 RackStats 组件（统计信息+进度条）"
```

---

### 任务 6：RackHeader.vue

**文件：**
- 创建：`src/components/devices/RackHeader.vue`

- [ ] **步骤 1：创建 RackHeader.vue**

```vue
<!-- src/components/devices/RackHeader.vue -->
<script setup lang="ts">
defineProps<{
  name: string
  floor: string
}>()

defineEmits<{
  edit: []
  delete: []
}>()
</script>

<template>
  <div class="rack-header">
    <div class="rh-left">
      <span class="rh-name">{{ name }}</span>
      <span class="rh-floor">{{ floor }}</span>
    </div>
    <div class="rh-actions">
      <button class="rh-btn" @click.stop="$emit('edit')" title="编辑">✎</button>
      <button class="rh-btn rh-btn-danger" @click.stop="$emit('delete')" title="删除">✕</button>
    </div>
  </div>
</template>

<style scoped>
.rack-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.rh-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rh-name {
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
}
.rh-floor {
  font-size: 10px;
  color: #888;
  background: rgba(255,255,255,0.06);
  padding: 1px 6px;
  border-radius: 4px;
}
.rh-actions {
  display: flex;
  gap: 4px;
}
.rh-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
}
.rh-btn:hover {
  color: #ccc;
  background: rgba(255,255,255,0.06);
}
.rh-btn-danger:hover {
  color: #f87171;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/devices/RackHeader.vue
git commit -m "feat(devices): 添加 RackHeader 组件"
```

---

### 任务 7：RackCard.vue（组合组件）

**文件：**
- 创建：`src/components/devices/RackCard.vue`

- [ ] **步骤 1：创建 RackCard.vue**

```vue
<!-- src/components/devices/RackCard.vue -->
<script setup lang="ts">
import type { Rack, Device } from '../../mock/devices'
import type { SlotInfo } from '../../utils/rack-utils'
import RackHeader from './RackHeader.vue'
import RackStats from './RackStats.vue'
import RackGrid from './RackGrid.vue'

defineProps<{
  rack: Rack
}>()

defineEmits<{
  editRack: [rack: Rack]
  deleteRack: [rackId: string]
  slotClick: [rack: Rack, index: number, slot: SlotInfo]
  dragStart: [e: MouseEvent, device: Device, rackId: string]
}>()
</script>

<template>
  <div class="rack-card">
    <RackHeader
      :name="rack.name"
      :floor="rack.floor"
      @edit="$emit('editRack', rack)"
      @delete="$emit('deleteRack', rack.id)"
    />
    <RackStats :rack="rack" />
    <div class="rack-body">
      <RackGrid
        :rack="rack"
        @slot-click="(r, i, s) => $emit('slotClick', r, i, s)"
        @drag-start="(e, dev) => $emit('dragStart', e, dev, rack.id)"
      />
    </div>
    <!-- Rack base decoration -->
    <div class="rack-base">
      <div class="rack-foot" />
      <div class="rack-foot" />
    </div>
  </div>
</template>

<style scoped>
.rack-card {
  background: var(--dv-card-bg, rgba(255,255,255,0.03));
  border: 1px solid var(--dv-border, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 12px;
  width: 340px;
}
.rack-body {
  margin-top: 8px;
}
.rack-base {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px 0;
}
.rack-foot {
  width: 40px;
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 0 0 3px 3px;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/devices/RackCard.vue
git commit -m "feat(devices): 添加 RackCard 组件（组合 header/stats/grid）"
```

---

### 任务 8：useDragDrop.ts

**文件：**
- 创建：`src/components/devices/useDragDrop.ts`

- [ ] **步骤 1：创建 useDragDrop.ts**

```typescript
// src/components/devices/useDragDrop.ts
import { reactive, onMounted, onBeforeUnmount } from 'vue'
import type { Rack, Device } from '../../mock/devices'
import { canPlaceAt } from '../../utils/rack-utils'

interface DragState {
  active: boolean
  sourceRackId: string
  sourceOffset: number
  deviceId: number
  device: Device | null
  targetRackId: string
  targetOffset: number
  ghostEl: HTMLElement | null
  sourceEl: HTMLElement | null
}

const dragState = reactive<DragState>({
  active: false,
  sourceRackId: '',
  sourceOffset: -1,
  deviceId: -1,
  device: null,
  targetRackId: '',
  targetOffset: -1,
  ghostEl: null,
  sourceEl: null,
})

export function useDragDrop(
  racks: () => Rack[],
  onMove: (sourceRackId: string, targetRackId: string, targetOffset: number, deviceId: number) => void
) {
  function onMouseDown(e: MouseEvent, device: Device, rackId: string, slotOffset: number) {
    // Find the .u-slot element from the event
    const slotEl = (e.target as HTMLElement).closest('.u-slot') as HTMLElement
    if (!slotEl) return

    dragState.active = true
    dragState.sourceRackId = rackId
    dragState.sourceOffset = slotOffset
    dragState.deviceId = device.id
    dragState.device = device
    dragState.sourceEl = slotEl

    // Create ghost element
    const ghost = document.createElement('div')
    ghost.className = 'drag-ghost'
    ghost.textContent = device.name
    ghost.style.cssText = `
      position: fixed; z-index: 9999; pointer-events: none;
      padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #fff;
      background: rgba(74, 222, 128, 0.9); border: 2px solid #4ade80;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      left: ${e.clientX - 40}px; top: ${e.clientY - 12}px;
    `
    document.body.appendChild(ghost)
    dragState.ghostEl = ghost

    // Mark source as dimmed
    slotEl.classList.add('drag-source')

    // Prevent text selection
    document.addEventListener('selectstart', preventSelect)
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragState.active || !dragState.ghostEl) return

    // Move ghost
    dragState.ghostEl.style.left = `${e.clientX - 40}px`
    dragState.ghostEl.style.top = `${e.clientY - 12}px`

    // Hide ghost temporarily to get element under cursor
    dragState.ghostEl.style.display = 'none'
    const elUnder = document.elementFromPoint(e.clientX, e.clientY)
    dragState.ghostEl.style.display = ''

    clearHighlights()

    if (!elUnder) return

    const targetSlot = elUnder.closest('.u-slot') as HTMLElement
    if (!targetSlot) return

    const targetRackId = targetSlot.dataset.rackId || ''
    const targetOffset = parseInt(targetSlot.dataset.uOffset ?? '-1', 10)
    if (targetOffset < 0 || !targetRackId) return

    dragState.targetRackId = targetRackId
    dragState.targetOffset = targetOffset

    // Find the target rack
    const allRacks = racks()
    const targetRack = allRacks.find(r => r.id === targetRackId)
    if (!targetRack) return

    const ok = canPlaceAt(targetRack, targetOffset, dragState.device!.u, dragState.deviceId)
    highlightDropZone(targetRackId, targetOffset, dragState.device!.u, ok)
  }

  function onMouseUp() {
    if (!dragState.active) return

    // Remove ghost
    if (dragState.ghostEl) {
      dragState.ghostEl.remove()
      dragState.ghostEl = null
    }

    // Remove source dimming
    if (dragState.sourceEl) {
      dragState.sourceEl.classList.remove('drag-source')
    }

    clearHighlights()

    // Execute move if valid target
    if (dragState.targetRackId && dragState.targetOffset >= 0) {
      const allRacks = racks()
      const targetRack = allRacks.find(r => r.id === dragState.targetRackId)
      if (targetRack && canPlaceAt(targetRack, dragState.targetOffset, dragState.device!.u, dragState.deviceId)) {
        onMove(dragState.sourceRackId, dragState.targetRackId, dragState.targetOffset, dragState.deviceId)
      }
    }

    // Reset state
    dragState.active = false
    dragState.sourceRackId = ''
    dragState.sourceOffset = -1
    dragState.deviceId = -1
    dragState.device = null
    dragState.targetRackId = ''
    dragState.targetOffset = -1
    dragState.ghostEl = null
    dragState.sourceEl = null

    document.removeEventListener('selectstart', preventSelect)
  }

  function highlightDropZone(rackId: string, offset: number, uSize: number, ok: boolean) {
    const slots = document.querySelectorAll(`.u-slot[data-rack-id="${rackId}"]`)
    for (let i = offset; i < offset + uSize; i++) {
      const slot = slots[i] as HTMLElement | undefined
      if (slot) {
        slot.classList.add(ok ? 'drop-ok' : 'drop-no')
      }
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.u-slot.drop-ok, .u-slot.drop-no').forEach(el => {
      el.classList.remove('drop-ok', 'drop-no')
    })
  }

  function preventSelect(e: Event) {
    e.preventDefault()
  }

  onMounted(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('selectstart', preventSelect)
  })

  return { onMouseDown }
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/devices/useDragDrop.ts
git commit -m "feat(devices): 添加 useDragDrop composable（重写拖拽系统）"
```

---

### 任务 9：DeviceForm.vue

**文件：**
- 创建：`src/components/devices/DeviceForm.vue`

- [ ] **步骤 1：创建 DeviceForm.vue**

```vue
<!-- src/components/devices/DeviceForm.vue -->
<script setup lang="ts">
import { reactive, computed } from 'vue'
import type { Device } from '../../mock/devices'
import { DEVICE_TYPE_LABELS } from '../../utils/rack-utils'

const props = defineProps<{
  visible: boolean
  rackId: string
  rackTotalU: number
  editDevice?: Device | null
}>()

const emit = defineEmits<{
  close: []
  submit: [data: Omit<Device, 'id'>]
}>()

const form = reactive({
  name: '',
  type: 'server' as Device['type'],
  model: '',
  u: 1,
  ports: 24,
  status: '正常' as Device['status'],
  ip: '',
})

// Reset form when dialog opens
const visible = computed({
  get: () => props.visible,
  set: (v) => { if (!v) emit('close') },
})

const needsIp = computed(() =>
  ['server', 'switch', 'router', 'firewall', 'storage'].includes(form.type)
)

function handleSubmit() {
  if (!form.name || !form.model) return
  emit('submit', { ...form })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="df-overlay" @click.self="emit('close')">
      <div class="df-dialog">
        <div class="df-header">{{ editDevice ? '编辑设备' : '添加设备' }}</div>
        <div class="df-body">
          <label class="df-field">
            <span class="df-label">设备名称</span>
            <input v-model="form.name" class="df-input" placeholder="如 Web-01">
          </label>
          <label class="df-field">
            <span class="df-label">设备类型</span>
            <select v-model="form.type" class="df-input">
              <option v-for="(label, key) in DEVICE_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </label>
          <label class="df-field">
            <span class="df-label">设备型号</span>
            <input v-model="form.model" class="df-input" placeholder="如 Dell R740">
          </label>
          <div class="df-row">
            <label class="df-field" style="flex:1">
              <span class="df-label">U 高度</span>
              <input v-model.number="form.u" type="number" min="1" :max="rackTotalU" class="df-input">
            </label>
            <label class="df-field" style="flex:1">
              <span class="df-label">端口数</span>
              <input v-model.number="form.ports" type="number" min="0" class="df-input">
            </label>
          </div>
          <label v-if="needsIp" class="df-field">
            <span class="df-label">IP 地址</span>
            <input v-model="form.ip" class="df-input" placeholder="192.168.1.10">
          </label>
        </div>
        <div class="df-footer">
          <button class="df-btn df-btn-cancel" @click="emit('close')">取消</button>
          <button class="df-btn df-btn-confirm" @click="handleSubmit">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.df-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.5); display: flex;
  align-items: center; justify-content: center;
}
.df-dialog {
  background: #1e1e2e; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 20px; width: 360px;
}
.df-header {
  font-size: 16px; font-weight: 600; color: #e0e0e0; margin-bottom: 16px;
}
.df-body { display: flex; flex-direction: column; gap: 12px; }
.df-field { display: flex; flex-direction: column; gap: 4px; }
.df-label { font-size: 12px; color: #888; }
.df-input {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px; padding: 6px 8px; color: #e0e0e0; font-size: 13px; outline: none;
}
.df-input:focus { border-color: #4ade80; }
.df-row { display: flex; gap: 12px; }
.df-footer {
  display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;
}
.df-btn {
  padding: 6px 16px; border-radius: 4px; border: none;
  font-size: 13px; cursor: pointer;
}
.df-btn-cancel { background: rgba(255,255,255,0.06); color: #888; }
.df-btn-confirm { background: #4ade80; color: #000; font-weight: 600; }
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/devices/DeviceForm.vue
git commit -m "feat(devices): 添加 DeviceForm 组件（新增/编辑设备）"
```

---

### 任务 10：重写 DevicesView.vue

**文件：**
- 修改：`src/views/DevicesView.vue`（完全重写）

- [ ] **步骤 1：重写 DevicesView.vue，使用新组件**

```vue
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
    id: `rack-${Date.now()}`,
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

function onSlotClick(rack: Rack, index: number, slot: SlotInfo) {
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
  // Find first empty slot
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
        <button
          v-for="floor in store.floors"
          :key="floor"
          class="floor-tab"
          :class="{ active: activeFloor === floor }"
          @click="activeFloor = floor"
        >{{ floor }}</button>
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
        @delete-rack="(id) => store.deleteRack(id)"
        @slot-click="onSlotClick"
        @drag-start="(e, dev, rackId) => onMouseDown(e, dev, rackId, (e.target as HTMLElement).closest('.u-slot')?.dataset?.uOffset ? parseInt((e.target as HTMLElement).closest('.u-slot')!.dataset.uOffset!) : 0)"
      />
    </div>

    <!-- Stats Section -->
    <div class="stats-section">
      <div class="stats-grid">
        <!-- Floor Usage -->
        <div class="stat-card">
          <div class="stat-card-header">楼层使用率</div>
          <div v-for="floor in store.floors" :key="floor" class="fb-row">
            <span class="fb-label">{{ floor }}</span>
            <div class="fb-bar-track"><div class="fb-bar-fill" :style="{ width: `${floorUsagePercent[floor] || 0}%` }" /></div>
            <span class="fb-pct">{{ floorUsagePercent[floor] || 0 }}%</span>
          </div>
        </div>
        <!-- Device Type Distribution -->
        <div class="stat-card">
          <div class="stat-card-header">设备类型分布</div>
          <div v-for="item in deviceTypeStats" :key="item.type" class="tb-row">
            <span class="tb-dot" :class="`dot-${item.type}`" />
            <span class="tb-label">{{ item.label }}</span>
            <div class="tb-bar-track"><div class="tb-bar-fill" :class="`bg-${item.type}`" :style="{ width: `${(item.count / store.total) * 100}%` }" /></div>
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
              <label class="df-field" style="flex:1"><span class="df-label">U 位数</span><input v-model.number="newRackForm.totalU" type="number" min="1" max="48" class="df-input"></label>
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
            <span class="df-tag" :class="`tag-${drawerDevice?.type}`">{{ DEVICE_TYPE_LABELS[drawerDevice?.type || ''] }}</span>
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
.devices-page { max-width: 1600px; margin: 0 auto; padding: 20px; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.back-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 14px; }
.header-divider { width: 1px; height: 20px; background: rgba(255,255,255,0.1); }
.page-title { font-size: 18px; color: #e0e0e0; margin: 0; }
.add-rack-btn { background: #4ade80; color: #000; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }

/* --- KPI --- */
.kpi-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.kpi-card { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px; text-align: center; }
.kpi-data { display: flex; align-items: baseline; justify-content: center; gap: 2px; }
.kpi-number { font-size: 24px; font-weight: 700; color: #e0e0e0; }
.kpi-unit { font-size: 12px; color: #888; }
.kpi-label { font-size: 11px; color: #888; margin-top: 4px; }
.kpi-online .kpi-number { color: #4ade80; }
.kpi-offline .kpi-number { color: #f87171; }
.kpi-usage .kpi-number { color: #60a5fa; }

/* --- Toolbar --- */
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.floor-tabs { display: flex; gap: 4px; }
.floor-tab { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #888; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.floor-tab.active { background: rgba(74, 222, 128, 0.15); color: #4ade80; border-color: #4ade80; }
.search-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
.filter-select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
.filter-count { font-size: 11px; color: #888; }

/* --- Rack Area --- */
.rack-area { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }

/* --- Stats --- */
.stats-section { margin-top: 24px; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 16px; }
.stat-card-header { font-size: 13px; font-weight: 600; color: #e0e0e0; margin-bottom: 12px; }
.fb-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.fb-label { font-size: 11px; color: #888; width: 28px; }
.fb-bar-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.fb-bar-fill { height: 100%; background: linear-gradient(90deg, #4ade80, #22d3ee); border-radius: 3px; transition: width 0.3s; }
.fb-pct { font-size: 11px; color: #888; width: 32px; text-align: right; }
.tb-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.tb-dot { width: 8px; height: 8px; border-radius: 50%; }
.tb-label { font-size: 11px; color: #888; width: 48px; }
.tb-bar-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.tb-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.tb-count { font-size: 11px; color: #888; width: 20px; text-align: right; }
.bg-server { background: #60a5fa; }
.bg-switch { background: #4ade80; }
.bg-storage { background: #c084fc; }
.bg-router { background: #fb923c; }
.bg-firewall { background: #f87171; }
.bg-ups { background: #f472b6; }
.bg-pdu { background: #94a3b8; }
.dot-server { background: #60a5fa; }
.dot-switch { background: #4ade80; }
.dot-storage { background: #c084fc; }
.dot-router { background: #fb923c; }
.dot-firewall { background: #f87171; }
.dot-ups { background: #f472b6; }
.dot-pdu { background: #94a3b8; }

/* --- Dialogs (reused) --- */
.df-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.df-dialog { background: #1e1e2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 20px; width: 360px; }
.df-header { font-size: 16px; font-weight: 600; color: #e0e0e0; margin-bottom: 16px; }
.df-body { display: flex; flex-direction: column; gap: 12px; }
.df-field { display: flex; flex-direction: column; gap: 4px; }
.df-label { font-size: 12px; color: #888; }
.df-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px 8px; color: #e0e0e0; font-size: 13px; outline: none; }
.df-input:focus { border-color: #4ade80; }
.df-row { display: flex; gap: 12px; }
.df-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.df-btn { padding: 6px 16px; border-radius: 4px; border: none; font-size: 13px; cursor: pointer; }
.df-btn-cancel { background: rgba(255,255,255,0.06); color: #888; }
.df-btn-confirm { background: #4ade80; color: #000; font-weight: 600; }
.df-btn-danger { background: #ef4444; color: #fff; }
.df-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; }
.df-radio { font-size: 12px; color: #888; display: flex; align-items: center; gap: 4px; }

/* --- Drawer --- */
.drawer-overlay { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,0.3); }
.drawer-panel { position: fixed; right: 0; top: 0; bottom: 0; width: 360px; background: #1e1e2e; border-left: 1px solid rgba(255,255,255,0.1); padding: 20px; overflow-y: auto; }
.drawer-header { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
.drawer-title { font-size: 16px; font-weight: 600; color: #e0e0e0; }
.drawer-close { margin-left: auto; background: none; border: none; color: #666; cursor: pointer; font-size: 16px; }
.drawer-body { display: flex; flex-direction: column; gap: 16px; }
.drawer-field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 11px; color: #666; text-transform: uppercase; }
.field-value { font-size: 13px; color: #e0e0e0; }
.ip-value { font-family: monospace; color: #60a5fa; }
.drawer-footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); }

/* --- Drag ghost (global, not scoped) --- */
:global(.drag-ghost) { }
:global(.drag-source) { opacity: 0.3; }
:global(.u-slot.drop-ok) { background: rgba(74, 222, 128, 0.15) !important; box-shadow: inset 0 0 0 1px #4ade80; }
:global(.u-slot.drop-no) { background: rgba(248, 113, 113, 0.1) !important; }

/* --- Transitions --- */
.drawer-slide-enter-active, .drawer-slide-leave-active { transition: transform 0.25s ease; }
.drawer-slide-enter-from .drawer-panel, .drawer-slide-leave-to .drawer-panel { transform: translateX(100%); }
</style>
```

- [ ] **步骤 2：验证编译通过**

运行：`npx vue-tsc --noEmit 2>&1 | head -20`
预期：无新增 TypeScript 错误

- [ ] **步骤 3：运行开发服务器验证**

运行：`npm run dev`
在浏览器中打开 http://localhost:5173/devices，验证：
1. 机柜显示正确，高度随 U 数变化
2. 设备卡片显示名称、IP、型号
3. 统计信息（总 U、已用 U、设备数）正确
4. 拖拽设备可以移动到空位
5. 新建机柜功能正常
6. 新增设备功能正常

- [ ] **步骤 4：Commit**

```bash
git add src/views/DevicesView.vue
git commit -m "refactor(devices): 重写 DevicesView 使用新组件，修复拖拽和机柜高度"
```

---

### 任务 11：清理旧文件

**文件：**
- 删除：`src/views/DevicesView.vue.bak`
- 删除：`src/views/DevicesView.vue.bak2`
- 删除：`src/views/_script_section.ts`

- [ ] **步骤 1：删除备份文件**

```bash
git rm src/views/DevicesView.vue.bak src/views/DevicesView.vue.bak2 src/views/_script_section.ts
```

- [ ] **步骤 2：Commit**

```bash
git commit -m "chore(devices): 清理旧备份文件"
```
