<template>
  <div class="monitor-trend">
    <div v-if="!points.length" class="trend-empty">暂无历史数据</div>
    <svg v-else :viewBox="`0 0 ${W} ${H}`" class="trend-svg">
      <line v-for="i in 4" :key="'g'+i" :x1="0" :x2="W" :y1="H/4*i" :y2="H/4*i" class="grid-line" />
      <polyline v-if="cpuLine" :points="cpuLine" class="line line-cpu" />
      <polyline v-if="memLine" :points="memLine" class="line line-mem" />
      <polyline v-if="tempLine" :points="tempLine" class="line line-temp" />
    </svg>
    <div v-if="points.length" class="trend-legend">
      <span class="legend-cpu">■ CPU</span>
      <span class="legend-mem">■ 内存</span>
      <span class="legend-temp">■ 温度(×10°C)</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TrendPoint { collectedAt: string; cpuUsage: number | null; memUsage: number | null; temperature: number | null }
const props = defineProps<{ points: TrendPoint[] }>()

const W = 300
const H = 80

function normalize(values: (number | null)[], scale = 100): string {
  const valid = values.filter((v): v is number => v != null)
  if (!valid.length) return ''
  const max = Math.max(...valid, 1)
  return values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * W
    const y = v == null ? H : H - (v / max * scale) * (H / scale)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

const cpuLine = computed(() => normalize(props.points.map(p => p.cpuUsage)))
const memLine = computed(() => normalize(props.points.map(p => p.memUsage)))
const tempLine = computed(() => normalize(props.points.map(p => p.temperature == null ? null : p.temperature * 10), 1000))
</script>

<style scoped>
.monitor-trend { margin-top: 4px; }
.trend-empty { text-align: center; color: var(--dv-light-dim); font-size: 12px; padding: 16px 0; }
.trend-svg { width: 100%; height: auto; }
.grid-line { stroke: var(--dv-header-border); stroke-width: 0.5; }
.line { fill: none; stroke-width: 1.5; }
.line-cpu { stroke: #58a6ff; }
.line-mem { stroke: #3fb950; }
.line-temp { stroke: #d29922; }
.trend-legend { display: flex; gap: 16px; font-size: 11px; color: var(--dv-light-dim); margin-top: 4px; }
.legend-cpu { color: #58a6ff; }
.legend-mem { color: #3fb950; }
.legend-temp { color: #d29922; }
</style>
