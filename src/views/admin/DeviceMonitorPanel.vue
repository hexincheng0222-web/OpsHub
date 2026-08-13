<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAllDevices, updateDevice } from '../../api/devices'

interface MonitorRow {
  id: number
  name: string
  type: string
  ip: string | null
  model: string
  status: string
  monitorEnabled: boolean
}

const devices = ref<MonitorRow[]>([])
const loading = ref(false)
const switching = ref(false)

const stats = computed(() => {
  const on = devices.value.filter(d => d.monitorEnabled).length
  return { on, total: devices.value.length }
})

const filterType = ref('')
const typeOptions = computed(() => {
  const set = new Set<string>()
  devices.value.forEach(d => set.add(d.type))
  return [...set].sort()
})

const filteredDevices = computed(() =>
  filterType.value ? devices.value.filter(d => d.type === filterType.value) : devices.value
)

async function loadDevices() {
  loading.value = true
  try {
    const list = await fetchAllDevices()
    devices.value = list.map(d => ({ ...d, monitorEnabled: !!d.monitor_enabled }))
  } catch (e: any) {
    ElMessage.error(e.message || '加载设备失败')
  } finally {
    loading.value = false
  }
}

async function onToggle(row: MonitorRow) {
  switching.value = true
  try {
    await updateDevice(row.id, { monitorEnabled: row.monitorEnabled })
    ElMessage.success(row.monitorEnabled ? `已开启「${row.name}」实时监控` : `已关闭「${row.name}」实时监控`)
  } catch (e: any) {
    row.monitorEnabled = !row.monitorEnabled  // 失败回滚
    ElMessage.error(e.message || '操作失败')
  } finally {
    switching.value = false
  }
}

onMounted(loadDevices)
</script>

<template>
  <div class="monitor-panel">
    <div class="panel-header">
      <div class="panel-title">
        设备监控管理
        <span class="panel-sub">已开启 {{ stats.on }} / 共 {{ stats.total }} 台</span>
      </div>
      <div class="panel-actions">
        <el-select v-model="filterType" size="small" placeholder="全部类型" clearable style="width: 130px">
          <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
        </el-select>
        <el-button size="small" @click="loadDevices" :loading="loading">刷新</el-button>
      </div>
    </div>

    <el-table :data="filteredDevices" v-loading="loading" size="small" style="width: 100%" max-height="320">
      <el-table-column prop="name" label="设备名称" min-width="140" show-overflow-tooltip />
      <el-table-column label="IP 地址" width="140">
        <template #default="{ row }">
          <span class="ip-cell">{{ row.ip || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="model" label="型号" min-width="180" show-overflow-tooltip />
      <el-table-column label="状态" width="70">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === '正常' ? 'success' : 'info'">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="实时监控" width="110">
        <template #default="{ row }">
          <el-switch
            v-model="row.monitorEnabled"
            :disabled="!row.ip || switching"
            active-text="开启"
            @change="onToggle(row)"
          />
        </template>
      </el-table-column>
    </el-table>
    <div class="panel-tip">开启后 OpsHub 每 5 分钟从 LibreNMS 采集该设备的 CPU/内存/温度/端口状态。无 IP 设备无法采集。</div>
  </div>
</template>

<style scoped>
.monitor-panel {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 20px;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ops-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--ops-text-tertiary);
}
.panel-actions { display: flex; align-items: center; gap: 8px; }
.ip-cell {
  font-family: monospace;
  color: var(--ops-text-secondary);
}
.panel-tip {
  margin-top: 10px;
  font-size: 12px;
  color: var(--ops-text-tertiary);
  line-height: 1.6;
}
</style>
