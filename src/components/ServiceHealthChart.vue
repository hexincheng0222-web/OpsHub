<template>
  <div class="health-chart">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="chart-svg">
      <polyline :points="linePoints" fill="none" stroke="var(--ops-accent-blue)" stroke-width="1.5" />
      <circle v-for="(p, i) in pointCoords" :key="i" :cx="p.x" :cy="p.y" r="2.5"
        :fill="colorFor(p.status)" />
    </svg>
    <div v-if="!points.length" class="health-empty">暂无检测数据</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  points: Array<{ status: string; latencyMs: number | null; checked_at: string }>
}>()

const W = 320, H = 60, PY = 12

function colorFor(status: string): string {
  return status === 'online' ? 'var(--ops-status-online)'
    : status === 'offline' ? 'var(--ops-status-offline)'
    : status === 'maintenance' ? 'var(--ops-status-maintenance)'
    : 'var(--ops-accent-blue)'
}

const pointCoords = computed(() => {
  const n = props.points.length
  if (!n) return []
  return props.points.map((p, i) => {
    const x = (i / Math.max(1, n - 1)) * W
    const y = p.status === 'online' ? PY : p.status === 'offline' ? H - PY : (PY + H) / 2
    return { x, y, status: p.status, checkedAt: p.checked_at }
  })
})

const linePoints = computed(() => pointCoords.value.map(p => `${p.x},${p.y}`).join(' '))
</script>

<style scoped>
.health-chart { width: 100%; height: 60px; }
.chart-svg { width: 100%; height: 100%; }
.health-empty { text-align: center; color: var(--ops-text-tertiary); font-size: 12px; padding-top: 20px; }
</style>
