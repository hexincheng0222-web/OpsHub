<template>
  <div ref="wrapRef" class="canvas-wrap" :class="{ 'is-panning': panning }" @pointerdown.self="onCanvasBackgroundDown" @wheel.prevent="onWheel">
    <!-- 网格背景覆盖层：铺满 wrap，随缩放/平移同步（单元大小 × scale，位置随 pan 偏移） -->
    <div class="grid-layer" :style="gridStyle" />
    <svg :viewBox="viewBox" class="topo-svg" :style="svgStyle"
         @pointerdown="onCanvasBackgroundDown" @pointerup="onPointerUp">
      <!-- 全透明命中 rect：保证动态扩容后 SVG 空白区可按下平移 -->
      <rect width="100%" height="100%" fill="transparent" pointer-events="all" />
      <!-- 连线层（节点下层） -->
      <g>
        <g v-for="edge in edges" :key="edge.id">
          <path :d="edgePath(edge)" class="edge-line" :class="{ 'edge-selected': selectedEdgeId === edge.id }"
                @pointerdown.stop @click.stop="selectedEdgeId = edge.id" />
          <text :x="edgeMid(edge).x" :y="edgeMid(edge).y" class="edge-label"
                text-anchor="middle" dominant-baseline="middle"
                @click.stop="selectedEdgeId = edge.id">{{ edgeLabel(edge) }}</text>
        </g>
      </g>

      <!-- 节点层 -->
      <g>
        <g v-for="node in nodes" :key="node.device_id"
           :transform="`translate(${node.x - NODE_W / 2}, ${node.y - NODE_H / 2})`"
           class="topo-node"
           :class="{ 'node-selected': store.selectedDeviceId === node.device_id, 'node-offline': node.status !== '正常' }"
           :style="{ '--node-color': node.color || '#58a6ff' }"
           @pointerdown.stop="onNodeDown(node, $event)">
          <title>{{ node.name }}（{{ node.model || '—' }}）{{ node.ip || '' }}</title>
          <rect width="150" height="50" rx="8" fill="var(--dv-comp-card-bg)" :stroke="node.color || '#58a6ff'" stroke-width="1.5" />
          <rect x="2" y="6" width="3" height="38" fill="var(--node-color)" />
          <text x="10" y="17" class="node-abbr">{{ node.abbr || node.type.slice(0, 2).toUpperCase() }}</text>
          <text x="10" y="36" class="node-name">{{ node.name }}</text>
          <text x="147" y="12" text-anchor="end" class="node-ip">{{ node.ip || '' }}</text>
          <circle cx="140" cy="40" r="4" :class="node.status === '正常' ? 'dot-on' : 'dot-off'" />
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useTopologyStore } from '../../stores/topology'
import { NODE_W, NODE_H, TOPO_W, TOPO_H } from '../../composables/useTopologyLayout'
import type { TopologyEdge, TopologyNode } from '../../types/topology'

const store = useTopologyStore()
const selectedEdgeId = ref<number | null>(null)

const nodes = computed(() => store.nodes)
const edges = computed(() => store.edges)

// ============ 画布缩放 / 平移 ============
const wrapRef = ref<HTMLDivElement | null>(null)
const MIN_SCALE = 0.3
const MAX_SCALE = 2.5
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)

