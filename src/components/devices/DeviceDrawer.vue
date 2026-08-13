<template>
  <el-drawer :model-value="visible" size="520px" @close="$emit('close', device)">
    <template #header>
      <div v-if="!editingName" class="drawer-title" @dblclick="startEdit" :title="'双击修改名称'">
        <span class="drawer-title-text">{{ device?.name || '' }}</span>
        <el-icon class="edit-icon" @click.stop="startEdit"><Edit /></el-icon>
      </div>
      <div v-else class="drawer-title-edit">
        <el-input ref="nameInputRef" v-model="nameDraft" size="small" maxlength="100" placeholder="设备名称" @keyup.enter="saveName" @blur="saveName" />
        <el-button size="small" type="primary" :disabled="!nameDraft?.trim() || nameDraft.trim() === device?.name" @mousedown.prevent @click="saveName">保存</el-button>
      </div>
    </template>
    <div class="drawer-tag">{{ typeLabel }}</div>
    <div class="drawer-body">
      <div class="drawer-field"><span class="field-label">型号</span><span class="field-value">{{ device?.model }}</span></div>
      <template v-if="modelDetail">
        <div class="drawer-field"><span class="field-label">厂商</span><span class="field-value">{{ modelDetail.manufacturer || '—' }}</span></div>
        <div class="drawer-field" v-if="modelDetail.description"><span class="field-label">描述</span><span class="field-value">{{ modelDetail.description }}</span></div>
        <div class="drawer-field" v-if="modelDetail.power_watts"><span class="field-label">功耗</span><span class="field-value">{{ modelDetail.power_watts }}W</span></div>
      </template>
      <div class="drawer-field"><span class="field-label">IP 地址</span><span class="field-value ip-value">{{ device?.ip || '—' }}</span></div>
      <div class="drawer-field"><span class="field-label">运行时间</span><span class="field-value">{{ formatUptime(deviceInfo?.uptime) }}</span></div>
      <div class="drawer-field"><span class="field-label">系统</span><span class="field-value">{{ osText }}</span></div>
      <div class="drawer-field" v-if="deviceInfo?.hardware"><span class="field-label">硬件</span><span class="field-value">{{ deviceInfo.hardware }}</span></div>
      <div class="drawer-field" v-if="deviceInfo?.location"><span class="field-label">位置</span><span class="field-value">{{ deviceInfo.location }}</span></div>
      <div class="drawer-field"><span class="field-label">U 高度</span><span class="field-value">{{ device?.u }}U</span></div>
      <div class="drawer-field"><span class="field-label">端口数</span><span class="field-value">{{ device?.ports }}</span></div>
      <div class="drawer-field">
        <span class="field-label">状态</span>
        <el-radio-group :model-value="device?.status" @change="(v: any) => $emit('updateStatus', v)">
          <el-radio value="正常">正常</el-radio>
          <el-radio value="停用">停用</el-radio>
        </el-radio-group>
      </div>
      <MonitorSection
        v-if="device && typeof device.id === 'number'"
        :device-id="device.id"
        :enabled="!!device.monitorEnabled"
      />
    </div>
    <template #footer>
      <el-button type="danger" @click="$emit('delete', device)">删除设备</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import type { Device } from '../../types'
import { DEVICE_TYPE_LABELS } from '../../utils/rack-utils'
import { fetchDeviceInfo, type DeviceInfoData } from '../../api/devices'
import { formatUptime } from '../../utils/format'
import MonitorSection from './MonitorSection.vue'

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

const emit = defineEmits<{
  close: [device: Device | null]
  delete: [device: Device | null]
  updateStatus: [status: string]
  updateName: [name: string]
}>()

const deviceInfo = ref<DeviceInfoData | null>(null)
const nameDraft = ref('')
const editingName = ref(false)
const nameInputRef = ref<{ focus: () => void } | null>(null)

// 设备切换时初始化名称草稿
watch(() => props.device, (d) => {
  nameDraft.value = d?.name || ''
  editingName.value = false
}, { immediate: true })

/** 双击标题进入名称编辑 */
function startEdit() {
  if (!props.device) return
  nameDraft.value = props.device.name || ''
  editingName.value = true
  // 下一帧聚焦输入框（等 v-if 渲染完成）
  requestAnimationFrame(() => nameInputRef.value?.focus())
}

/** 保存名称（回车 / 失焦 / 点保存） */
function saveName() {
  if (!editingName.value) return
  const trimmed = nameDraft.value?.trim() || ''
  if (!trimmed || trimmed === props.device?.name) {
    editingName.value = false  // 无变化直接退出编辑
    return
  }
  emit('updateName', trimmed)
  editingName.value = false
}

const typeLabel = computed(() =>
  props.typeInfo?.name || DEVICE_TYPE_LABELS[props.device?.type || ''] || ''
)

const modelDetail = computed<DeviceDetail | null>(() =>
  props.deviceModels.find((m: any) => m.name === props.device?.model) || null
)

const osText = computed(() => {
  const os = deviceInfo.value?.os
  const version = deviceInfo.value?.version
  if (!os && !version) return '—'
  return [os, version].filter(Boolean).join(' ')
})

// 打开弹窗时拉取基础信息（失败静默显示 —，不打扰用户）
watch(() => props.visible, (v) => {
  if (v && props.device?.id && props.device?.ip) {
    deviceInfo.value = null
    fetchDeviceInfo(props.device.id)
      .then((res) => { if (res.available && res.info) deviceInfo.value = res.info })
      .catch(() => { /* 基础信息缺失时不打扰用户 */ })
  } else {
    deviceInfo.value = null
  }
})
</script>

<style scoped>
.drawer-body { display: flex; flex-direction: column; gap: 16px; }
.drawer-field { display: flex; flex-direction: column; gap: 4px; }
.drawer-title { display: flex; align-items: center; gap: 6px; cursor: text; }
.drawer-title-text { font-size: 16px; font-weight: 600; color: var(--dv-light-text); }
.edit-icon { font-size: 13px; color: var(--dv-light-dim); opacity: 0.6; }
.drawer-title:hover .edit-icon { opacity: 1; color: var(--dv-accent-blue-glow); }
.drawer-title-edit { display: flex; gap: 8px; align-items: center; width: 100%; }
.field-label { font-size: 11px; color: var(--dv-light-dim); text-transform: uppercase; }
.field-value { font-size: 13px; color: var(--dv-light-muted); }
.ip-value { font-family: monospace; color: var(--dv-accent-blue-glow); }
.drawer-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--dv-bar-track); color: var(--dv-light-dim); display: inline-block; margin-bottom: 16px; }
</style>