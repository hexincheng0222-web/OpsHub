<!-- src/components/devices/RackHeader.vue -->
<script setup lang="ts">
defineProps<{ name: string; floor: string }>()
defineEmits<{ edit: []; delete: [] }>()
</script>

<template>
  <div class="rack-header">
    <div class="rh-left">
      <span class="rh-name">{{ name }}</span>
      <span class="rh-floor">{{ floor }}</span>
    </div>
    <div class="rh-actions">
      <button class="rh-btn" @click.stop="$emit('edit')" title="编辑">✎</button>
      <button class="rh-btn rh-btn-danger" @click.stop="$emit('delete')" title="删除">✕</button>
    </div>
  </div>
</template>

<style scoped>
.rack-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
.rh-left { display: flex; align-items: center; gap: 8px; }
.rh-name { font-size: 14px; font-weight: 600; color: #e0e0e0; }
.rh-floor { font-size: 10px; color: #888; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 4px; }
.rh-actions { display: flex; gap: 4px; }
.rh-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px; }
.rh-btn:hover { color: #ccc; background: rgba(255,255,255,0.06); }
.rh-btn-danger:hover { color: #f87171; }
</style>