const zoomPct = computed(() => Math.round(scale.value * 100))
const svgStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`,
}))

// 动态 viewBox：初始 1600×900，节点拖出边界时实时扩容（可放置区域随放大增长）
const vbW = ref(TOPO_W)
const vbH = ref(TOPO_H)
const viewBox = computed(() => `0 0 ${vbW.value} ${vbH.value}`)

// wrap 实际尺寸（svg 绝对定位铺满 wrap），用于 SVG 单位 ↔ CSS px 换算
const wrapW = ref(0)
const wrapH = ref(0)

/** viewBox → CSS px 映射：M = min(wrapW/vbW, wrapH/vbH)，留白居中（与 svg letterbox 一致） */
function viewToPx(u: { x: number; y: number }) {
  const M = Math.min(wrapW.value / vbW.value, wrapH.value / vbH.value)
  const ox = (wrapW.value - vbW.value * M) / 2
  const oy = (wrapH.value - vbH.value * M) / 2
  return { x: ox + u.x * M, y: oy + u.y * M, M }
}

// 网格覆盖层样式：单元大小随缩放同步（与设备相对比例恒定），位置随平移偏移 + letterbox 留白（与 SVG 内容坐标对齐）
const GRID_SIZE = 40
const gridStyle = computed(() => {
  const M = Math.min(wrapW.value / vbW.value, wrapH.value / vbH.value)
  const cell = GRID_SIZE * scale.value * M
  const ox = (wrapW.value - vbW.value * M) / 2
  const oy = (wrapH.value - vbH.value * M) / 2
  return {
    backgroundSize: `${cell}px ${cell}px`,
    backgroundPosition: `${panX.value + ox * scale.value}px ${panY.value + oy * scale.value}px`,
  }
})

/** 围绕画布中心（wrap 中心）缩放，保持中心点不漂移 */
function applyZoom(next: number) {
  const rect = wrapRef.value?.getBoundingClientRect()
  const cx = rect ? rect.width / 2 : 0
  const cy = rect ? rect.height / 2 : 0
  applyZoomAt(cx, cy, next)
}

/** 围绕 wrap 内任意锚点缩放（锚点为相对 wrap 左上角的 CSS 像素坐标） */
function applyZoomAt(px: number, py: number, next: number) {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
  panX.value = px - ((px - panX.value) / scale.value) * s
  panY.value = py - ((py - panY.value) / scale.value) * s
  scale.value = s
}

function onWheel(e: WheelEvent) {
  const rect = wrapRef.value?.getBoundingClientRect()
  if (!rect) return
  applyZoomAt(e.clientX - rect.left, e.clientY - rect.top, scale.value * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
}

function zoomIn() { applyZoom(scale.value * 1.25) }
function zoomOut() { applyZoom(scale.value / 1.25) }
function zoomReset() { fitViewBoxToNodes(); applyZoom(1); panX.value = 0; panY.value = 0 }
function zoomTo(pct: number) { applyZoom(pct / 100) }

// ============ 动态 viewBox 扩容 ============
/** 边界余量：节点贴近边界时预留的空白宽度（viewBox 单位） */
const VB_MARGIN = 300

/** 按节点位置扩容 viewBox；扩容会改变 M/留白，补偿 pan 使被拖节点视觉位置不动。返回是否扩容 */
function growViewBox(x: number, y: number): boolean {
  const needW = x + NODE_W / 2 + VB_MARGIN
  const needH = y + NODE_H / 2 + VB_MARGIN
  if (needW <= vbW.value && needH <= vbH.value) return false
  const before = viewToPx({ x, y })   // 扩容前被拖节点的屏幕位置
  if (needW > vbW.value) vbW.value = needW
  if (needH > vbH.value) vbH.value = needH
  const after = viewToPx({ x, y })    // 扩容后（M 变小 / 留白变化）
  panX.value += (before.x - after.x) * scale.value
  panY.value += (before.y - after.y) * scale.value
  return true
}

/** 收缩/扩界至恰好容纳所有节点（含历史越界节点），不小于初始画布 */
function fitViewBoxToNodes() {
  let maxX = 0, maxY = 0
  for (const n of store.nodes) {
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }
  vbW.value = Math.max(TOPO_W, maxX + NODE_W / 2 + VB_MARGIN)
  vbH.value = Math.max(TOPO_H, maxY + NODE_H / 2 + VB_MARGIN)
}

// 节点加载/变化时自动扩界（刷新后覆盖历史越界节点）
watch(() => store.nodes, fitViewBoxToNodes, { immediate: true })

// 拖拽状态
interface DragState { deviceId: number; startX: number; startY: number; origX: number; origY: number; moved: boolean }
let drag: DragState | null = null

// 画布平移状态（拖空白处）
interface PanState { clientX: number; clientY: number; panX: number; panY: number }
let pan: PanState | null = null
const panning = ref(false)

function nodeById(id: number): TopologyNode | undefined {
  return store.nodes.find(n => n.device_id === id)
}

function edgeMid(edge: TopologyEdge): { x: number; y: number } {
  const a = nodeById(edge.source_device_id)
  const b = nodeById(edge.target_device_id)
  if (!a || !b) return { x: 0, y: 0 }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function edgePath(edge: TopologyEdge): string {
  const a = nodeById(edge.source_device_id)
  const b = nodeById(edge.target_device_id)
  if (!a || !b) return ''
  const midX = (a.x + b.x) / 2
  return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`
}

function edgeLabel(edge: TopologyEdge): string {
  return `${edge.source_port} ↔ ${edge.target_port}`
}

/** 节点按下：记录拖拽起始 */
function onNodeDown(node: TopologyNode, e: PointerEvent) {
  drag = {
    deviceId: node.device_id,
    startX: e.clientX,
    startY: e.clientY,
    origX: node.x,
    origY: node.y,
    moved: false,
  }
  try { (e.target as Element).setPointerCapture?.(e.pointerId) } catch { /* 合成事件无活动指针时忽略 */ }
}

/** 空白处按下：取消选中 + 进入画布平移（节点/连线自带 .stop，不会冒泡到这里） */
function onCanvasBackgroundDown(e: PointerEvent) {
  store.selectedDeviceId = null
  selectedEdgeId.value = null
  pan = { clientX: e.clientX, clientY: e.clientY, panX: panX.value, panY: panY.value }
  panning.value = true
}

