<template>
  <div class="alerts-section">
    <div class="alerts-header">
      <div class="alerts-title">
        <span>设备告警</span>
        <span v-if="activeCount" class="alerts-count" :class="{ 'has-critical': criticalCount > 0 }">
          {{ activeCount }} 条活跃 · {{ deviceGroups.length }} 台设备<template v-if="criticalCount"> · {{ criticalCount }} 严重</template><template v-if="warningCount"> · {{ warningCount }} 警告</template>
        </span>
        <span v-else class="alerts-count ok">无活跃告警</span>
      </div>
      <div class="alerts-actions">
        <el-button size="small" text @click="load" :loading="loading">刷新</el-button>
        <el-button size="small" text circle :icon="expanded ? ArrowUp : ArrowDown" @click="expanded = !expanded" />
      </div>
    </div>

    <el-collapse-transition>
      <div v-show="expanded" class="alerts-body">
        <div v-if="deviceGroups.length" class="alerts-groups">
          <div v-for="g in deviceGroups" :key="g.device_id" class="alert-group">
            <div class="group-header" @click="toggleGroup(g.device_id)">
              <div class="group-title">
                <el-icon class="group-caret" :class="{ 'is-open': openDevices[g.device_id] }"><ArrowRight /></el-icon>
                <div class="group-device">
                  <span class="dev-name">{{ g.device_name }}</span>
                  <span class="dev-ip">{{ g.device_ip || '' }}</span>
                </div>
              </div>
              <div class="group-meta">
                <span v-for="(cnt, sev) in g.severityCounts" :key="sev" class="sev-chip" :class="sev">
                  {{ cnt }} {{ sevLabel(sev) }}
                </span>
                <span class="group-type-label">{{ ruleLabel(g.primaryType) }}</span>
                <span class="group-count">{{ g.alerts.length }} 条</span>
              </div>
            </div>
            <el-collapse-transition>
              <div v-show="openDevices[g.device_id]">
                <div class="group-body">
                  <el-table v-if="g.alerts.length" :data="g.alerts" size="small" style="width: 100%">
                    <el-table-column label="规则" width="110">
                      <template #default="{ row }">
                        <el-tag size="small" :type="ruleTagType(row.rule_type)">{{ ruleLabel(row.rule_type) }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="级别" width="80">
                      <template #default="{ row }">
                        <el-tag size="small" :type="sevTagType(row.severity)">{{ sevLabel(row.severity) }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="message" label="告警内容" min-width="240" show-overflow-tooltip />
                    <el-table-column label="首次发现" width="150">
                      <template #default="{ row }">{{ formatTime(row.first_seen) }}</template>
                    </el-table-column>
                    <el-table-column label="最后触发" width="150">
                      <template #default="{ row }">{{ formatTime(row.last_seen) }}</template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </div>
        <div v-else class="alerts-empty">
          <el-empty description="暂无活跃告警" :image-size="60" />
        </div>
      </div>
    </el-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { ArrowDown, ArrowUp, ArrowRight } from '@element-plus/icons-vue'
import { fetchDeviceAlerts, type DeviceAlert } from '../../api/devices'
import { formatTime } from '../../utils/format'

const alerts = ref<DeviceAlert[]>([])
const loading = ref(false)
const expanded = ref(false)
// 设备卡片展开状态（独立响应式对象，computed 重建不丢失）
const openDevices = reactive<Record<number, boolean>>({})
let timer: ReturnType<typeof setInterval> | null = null

function toggleGroup(deviceId: number) { openDevices[deviceId] = !openDevices[deviceId] }

const activeCount = computed(() => alerts.value.length)
const criticalCount = computed(() => alerts.value.filter(a => a.severity === 'critical').length)
const warningCount = computed(() => alerts.value.filter(a => a.severity === 'warning').length)

/** 按设备聚合告警：同一设备的告警合并成一张卡片 */
interface AlertGroup {
  device_id: number
  device_name: string
  device_ip: string | null
  alerts: DeviceAlert[]
  severityCounts: Record<string, number>
  primaryType: string
}

const deviceGroups = computed<AlertGroup[]>(() => {
  const byDevice = new Map<number, DeviceAlert[]>()
  for (const a of alerts.value) {
    if (!byDevice.has(a.device_id)) byDevice.set(a.device_id, [])
    byDevice.get(a.device_id)!.push(a)
  }
  const groups: AlertGroup[] = []
  for (const [deviceId, list] of byDevice) {
    const severityCounts: Record<string, number> = {}
    const typeCounts: Record<string, number> = {}
    for (const a of list) {
      severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1
      typeCounts[a.rule_type] = (typeCounts[a.rule_type] || 0) + 1
    }
    groups.push({
      device_id: deviceId,
      device_name: list[0].device_name || '—',
      device_ip: list[0].device_ip || '',
      alerts: list,
      severityCounts,
      primaryType: Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    })
  }
  return groups
})

const RULE_LABELS: Record<string, string> = {
  cpu: 'CPU 超限', mem: '内存超限', temp: '温度过高', offline: '设备离线',
  port_speed: '端口速率', port_status: '端口状态',
}

function ruleLabel(t: string): string { return RULE_LABELS[t] || t }
function ruleTagType(t: string): 'danger' | 'warning' | 'info' | 'success' {
  if (t === 'offline' || t === 'temp') return 'danger'
  if (t === 'port_status') return 'info'
  return 'warning'
}
function sevTagType(s: string): 'danger' | 'warning' | 'info' {
  if (s === 'critical') return 'danger'
  if (s === 'warning') return 'warning'
  return 'info'
}
function sevLabel(s: string): string {
  if (s === 'critical') return '严重'
  if (s === 'warning') return '警告'
  return '提示'
}

async function load() {
  loading.value = true
  try {
    alerts.value = await fetchDeviceAlerts('active')
  } catch { /* 告警加载失败静默，保留上次数据 */ }
  finally { loading.value = false }
}

onMounted(() => {
  load()
  timer = setInterval(load, 60_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.alerts-section { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--dv-header-border); }
.alerts-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.alerts-title { display: flex; align-items: baseline; gap: 12px; }
.alerts-title > span:first-child { font-size: 13px; font-weight: 600; color: var(--dv-light-text); }
.alerts-count { font-size: 12px; color: var(--dv-light-dim); }
.alerts-count.ok { color: #3fb950; }
.alerts-count.has-critical { color: #f85149; font-weight: 600; }
.alerts-actions { display: flex; align-items: center; gap: 4px; }
.alerts-body { border: 1px solid var(--dv-header-border); border-radius: 10px; overflow: hidden; }

.alerts-groups { display: flex; flex-direction: column; }
.alert-group { border-bottom: 1px solid var(--dv-header-border); }
.alert-group:last-child { border-bottom: none; }

.group-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; cursor: pointer; transition: background 0.15s; }
.group-header:hover { background: var(--dv-bar-track); }
.group-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.group-caret { font-size: 12px; color: var(--dv-light-dim); transition: transform 0.2s; flex-shrink: 0; }
.group-caret.is-open { transform: rotate(90deg); }
.group-device { display: flex; flex-direction: column; line-height: 1.4; min-width: 0; }
.dev-name { font-size: 13px; font-weight: 600; color: var(--dv-light-text); }
.dev-ip { font-size: 11px; color: var(--dv-light-dim); font-family: monospace; }

.group-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.sev-chip { font-size: 11px; padding: 1px 7px; border-radius: 10px; }
.sev-chip.critical { background: rgba(248,81,73,0.15); color: #f85149; }
.sev-chip.warning { background: rgba(210,153,34,0.15); color: #d29922; }
.sev-chip.info { background: rgba(88,166,255,0.12); color: #58a6ff; }
.group-type-label { font-size: 11px; color: var(--dv-light-dim); padding: 1px 7px; border: 1px solid var(--dv-header-border); border-radius: 10px; }
.group-count { font-size: 12px; color: var(--dv-light-muted); }

.group-body { padding: 0 12px 10px; }
.alerts-empty { padding: 8px 0; }
</style>
