<template>
  <div class="monitor-section">
    <div class="monitor-header">
      <span class="monitor-title">实时监控</span>
    </div>

    <!-- 未启用（只读提示，开启操作在后台） -->
    <div v-if="!enabled" class="monitor-empty">
      未启用实时监控。请到后台「系统管理 → 设备型号库 → 设备监控管理」开启。
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

        <div class="monitor-total-rate">
          <span class="total-rate-label">设备总速率</span>
          <span class="total-rate-value">收 {{ formatBps(snapshot.totalRxBps ?? 0) }}</span>
          <span class="total-rate-value">发 {{ formatBps(snapshot.totalTxBps ?? 0) }}</span>
        </div>

        <el-table :data="snapshot.ports" size="small" max-height="240" class="monitor-ports">
          <el-table-column prop="name" label="端口" min-width="80" />
          <el-table-column label="状态" width="60">
            <template #default="{ row }">
              <span class="port-dot" :class="portStatus(row)" :title="portStatus(row) === 'warn' ? '协商速率未达 1G (' + formatSpeed(row.speedBps) + ')' : row.status" />
            </template>
          </el-table-column>
          <el-table-column label="接收" width="80">
            <template #default="{ row }">{{ formatBps(row.rxBps) }}</template>
          </el-table-column>
          <el-table-column label="发送" width="80">
            <template #default="{ row }">{{ formatBps(row.txBps) }}</template>
          </el-table-column>
          <el-table-column label="利用率" width="70">
            <template #default="{ row }">
              <span v-if="portUtil(row) != null" :class="utilClass(row)">{{ portUtil(row) }}%</span>
              <span v-else class="util-na">—</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="monitor-history-header">
          <span class="monitor-history-title">{{ rangeTitle }}趋势</span>
          <el-radio-group v-model="timeRange" size="small" @change="loadHistory">
            <el-radio-button :value="6">6h</el-radio-button>
            <el-radio-button :value="24">24h</el-radio-button>
            <el-radio-button :value="168">7天</el-radio-button>
          </el-radio-group>
        </div>
        <MonitorTrend :points="history" :range-hours="timeRange" />
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

const loading = ref(false)
const available = ref(false)
const snapshot = ref<DeviceSnapshot | null>(null)
const history = ref<{ collectedAt: string; cpuUsage: number | null; memUsage: number | null; temperature: number | null }[]>([])
const reason = ref('')
const timeRange = ref(24)
const reqId = ref(0)

const reasonText = computed(() => {
  if (reason.value === 'pending') return '采集进行中，请稍候…'
  if (reason.value === 'unreachable') return '监控源不可达'
  return '未启用监控或未配置 LibreNMS 采集源'
})

const rangeTitle = computed(() => {
  if (timeRange.value >= 168) return '近 7 天'
  if (timeRange.value >= 24) return '近 24 小时'
  return '近 6 小时'
})

const tempClass = computed(() => {
  const t = snapshot.value?.temperature
  if (t == null) return ''
  if (t >= 75) return 'temp-red'
  if (t >= 60) return 'temp-yellow'
  return 'temp-green'
})

/** 端口状态：down → 红；up 且协商速率明确且 <1G → 黄；其余 up → 绿 */
function portStatus(p: { status: string; speedBps: number | null }): 'up' | 'down' | 'warn' {
  if (p.status !== 'up') return 'down'
  if (p.speedBps != null && p.speedBps < 1_000_000_000) return 'warn'
  return 'up'
}

/** 协商速率格式化（1000 进制，与网络速率约定一致）：1000000000 → "1 Gbps" */
function formatSpeed(bps: number | null): string {
  if (bps == null || bps <= 0) return ''
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps']
  let i = 0; let n = bps
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++ }
  return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

/** 端口带宽利用率：up 且 ifSpeed 有效才计算，取收/发中较大值（%），否则 null */
function portUtil(p: { status: string; rxBps: number; txBps: number; speedBps: number | null }): number | null {
  if (p.status !== 'up' || !p.speedBps || p.speedBps <= 0) return null
  const rxPct = p.rxBps / p.speedBps * 100
  const txPct = p.txBps / p.speedBps * 100
  return Math.min(100, Math.round(Math.max(rxPct, txPct) * 10) / 10)
}

function utilClass(p: { status: string; rxBps: number; txBps: number; speedBps: number | null }): string {
  const u = portUtil(p)
  if (u == null) return ''
  if (u >= 80) return 'util-red'
  if (u >= 50) return 'util-yellow'
  return 'util-green'
}

function formatBps(v: number): string {
  if (!v) return '0'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let i = 0; let n = v
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

async function loadHistory() {
  const my = ++reqId.value
  try {
    const h = await fetchDeviceHistory(props.deviceId, timeRange.value)
    if (my !== reqId.value) return  // 快速连点时丢弃旧响应
    history.value = h.points
  } catch { /* 历史拉取失败静默，保留上次数据 */ }
}

async function loadSnapshot() {
  loading.value = true
  try {
    const res = await fetchDeviceSnapshot(props.deviceId)
    available.value = res.available
    if (res.available && res.snapshot) snapshot.value = res.snapshot
    else reason.value = res.reason || ''
    if (res.available) await loadHistory()
  } catch (e: any) {
    available.value = false
    reason.value = 'unreachable'
    ElMessage.error(e.message || '获取监控数据失败')
  } finally { loading.value = false }
}

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
.monitor-total-rate { display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 8px; border-radius: 6px; background: var(--dv-bar-track); }
.total-rate-label { font-size: 12px; font-weight: 600; color: var(--dv-light-text); }
.total-rate-value { font-size: 12px; color: var(--dv-light-muted); }
.port-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.port-dot.up { background: #3fb950; }
.port-dot.down { background: #f85149; }
.port-dot.warn { background: #d29922; }
.util-na { color: var(--dv-light-dim); }
.util-green { color: #3fb950; }
.util-yellow { color: #d29922; }
.util-red { color: #f85149; }
.monitor-ports { margin: 8px 0; }
.monitor-history-header { display: flex; align-items: center; justify-content: space-between; margin: 12px 0 4px; }
.monitor-history-title { font-size: 12px; color: var(--dv-light-dim); }
</style>
