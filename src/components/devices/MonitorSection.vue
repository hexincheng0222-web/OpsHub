<template>
  <div class="monitor-section">
    <div class="monitor-header">
      <span class="monitor-title">实时监控</span>
      <el-switch
        v-if="!enabled"
        v-model="pendingEnable"
        active-text="启用监控"
        @change="onEnableChange"
      />
    </div>

    <!-- 未启用 -->
    <div v-if="!enabled && !pendingEnable" class="monitor-empty">
      未启用实时监控。开启后 OpsHub 将每 5 分钟从 LibreNMS 采集该设备的 CPU/内存/温度/端口状态。
    </div>

    <!-- 启用后状态 -->
    <template v-else-if="enabled">
      <div v-if="loading" class="monitor-empty">采集进行中…</div>
      <div v-else-if="!available" class="monitor-empty">{{ reasonText }}</div>
      <template v-else-if="snapshot">
        <div class="monitor-gauges">
          <div class="gauge-item">
            <el-progress type="dashboard" :percentage="snapshot.cpuUsage ?? 0" :width="72" :stroke-width="8" />
            <span class="gauge-label">CPU</span>
            <span class="gauge-value">{{ snapshot.cpuUsage == null ? '—' : snapshot.cpuUsage + '%' }}</span>
          </div>
          <div class="gauge-item">
            <el-progress type="dashboard" :percentage="snapshot.memUsage ?? 0" :width="72" :stroke-width="8" />
            <span class="gauge-label">内存</span>
            <span class="gauge-value">{{ snapshot.memUsage == null ? '—' : snapshot.memUsage + '%' }}</span>
          </div>
          <div class="gauge-item">
            <span class="gauge-temp" :class="tempClass">{{ snapshot.temperature == null ? '—' : snapshot.temperature + '°C' }}</span>
            <span class="gauge-label">温度</span>
          </div>
        </div>

        <el-table :data="snapshot.ports" size="small" max-height="240" class="monitor-ports">
          <el-table-column prop="name" label="端口" min-width="80" />
          <el-table-column label="状态" width="60">
            <template #default="{ row }">
              <span class="port-dot" :class="row.status" :title="row.status === 'up' ? 'up' : 'down'" />
            </template>
          </el-table-column>
          <el-table-column label="接收" width="90">
            <template #default="{ row }">{{ formatBps(row.rxBps) }}</template>
          </el-table-column>
          <el-table-column label="发送" width="90">
            <template #default="{ row }">{{ formatBps(row.txBps) }}</template>
          </el-table-column>
        </el-table>

        <div class="monitor-history-title">近 24 小时趋势</div>
        <MonitorTrend :points="history" />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchDeviceSnapshot, fetchDeviceHistory, type DeviceSnapshot } from '../../api/devices'
import MonitorTrend from './MonitorTrend.vue'

const props = defineProps<{ deviceId: number; enabled: boolean }>()
const emit = defineEmits<{ enable: [value: boolean] }>()

const pendingEnable = ref(false)
const loading = ref(false)
const available = ref(false)
const snapshot = ref<DeviceSnapshot | null>(null)
const history = ref<{ collectedAt: string; cpuUsage: number | null; memUsage: number | null; temperature: number | null }[]>([])
const reason = ref('')

const reasonText = computed(() => {
  if (reason.value === 'pending') return '采集进行中，请稍候…'
  if (reason.value === 'unreachable') return '监控源不可达'
  return '未启用监控或未配置 LibreNMS 采集源'
})
const tempClass = computed(() => {
  const t = snapshot.value?.temperature
  if (t == null) return ''
  if (t >= 75) return 'temp-red'
  if (t >= 60) return 'temp-yellow'
  return 'temp-green'
})

function formatBps(v: number): string {
  if (!v) return '0'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let i = 0; let n = v
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

async function loadSnapshot() {
  loading.value = true
  try {
    const res = await fetchDeviceSnapshot(props.deviceId)
    available.value = res.available
    if (res.available && res.snapshot) snapshot.value = res.snapshot
    else reason.value = res.reason || ''
    if (res.available) { const h = await fetchDeviceHistory(props.deviceId, 24); history.value = h.points }
  } catch (e: any) {
    available.value = false
    reason.value = 'unreachable'
    ElMessage.error(e.message || '获取监控数据失败')
  } finally { loading.value = false }
}

function onEnableChange(v: boolean) { emit('enable', v) }

watch(() => props.enabled, (v) => { if (v) loadSnapshot() }, { immediate: true })

defineExpose({ refresh: loadSnapshot })
</script>

<style scoped>
.monitor-section { border-top: 1px solid var(--dv-header-border); margin-top: 16px; padding-top: 16px; }
.monitor-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.monitor-title { font-size: 13px; font-weight: 600; color: var(--dv-light-text); }
.monitor-empty { font-size: 12px; color: var(--dv-light-dim); line-height: 1.6; padding: 12px 0; }
.monitor-gauges { display: flex; gap: 24px; justify-content: space-around; margin: 12px 0; }
.gauge-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.gauge-label { font-size: 11px; color: var(--dv-light-dim); }
.gauge-value { font-size: 12px; color: var(--dv-light-muted); }
.gauge-temp { font-size: 18px; font-weight: 700; }
.temp-green { color: #3fb950; }
.temp-yellow { color: #d29922; }
.temp-red { color: #f85149; }
.port-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.port-dot.up { background: #3fb950; }
.port-dot.down { background: #f85149; }
.monitor-ports { margin: 8px 0; }
.monitor-history-title { font-size: 12px; color: var(--dv-light-dim); margin: 12px 0 4px; }
</style>
