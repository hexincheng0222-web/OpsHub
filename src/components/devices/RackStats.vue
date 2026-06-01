<!-- src/components/devices/RackStats.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Rack } from '../../mock/devices'
import { buildOccupied } from '../../utils/rack-utils'

const props = defineProps<{ rack: Rack }>()

const usedU = computed(() => {
  const occupied = buildOccupied(props.rack)
  let count = 0
  for (const d of occupied) { if (d) count++ }
  return count
})

const deviceCount = computed(() => {
  const seen = new Set<number>()
  const occupied = buildOccupied(props.rack)
  for (const d of occupied) { if (d) seen.add(d.id) }
  return seen.size
})

const usagePct = computed(() => {
  if (props.rack.totalU === 0) return 0
  return Math.round((usedU.value / props.rack.totalU) * 100)
})
</script>

<template>
  <div class="rack-stats">
    <div class="rs-card"><div class="rs-value">{{ rack.totalU }}U</div><div class="rs-label">总容量</div></div>
    <div class="rs-card"><div class="rs-value">{{ usedU }}U</div><div class="rs-label">已用</div></div>
    <div class="rs-card"><div class="rs-value">{{ deviceCount }}</div><div class="rs-label">设备</div></div>
    <div class="rs-bar-wrap"><div class="rs-bar"><div class="rs-bar-fill" :style="{ width: usagePct + '%' }" /></div></div>
  </div>
</template>

<style scoped>
.rack-stats { display: flex; gap: 8px; align-items: center; padding: 8px 0; }
.rs-card { flex: 1; background: rgba(255,255,255,0.04); border-radius: 4px; padding: 4px 6px; text-align: center; }
.rs-value { font-size: 12px; font-weight: 600; color: #e0e0e0; }
.rs-label { font-size: 9px; color: #888; }
.rs-bar-wrap { flex: 2; }
.rs-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
.rs-bar-fill { height: 100%; background: linear-gradient(90deg, #4ade80, #22d3ee); border-radius: 2px; transition: width 0.3s; }
</style>
