<template>
  <div class="trend-chart">
    <div v-if="devices.length === 0" class="trend-empty">暂无数据</div>
    <div v-else class="trend-list">
      <div v-for="dev in devices" :key="dev.device_id" class="trend-row">
        <span class="trend-device">{{ dev.device_name }}</span>
        <div class="trend-bars">
          <div
            v-for="d in dev.daily"
            :key="d.date"
            class="trend-bar"
            :class="{ abnormal: d.abnormal_count > 0 }"
            :style="{ height: (maxAbnormal > 0 ? (d.abnormal_count / maxAbnormal * 100) : 0) + '%' }"
            :title="`${d.date}：异常 ${d.abnormal_count} 次 / 共 ${d.total_count} 次`"
          />
        </div>
        <span class="trend-count">{{ dev.daily.reduce((a, b) => a + b.abnormal_count, 0) }} 次异常</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface TrendDevice {
  device_id: string
  device_name: string
  daily: { date: string; abnormal_count: number; total_count: number }[]
}

const props = defineProps<{ devices: TrendDevice[] }>()

const maxAbnormal = computed(() => {
  let max = 1
  for (const dev of props.devices) for (const d of dev.daily) if (d.abnormal_count > max) max = d.abnormal_count
  return max
})
</script>

<style scoped>
.trend-chart { padding: 8px 0; }
.trend-empty { text-align: center; color: var(--ops-text-tertiary); font-size: 12px; padding: 20px 0; }
.trend-list { display: flex; flex-direction: column; gap: 8px; }
.trend-row { display: flex; align-items: center; gap: 12px; }
.trend-device { width: 120px; font-size: 13px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trend-bars { flex: 1; display: flex; gap: 2px; align-items: flex-end; height: 40px; }
.trend-bar { width: 8px; background: var(--ops-border-card, #e4e7ed); border-radius: 2px; min-height: 2px; }
.trend-bar.abnormal { background: #f56c6c; }
.trend-count { font-size: 12px; color: var(--ops-text-tertiary); flex-shrink: 0; }
</style>
