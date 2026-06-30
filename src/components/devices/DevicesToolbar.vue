<template>
  <div class="toolbar">
    <div class="floor-tabs">
      <button v-for="floor in floors" :key="floor" class="floor-tab" :class="{ active: activeFloor === floor }" @click="$emit('update:activeFloor', floor)">{{ floor }}</button>
    </div>
    <el-input v-model="searchText" placeholder="搜索设备..." clearable size="small" style="width:180px" />
    <el-select v-model="typeValue" placeholder="全部类型" clearable size="small" style="width:120px">
      <el-option label="全部类型" value="" />
      <el-option v-for="(label, key) in deviceTypeLabels" :key="key" :label="label" :value="key" />
    </el-select>
    <span class="filter-count" v-if="searchText || typeValue">{{ filteredCount }} 台设备</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  floors: string[]
  activeFloor: string
  search: string
  typeFilter: string
  filteredCount: number
  deviceTypeLabels: Record<string, string>
}>()

const emit = defineEmits<{
  'update:activeFloor': [value: string]
  'update:search': [value: string]
  'update:typeFilter': [value: string]
}>()

const searchText = computed({
  get: () => props.search,
  set: (v) => emit('update:search', v),
})

const typeValue = computed({
  get: () => props.typeFilter,
  set: (v) => emit('update:typeFilter', v),
})
</script>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; padding: 10px 12px; background: var(--dv-kpi-bg); border: 1px solid var(--dv-kpi-border); border-radius: 8px; flex-wrap: wrap; }
.floor-tabs { display: flex; gap: 8px; }
.floor-tab { padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; background: var(--dv-kpi-bg); border: 1px solid var(--dv-kpi-border); color: var(--dv-light-muted); transition: all 0.2s; }
.floor-tab.active { background: rgba(88,166,255,0.15); border-color: rgba(88,166,255,0.3); color: var(--dv-accent-blue-glow); }
.floor-tab:hover { border-color: var(--dv-header-border); }
.filter-count { font-size: 11px; color: var(--dv-light-dim); white-space: nowrap; }
</style>
