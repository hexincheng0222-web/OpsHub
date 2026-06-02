<!-- src/components/devices/RackHeader.vue -->
<script setup lang="ts">
defineProps<{ name: string; floor: string }>()
defineEmits<{ edit: []; delete: [] }>()
</script>

<template>
  <div class="rack-header">
    <div class="rh-left">
      <span class="rh-floor">{{ floor }}</span>
    </div>
    <span class="rh-name">{{ name }}</span>
    <div class="rh-actions">
      <button class="rh-btn" @click.stop="$emit('edit')" title="编辑机柜名称">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="rh-btn rh-btn-danger" @click.stop="$emit('delete')" title="删除机柜">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.rack-header {
  display: grid;
  grid-template-columns: 60px 1fr 60px;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(180deg, var(--dv-comp-header-bg), var(--dv-comp-card-bg));
  border-bottom: 1px solid var(--dv-comp-card-border);
}
.rh-left { display: flex; align-items: center; }
.rh-name {
  font-size: 13px; font-weight: 700;
  color: var(--dv-dark-sub);
  letter-spacing: 0.5px;
  text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rh-floor {
  font-size: 9px; font-weight: 700;
  color: var(--dv-dark-dim);
  background: rgba(255,255,255,0.04);
  padding: 1px 7px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.06);
  font-family: 'SF Mono', 'Consolas', monospace;
}
.rh-actions { display: flex; gap: 2px; justify-content: flex-end; }
.rh-btn {
  background: none; border: 1px solid transparent;
  color: var(--dv-comp-btn-color); cursor: pointer;
  padding: 4px 5px; border-radius: 4px; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
}
.rh-btn:hover { background: var(--dv-comp-btn-hover-bg); color: var(--dv-comp-btn-hover-color); border-color: rgba(255,255,255,0.08); }
.rh-btn-danger:hover { color: var(--dv-comp-danger-hover-color); background: var(--dv-comp-danger-hover-bg); border-color: rgba(220,50,50,0.2); }
</style>
