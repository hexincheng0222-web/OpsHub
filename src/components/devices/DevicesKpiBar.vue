<template>
  <div class="kpi-bar">
    <div class="kpi-card kpi-total">
      <div class="kpi-data"><span class="kpi-number">{{ totalDevices }}</span><span class="kpi-unit">台</span></div>
      <div class="kpi-label">设备总数</div>
    </div>
    <div class="kpi-card kpi-online">
      <div class="kpi-data"><span class="kpi-number">{{ normalDevices }}</span><span class="kpi-unit">台</span></div>
      <div class="kpi-label">在线</div>
    </div>
    <div class="kpi-card kpi-offline">
      <div class="kpi-data"><span class="kpi-number">{{ stoppedDevices }}</span><span class="kpi-unit">台</span></div>
      <div class="kpi-label">停用</div>
    </div>
    <div class="kpi-card kpi-rack">
      <div class="kpi-data"><span class="kpi-number">{{ rackCount }}</span><span class="kpi-unit">个</span></div>
      <div class="kpi-label">机柜</div>
    </div>
    <div class="kpi-card kpi-usage">
      <div class="kpi-data"><span class="kpi-number">{{ usagePercent }}</span><span class="kpi-unit">%</span></div>
      <div class="kpi-label">U位使用率</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  totalDevices: number
  normalDevices: number
  stoppedDevices: number
  rackCount: number
  usagePercent: number
}>()
</script>

<style scoped>
.kpi-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.kpi-card { flex: 1; background: var(--dv-kpi-bg); border: 1px solid var(--dv-kpi-border); border-radius: 10px; padding: 12px; text-align: center; }
.kpi-data { display: flex; align-items: baseline; justify-content: center; gap: 2px; }
.kpi-number { font-size: 24px; font-weight: 700; color: var(--dv-light-text); }
.kpi-unit { font-size: 12px; color: var(--dv-light-dim); }
.kpi-label { font-size: 11px; color: var(--dv-light-dim); margin-top: 4px; }
.kpi-online .kpi-number { color: var(--dv-accent-green); }
.kpi-offline .kpi-number { color: var(--dv-accent-red-dim); }
.kpi-usage .kpi-number { color: var(--dv-accent-blue-glow); }
</style>
