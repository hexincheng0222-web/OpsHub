<template>
  <el-drawer :model-value="visible" :title="device?.name || ''" size="400px" @close="$emit('close', drawerDevice)">
    <div class="drawer-tag">{{ typeLabel }}</div>
    <div class="drawer-body">
      <div class="drawer-field"><span class="field-label">型号</span><span class="field-value">{{ device?.model }}</span></div>
      <template v-if="modelDetail">
        <div class="drawer-field"><span class="field-label">厂商</span><span class="field-value">{{ modelDetail.manufacturer || '—' }}</span></div>
        <div class="drawer-field" v-if="modelDetail.description"><span class="field-label">描述</span><span class="field-value">{{ modelDetail.description }}</span></div>
        <div class="drawer-field" v-if="modelDetail.power_watts"><span class="field-label">功耗</span><span class="field-value">{{ modelDetail.power_watts }}W</span></div>
      </template>
      <div class="drawer-field"><span class="field-label">IP 地址</span><span class="field-value ip-value">{{ device?.ip || '—' }}</span></div>
      <div class="drawer-field"><span class="field-label">U 高度</span><span class="field-value">{{ device?.u }}U</span></div>
      <div class="drawer-field"><span class="field-label">端口数</span><span class="field-value">{{ device?.ports }}</span></div>
      <div class="drawer-field">
        <span class="field-label">状态</span>
        <el-radio-group :model-value="device?.status" @change="(v: any) => $emit('updateStatus', v)">
          <el-radio value="正常">正常</el-radio>
          <el-radio value="停用">停用</el-radio>
        </el-radio-group>
      </div>
    </div>
    <template #footer>
      <el-button type="danger" @click="$emit('delete', drawerDevice)">删除设备</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Device } from '../../types'
import { DEVICE_TYPE_LABELS } from '../../utils/rack-utils'

interface DeviceDetail {
  manufacturer?: string
  description?: string
  power_watts?: number
}

const props = defineProps<{
  visible: boolean
  device: Device | null
  deviceModels: DeviceDetail[]
  typeInfo?: { name: string } | null
}>()

defineEmits<{
  close: [device: Device | null]
  delete: [device: Device | null]
  updateStatus: [status: string]
}>()

const typeLabel = computed(() =>
  props.typeInfo?.name || DEVICE_TYPE_LABELS[props.device?.type || ''] || ''
)

const modelDetail = computed<DeviceDetail | null>(() =>
  props.deviceModels.find((m: any) => m.name === props.device?.model) || null
)
</script>

<style scoped>
.drawer-body { display: flex; flex-direction: column; gap: 16px; }
.drawer-field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 11px; color: var(--dv-light-dim); text-transform: uppercase; }
.field-value { font-size: 13px; color: var(--dv-light-muted); }
.ip-value { font-family: monospace; color: var(--dv-accent-blue-glow); }
.drawer-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--dv-bar-track); color: var(--dv-light-dim); display: inline-block; margin-bottom: 16px; }
</style>