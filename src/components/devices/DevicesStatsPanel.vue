<template>
  <div class="stats-section">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-header">楼层使用率</div>
        <div v-for="floor in floors" :key="floor" class="fb-row">
          <span class="fb-label">{{ floor }}</span>
          <div class="fb-bar-track"><div class="fb-bar-fill" :style="{ width: (floorUsage[floor] || 0) + '%' }" /></div>
          <span class="fb-pct">{{ floorUsage[floor] || 0 }}%</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">设备类型分布</div>
        <div v-for="item in typeStats" :key="item.type" class="tb-row">
          <span class="tb-dot" :class="'dot-' + item.type" />
          <span class="tb-label">{{ item.label }}</span>
          <div class="tb-bar-track"><div class="tb-bar-fill" :class="'bg-' + item.type" :style="{ width: (item.pct) + '%' }" /></div>
          <span class="tb-count">{{ item.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TypeStatItem {
  type: string
  label: string
  count: number
  pct: number
}

defineProps<{
  floors: string[]
  floorUsage: Record<string, number>
  typeStats: TypeStatItem[]
}>()
</script>

<style scoped>
.stats-section { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--dv-header-border); }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.stat-card { background: var(--dv-stat-card-bg); border: 1px solid var(--dv-stat-card-border); border-radius: 10px; padding: 16px; }
.stat-card-header { font-size: 12px; color: var(--dv-light-dim); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.fb-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.fb-label { font-size: 11px; color: var(--dv-light-muted); width: 30px; flex-shrink: 0; }
.fb-bar-track { flex: 1; height: 6px; background: var(--dv-bar-track); border-radius: 3px; overflow: hidden; }
.fb-bar-fill { height: 100%; background: linear-gradient(90deg, var(--dv-accent-green), var(--dv-accent-blue-glow)); border-radius: 3px; transition: width 0.3s; }
.fb-pct { font-size: 11px; color: var(--dv-light-dim); width: 32px; text-align: right; }
.tb-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.tb-dot { width: 8px; height: 8px; border-radius: 50%; }
.tb-label { font-size: 11px; color: var(--dv-light-muted); width: 48px; }
.tb-bar-track { flex: 1; height: 6px; background: var(--dv-bar-track); border-radius: 3px; overflow: hidden; }
.tb-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.tb-count { font-size: 11px; color: var(--dv-light-dim); width: 20px; text-align: right; }
.bg-server { background: #1e4470; } .bg-switch { background: #1e5a44; } .bg-storage { background: #443070; }
.bg-router { background: #70441e; } .bg-firewall { background: #701e1e; } .bg-ups { background: #4a441e; } .bg-pdu { background: #1e3a3a; }
.dot-server { background: #2a5a8a; } .dot-switch { background: #2a7a5a; } .dot-storage { background: #5a3a8a; }
.dot-router { background: #8a5a2a; } .dot-firewall { background: #8a2a2a; } .dot-ups { background: #6a6a2a; } .dot-pdu { background: #2a4a4a; }
</style>
