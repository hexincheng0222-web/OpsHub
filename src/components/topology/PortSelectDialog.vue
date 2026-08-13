<template>
  <el-dialog v-model="visible" title="添加连线" width="520px" destroy-on-close>
    <div v-loading="loading" class="port-dialog">
      <div class="port-side">
        <div class="port-device">{{ a?.name }}</div>
        <el-select v-model="portA" filterable allow-create default-first-option placeholder="选择端口" style="width: 100%">
          <el-option v-for="p in portsA" :key="p" :label="p" :value="p" />
        </el-select>
      </div>
      <div class="port-mid">↔</div>
      <div class="port-side">
        <div class="port-device">{{ b?.name }}</div>
        <el-select v-model="portB" filterable allow-create default-first-option placeholder="选择端口" style="width: 100%">
          <el-option v-for="p in portsB" :key="p" :label="p" :value="p" />
        </el-select>
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!portA || !portB" @click="handleConfirm">添加连线</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTopologyStore } from '../../stores/topology'
import { getDevicePorts } from '../../utils/topology-ports'
import type { TopologyNode } from '../../types/topology'

const store = useTopologyStore()
const visible = ref(false)
const loading = ref(false)
const a = ref<TopologyNode | null>(null)
const b = ref<TopologyNode | null>(null)
const portA = ref('')
const portB = ref('')
const portsA = ref<string[]>([])
const portsB = ref<string[]>([])

watch(() => store.connectDialog, async (d) => {
  if (d) {
    a.value = d.a
    b.value = d.b
    portA.value = ''
    portB.value = ''
    visible.value = true
    await loadPorts()
  } else {
    visible.value = false
  }
})

async function loadPorts() {
  if (!a.value || !b.value) return
  loading.value = true
  try {
    const [pa, pb] = await Promise.all([
      getDevicePorts(a.value.device_id, devicePortCount(a.value), a.value.type),
      getDevicePorts(b.value.device_id, devicePortCount(b.value), b.value.type),
    ])
    portsA.value = pa
    portsB.value = pb
    portA.value = pa[0] || ''
    portB.value = pb[0] || ''
  } finally {
    loading.value = false
  }
}

function devicePortCount(node: TopologyNode): number {
  return store.deviceMap.get(node.device_id)?.ports || 24
}

async function handleConfirm() {
  if (!a.value || !b.value || !portA.value || !portB.value) return
  try {
    await store.addEdge({
      source_device_id: a.value.device_id,
      source_port: portA.value,
      target_device_id: b.value.device_id,
      target_port: portB.value,
    })
    store.connectDialog = null
    ElMessage.success('连线已添加')
  } catch { /* store 已提示错误 */ }
}
</script>

<style scoped>
.port-dialog { display: flex; align-items: flex-start; gap: 12px; }
.port-side { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.port-device { font-size: 13px; font-weight: 600; color: var(--ops-text-primary); }
.port-mid { align-self: center; font-size: 18px; color: var(--ops-text-tertiary); padding-top: 24px; }
</style>