/** 拖拽 / 平移移动（document 级） */
function onDragMove(e: PointerEvent) {
  if (drag) {
    const d = drag
    const node = nodeById(d.deviceId)
    if (!node) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true
    if (d.moved) {
      // viewBox 位移 = 屏幕位移 / (M × scale)：M 是 viewBox→CSS 映射系数，scale 是用户缩放
      const M = Math.min(wrapW.value / vbW.value, wrapH.value / vbH.value)
      const k = M * scale.value
      if (!k) return
      // 用拖拽起点原始坐标 + 位移计算，避免在已更新的 node.x 上累积误差
      // 只保留下限，越界时实时扩容 viewBox（可放置区域随放大增长）
      const newX = Math.max(NODE_W / 2, d.origX + dx / k)
      const newY = Math.max(NODE_H / 2, d.origY + dy / k)
      node.x = newX
      node.y = newY
      if (growViewBox(newX, newY)) {
        // 扩容后 M/留白已变：重锚定拖拽起点，使后续位移按新比例换算、视觉连续
        d.origX = newX
        d.origY = newY
        d.startX = e.clientX
        d.startY = e.clientY
      }
    }
    return
  }
  if (pan) {
    panX.value = pan.panX + (e.clientX - pan.clientX)
    panY.value = pan.panY + (e.clientY - pan.clientY)
  }
}

/** pointerup：区分 click（选中/连线）、拖拽（保存位置）、平移（结束） */
function onPointerUp() {
  if (drag) {
    const d = drag
    drag = null
    if (d.moved) {
      // 拖拽结束，保存位置
      const node = nodeById(d.deviceId)
      if (node) store.updatePos(node.device_id, node.x, node.y)
      return
    }
    // 未移动 → click：点选连线
    const node = nodeById(d.deviceId)
    if (!node) return
    const sel = store.selectedDeviceId

    if (sel == null) {
      store.selectedDeviceId = node.device_id
    } else if (sel === node.device_id) {
      store.selectedDeviceId = null  // 点同一节点取消选中
    } else {
      // 选中了另一个节点 → 打开连线端口选择
      const a = nodeById(sel)
      if (a) store.connectDialog = { a, b: node }
      store.selectedDeviceId = null
    }
    return
  }
  if (pan) {
    pan = null
    panning.value = false
  }
}

// document 级拖拽监听
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', onPointerUp)
  // 跟踪 wrap 尺寸（svg 绝对定位铺满 wrap），供 viewBox ↔ CSS px 换算
  if (wrapRef.value) {
    wrapW.value = wrapRef.value.clientWidth
    wrapH.value = wrapRef.value.clientHeight
    resizeObserver = new ResizeObserver(entries => {
      const entry = entries[entries.length - 1]
      if (entry) {
        wrapW.value = entry.contentRect.width
        wrapH.value = entry.contentRect.height
      }
    })
    resizeObserver.observe(wrapRef.value)
  }
})
onUnmounted(() => {
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', onPointerUp)
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({ zoomPct, zoomIn, zoomOut, zoomReset, zoomTo })
</script>

<style scoped>
.canvas-wrap { position: relative; flex: 1; min-width: 0; overflow: hidden; min-height: 80vh; border: 1px solid var(--dv-header-border); border-radius: 10px; background: var(--dv-page-bg); }
.canvas-wrap.is-panning { cursor: grabbing; }
.grid-layer { position: absolute; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(to right, var(--dv-header-border) 0.5px, transparent 0.5px),
    linear-gradient(to bottom, var(--dv-header-border) 0.5px, transparent 0.5px); }
.topo-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; transform-origin: 0 0; }

.edge-line { fill: none; stroke: #7d8590; stroke-width: 1.5; pointer-events: stroke; cursor: pointer; }
.edge-line.edge-selected { stroke: #58a6ff; stroke-width: 2.5; }
.edge-label { font-size: 11px; fill: var(--dv-light-muted); pointer-events: none; paint-order: stroke; stroke: var(--dv-page-bg); stroke-width: 3px; }

.topo-node { cursor: grab; }
.topo-node:active { cursor: grabbing; }
.topo-node.node-selected rect { stroke-width: 3; filter: drop-shadow(0 0 6px var(--dv-accent-blue-glow)); }
.topo-node.node-offline { opacity: 0.5; }
.node-abbr { font-size: 10px; font-weight: 700; fill: var(--node-color); }
.node-name { font-size: 13px; font-weight: 600; fill: #e6edf3; }
.node-ip { font-size: 10px; fill: #8b9bb4; font-family: monospace; }
.dot-on { fill: #3fb950; }
.dot-off { fill: #f85149; }
</style>
