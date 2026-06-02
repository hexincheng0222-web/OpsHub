<!-- src/components/devices/DeviceForm.vue -->
<script setup lang="ts">
import { reactive, computed } from 'vue'
import type { Device } from '../../mock/devices'
import { DEVICE_TYPE_LABELS } from '../../utils/rack-utils'

const props = defineProps<{ visible: boolean; rackId: string; rackTotalU: number; editDevice?: Device | null }>()
const emit = defineEmits<{ close: []; submit: [data: Omit<Device, 'id'>] }>()

const form = reactive({ name: '', type: 'server' as Device['type'], model: '', u: 1, ports: 24, status: '正常' as Device['status'], ip: '' })

const visible = computed({ get: () => props.visible, set: (v) => { if (!v) emit('close') } })
const needsIp = computed(() => ['server', 'switch', 'router', 'firewall', 'storage'].includes(form.type))

function handleSubmit() {
  if (!form.name || !form.model) return
  emit('submit', { ...form })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="df-overlay" @click.self="emit('close')">
      <div class="df-dialog">
        <div class="df-header">{{ editDevice ? '编辑设备' : '添加设备' }}</div>
        <div class="df-body">
          <label class="df-field"><span class="df-label">设备名称</span><input v-model="form.name" class="df-input" placeholder="如 Web-01"></label>
          <label class="df-field"><span class="df-label">设备类型</span><select v-model="form.type" class="df-input"><option v-for="(label, key) in DEVICE_TYPE_LABELS" :key="key" :value="key">{{ label }}</option></select></label>
          <label class="df-field"><span class="df-label">设备型号</span><input v-model="form.model" class="df-input" placeholder="如 Dell R740"></label>
          <div class="df-row">
            <label class="df-field" style="flex:1"><span class="df-label">U 高度</span><input v-model.number="form.u" type="number" min="1" :max="rackTotalU" class="df-input"></label>
            <label class="df-field" style="flex:1"><span class="df-label">端口数</span><input v-model.number="form.ports" type="number" min="0" class="df-input"></label>
          </div>
          <label v-if="needsIp" class="df-field"><span class="df-label">IP 地址</span><input v-model="form.ip" class="df-input" placeholder="192.168.1.10"></label>
        </div>
        <div class="df-footer">
          <button class="df-btn df-btn-cancel" @click="emit('close')">取消</button>
          <button class="df-btn df-btn-confirm" @click="handleSubmit">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.df-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.df-dialog { background: #1e1e2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 20px; width: 360px; }
.df-header { font-size: 16px; font-weight: 600; color: #e0e0e0; margin-bottom: 16px; }
.df-body { display: flex; flex-direction: column; gap: 12px; }
.df-field { display: flex; flex-direction: column; gap: 4px; }
.df-label { font-size: 12px; color: #888; }
.df-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px 8px; color: #e0e0e0; font-size: 13px; outline: none; }
.df-input:focus { border-color: #4ade80; }
.df-row { display: flex; gap: 12px; }
.df-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.df-btn { padding: 6px 16px; border-radius: 4px; border: none; font-size: 13px; cursor: pointer; }
.df-btn-cancel { background: rgba(255,255,255,0.06); color: #888; }
.df-btn-confirm { background: #4ade80; color: #000; font-weight: 600; }

/* Light theme */
:global(.light-theme) .df-overlay { background: rgba(0,0,0,0.3); }
:global(.light-theme) .df-dialog { background: #fff; border-color: rgba(0,0,0,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
:global(.light-theme) .df-header { color: #1a1a2e; }
:global(.light-theme) .df-label { color: #666; }
:global(.light-theme) .df-input { background: #f5f5f5; border-color: #ddd; color: #333; }
:global(.light-theme) .df-input:focus { border-color: #0d6efd; }
:global(.light-theme) .df-btn-cancel { background: #eee; color: #666; }
:global(.light-theme) .df-btn-confirm { background: #0d6efd; color: #fff; }
</style>
