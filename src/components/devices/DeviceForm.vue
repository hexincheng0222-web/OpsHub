<!-- src/components/devices/DeviceForm.vue -->
<script setup lang="ts">
import { reactive, computed, onMounted, ref, watch } from 'vue'
import type { Device } from '../../types'
import { fetchDict } from '../../api/admin'
import { ElMessage } from 'element-plus'

const props = defineProps<{ visible: boolean; rackId: string; rackTotalU: number; editDevice?: Device | null }>()
const emit = defineEmits<{ close: []; submit: [data: Omit<Device, 'id'>] }>()

const submitting = ref(false)

const form = reactive({ name: '', type: 'server' as Device['type'], model: '', u: 1, ports: 24, status: '正常' as Device['status'], ip: '' })

// 从 API 加载字典数据
const deviceTypeOptions = ref<{ key: string; name: string }[]>([])
const deviceModelOptions = ref<{ name: string; type_key: string; manufacturer: string; u_size: number; ports: number }[]>([])

// 按当前设备类型筛选型号
const filteredModelOptions = computed(() =>
  deviceModelOptions.value.filter(m => m.type_key === form.type)
)

onMounted(async () => {
  try {
    const [types, models] = await Promise.all([
      fetchDict('device-types'),
      fetchDict('device-models'),
    ])
    deviceTypeOptions.value = types
    deviceModelOptions.value = models
  } catch (e) {
    console.error('加载字典数据失败:', e)
  }
})

const visible = computed({ get: () => props.visible, set: (v) => { if (!v) emit('close') } })
const needsIp = computed(() => ['server', 'switch', 'router', 'firewall', 'storage'].includes(form.type))

// 选择型号后自动填充 U 高度和端口数
watch(() => form.model, (modelName) => {
  const matched = deviceModelOptions.value.find(m => m.name === modelName)
  if (matched) {
    form.u = matched.u_size || 1
    form.ports = matched.ports || 0
  }
})

// 切换设备类型时清空型号选择
watch(() => form.type, () => {
  form.model = ''
})

function handleSubmit() {
  if (submitting.value) return
  if (!form.name) { ElMessage.warning('请输入设备名称'); return }
  if (!form.model) { ElMessage.warning('请选择设备型号'); return }
  submitting.value = true
  emit('submit', { ...form })
  // 由父组件 onDeviceSubmit 的成功/失败回调置 false；保险起见下一 tick 释放
  setTimeout(() => { submitting.value = false }, 500)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="df-overlay" @click.self="emit('close')">
      <div class="df-dialog">
        <div class="df-header">{{ editDevice ? '编辑设备' : '添加设备' }}</div>
        <div class="df-body">
          <label class="df-field"><span class="df-label">设备名称</span><input v-model="form.name" class="df-input" placeholder="如 Web-01"></label>
          <label class="df-field"><span class="df-label">设备类型</span><select v-model="form.type" class="df-input"><option v-for="dt in deviceTypeOptions" :key="dt.key" :value="dt.key">{{ dt.name }}</option></select></label>
          <label class="df-field"><span class="df-label">设备型号</span><select v-model="form.model" class="df-input"><option value="">请选择型号</option><option v-for="m in filteredModelOptions" :key="m.name" :value="m.name">{{ m.manufacturer ? m.manufacturer + ' ' : '' }}{{ m.name }}</option></select></label>
          <div class="df-row">
            <label class="df-field" style="flex:1"><span class="df-label">U 高度</span><input v-model.number="form.u" type="number" min="1" :max="rackTotalU" class="df-input"></label>
            <label class="df-field" style="flex:1"><span class="df-label">端口数</span><input v-model.number="form.ports" type="number" min="0" class="df-input"></label>
          </div>
          <label v-if="needsIp" class="df-field"><span class="df-label">IP 地址</span><input v-model="form.ip" class="df-input" placeholder="192.168.1.10"></label>
        </div>
        <div class="df-footer">
          <button class="df-btn df-btn-cancel" @click="emit('close')">取消</button>
          <button class="df-btn df-btn-confirm" :disabled="submitting" @click="handleSubmit">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.df-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.df-dialog { background: var(--dv-stat-card-bg); border: 1px solid var(--dv-stat-card-border); border-radius: 8px; padding: 20px; width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.df-header { font-size: 16px; font-weight: 600; color: var(--dv-light-text); margin-bottom: 16px; }
.df-body { display: flex; flex-direction: column; gap: 12px; }
.df-field { display: flex; flex-direction: column; gap: 4px; }
.df-label { font-size: 12px; color: var(--dv-light-dim); }
.df-input { background: var(--dv-bar-track); border: 1px solid var(--dv-kpi-border); color: var(--dv-light-muted); border-radius: 4px; padding: 6px 8px; font-size: 13px; outline: none; }
.df-input:focus { border-color: var(--dv-accent-blue-glow); }
.df-row { display: flex; gap: 12px; }
.df-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.df-btn { padding: 6px 16px; border-radius: 4px; border: none; font-size: 13px; cursor: pointer; }
.df-btn-cancel { background: var(--dv-bar-track); color: var(--dv-light-muted); }
.df-btn-confirm { background: var(--dv-accent-blue); color: #fff; font-weight: 600; }

/* light theme: ensure dialog stands out from overlay */
:global(.light-theme) .df-overlay { background: rgba(0,0,0,0.3); }
:global(.light-theme) .df-dialog { box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
</style>
