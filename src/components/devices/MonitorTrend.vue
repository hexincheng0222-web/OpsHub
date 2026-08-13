<template>
  <div class="monitor-trend">
    <div v-if="!points.length" class="trend-empty">暂无历史数据</div>
    <svg v-else :viewBox="`0 0 ${W} ${H}`" class="trend-svg">
      <!-- 网格线 + 左右轴刻度 -->
      <g v-for="g in gridRows" :key="'g' + g.v">
        <line :x1="M.left" :x2="M.left + plotW" :y1="g.y" :y2="g.y" class="grid-line" />
        <text :x="M.left - 4" :y="g.y + 3" class="axis-label axis-label-left" text-anchor="end">{{ g.v }}%</text>
        <text :x="M.left + plotW + 4" :y="g.y + 3" class="axis-label axis-label-right" text-anchor="start">{{ g.v }}°C</text>
      </g>

      <!-- X 轴时间标签 -->
      <text v-for="t in xTicks" :key="t.ts" :x="t.x" :y="H - 4" class="axis-label axis-label-x" text-anchor="middle">{{ t.label }}</text>

      <!-- 折线（分段，遇 null 断开） -->
      <polyline v-for="(seg, i) in cpuSegs" :key="'cpu' + i" :points="seg" class="line line-cpu" />
      <polyline v-for="(seg, i) in memSegs" :key="'mem' + i" :points="seg" class="line line-mem" />
      <polyline v-for="(seg, i) in tempSegs" :key="'temp' + i" :points="seg" class="line line-temp" />
    </svg>
    <div v-if="points.length" class="trend-legend">
      <span class="legend-cpu">■ CPU</span>
      <span class="legend-mem">■ 内存</span>
      <span class="legend-temp">■ 温度(°C)</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatAxisTime } from '../../utils/format'

interface TrendPoint { collectedAt: string; cpuUsage: number | null; memUsage: number | null; temperature: number | null }

const props = defineProps<{
  points: TrendPoint[]
  rangeHours?: number
}>()

// 布局常量（viewBox 320x112，绘图区 264x82）
const W = 320
const H = 112
const M = { top: 8, right: 26, bottom: 22, left: 30 }
const plotW = W - M.left - M.right
const plotH = H - M.top - M.bottom

const gridRows = [
  { v: 0, y: M.top + plotH },
  { v: 25, y: M.top + plotH * 0.75 },
  { v: 50, y: M.top + plotH * 0.5 },
  { v: 75, y: M.top + plotH * 0.25 },
  { v: 100, y: M.top },
]

/** 时间段起止时间戳（本地时区），时间映射天然处理数据缺口 */
const timeRange = computed(() => {
  const hours = props.rangeHours && props.rangeHours > 0 ? props.rangeHours : 24
  const end = Date.now()
  return { start: end - hours * 3600 * 1000, end }
})

const xTicks = computed(() => {
  const { start, end } = timeRange.value
  const hours = props.rangeHours && props.rangeHours > 0 ? props.rangeHours : 24
  const stepMs = hours >= 168 ? 24 * 3600 * 1000 : hours >= 24 ? 4 * 3600 * 1000 : 3600 * 1000
  // 取整对齐，避免数据点时间偏移
  const first = Math.ceil(start / stepMs) * stepMs
  const ticks: { ts: number; x: number; label: string }[] = []
  for (let t = first; t <= end; t += stepMs) {
    ticks.push({
      ts: t,
      x: xFor(t),
      label: formatAxisTime(t, hours),
    })
  }
  return ticks
})

/** X 坐标：按时间段时间戳线性映射 */
function xFor(t: number): number {
  const { start, end } = timeRange.value
  const span = end - start
  if (span <= 0) return M.left
  return M.left + plotW * (t - start) / span
}

/** Y 坐标：0–100 线性映射 */
function yFor(v: number): number {
  return M.top + plotH * (1 - Math.max(0, Math.min(100, v)) / 100)
}

/** 解析 UTC 时间字符串（无时区则补 Z），返回毫秒时间戳 */
function parseCollectedAt(s: string): number | null {
  let iso = s
  // 后端 collected_at 为 UTC 'YYYY-MM-DD HH:MM:SS'，补 Z 让 Date 按 UTC 解析再转本地
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) iso = s.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d.getTime()
}

/** 构建折线段：null/非有限值跳过；时间缺口（>2 倍采样周期）断开分段；段内点数过多时抽稀保持锐利 */
function buildSegments(values: (number | null)[], times: (number | null)[]): string[] {
  // 1. 收集有效点（原始时间戳）
  const pts: { t: number; v: number }[] = []
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    const t = times[i]
    if (v == null || !isFinite(v) || t == null) continue
    pts.push({ t, v })
  }
  if (!pts.length) return []

  // 2. 按时间缺口分段（5 分钟采样周期 ×2 = 10 分钟）
  const gapMs = 2 * 5 * 60 * 1000
  const segs: { t: number; v: number }[][] = []
  let cur: { t: number; v: number }[] = []
  let lastT: number | null = null
  for (const p of pts) {
    if (lastT != null && p.t - lastT > gapMs) {
      if (cur.length) segs.push(cur)
      cur = []
    }
    cur.push(p)
    lastT = p.t
  }
  if (cur.length) segs.push(cur)

  // 3. 每段内抽稀（超 400 点均匀取样，保留首尾）
  return segs.map(seg => {
    let picked = seg
    if (seg.length > 400) {
      const step = Math.ceil(seg.length / 400)
      picked = []
      for (let i = 0; i < seg.length; i += step) picked.push(seg[i])
      if (picked[picked.length - 1] !== seg[seg.length - 1]) picked.push(seg[seg.length - 1])
    }
    return picked.map(p => `${xFor(p.t).toFixed(1)},${yFor(p.v).toFixed(1)}`).join(' ')
  })
}

const times = computed(() => props.points.map(p => parseCollectedAt(p.collectedAt)))
const cpuSegs = computed(() => buildSegments(props.points.map(p => p.cpuUsage), times.value))
const memSegs = computed(() => buildSegments(props.points.map(p => p.memUsage), times.value))
const tempSegs = computed(() => buildSegments(props.points.map(p => p.temperature), times.value))
</script>

<style scoped>
.monitor-trend { margin-top: 4px; }
.trend-empty { text-align: center; color: var(--dv-light-dim); font-size: 12px; padding: 16px 0; }
.trend-svg { width: 100%; height: auto; }
.grid-line { stroke: var(--dv-header-border); stroke-width: 0.5; }
.axis-label { font-size: 8px; fill: var(--dv-light-dim); }
.line { fill: none; stroke-width: 1.5; }
.line-cpu { stroke: #58a6ff; }
.line-mem { stroke: #3fb950; }
.line-temp { stroke: #d29922; }
.trend-legend { display: flex; gap: 16px; font-size: 11px; color: var(--dv-light-dim); margin-top: 4px; }
.legend-cpu { color: #58a6ff; }
.legend-mem { color: #3fb950; }
.legend-temp { color: #d29922; }
</style>
