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

const usageColor = computed(() => {
  if (usagePct.value >= 80) return '#f87171'
  if (usagePct.value >= 50) return '#fbbf24'
  return '#4ade80'
})
</script>

<template>
  <div class="rack-stats">
    <div class="rs-item">
      <span class="rs-num rs-total">{{ rack.totalU }}</span>
      <span class="rs-tag">总量</span>
    </div>
    <div class="rs-item">
      <span class="rs-num rs-used">{{ usedU }}</span>
      <span class="rs-tag">已用</span>
    </div>
    <div class="rs-item">
      <span class="rs-num rs-devices">{{ deviceCount }}</span>
      <span class="rs-tag">设备</span>
    </div>
    <div class="rs-bar-wrap">
      <div class="rs-bar">
        <div class="rs-bar-fill" :style="{ width: usagePct + '%', background: usageColor }" />
      </div>
      <span class="rs-pct">{{ usagePct }}%</span>
    </div>
  </div>
</template>

<style scoped>
.rack-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid #1a2230;
  background: #0e131c;
}

.rs-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 36px;
}

.rs-num {
  font-size: 14px;
  font-weight: 700;
  font-family: 'SF Mono', 'Consolas', monospace;
  line-height: 1;
}
.rs-total { color: #6a7888; }
.rs-used { color: #4ade80; }
.rs-devices { color: #60a5fa; }

.rs-tag {
  font-size: 8px;
  color: #4a5a6a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rs-bar-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.rs-bar {
  flex: 1;
  height: 4px;
  background: #141c28;
  border-radius: 2px;
  overflow: hidden;
}

.rs-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease, background 0.3s;
  box-shadow: 0 0 6px rgba(74,222,128,0.3);
}

.rs-pct {
  font-size: 10px;
  font-weight: 600;
  color: #6a7888;
  font-family: 'SF Mono', 'Consolas', monospace;
  width: 30px;
  text-align: right;
  flex-shrink: 0;
}
</style>
