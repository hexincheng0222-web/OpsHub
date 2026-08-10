<template>
  <div class="alert-config">
    <div class="page-header">
      <BackButton to="/admin" />
    </div>
    <el-form ref="formRef" :model="form" label-width="180px" v-loading="loading">
      <el-divider content-position="left">设备告警配置</el-divider>
      <el-form-item label="告警总开关">
        <el-switch v-model="form.enabled" />
      </el-form-item>
      <el-form-item label="CPU 使用率阈值 (%)">
        <el-input-number v-model="form.cpuThreshold" :min="1" :max="100" :step="1" />
        <div class="form-tip">CPU 使用率超过该值触发告警，恢复后自动清除</div>
      </el-form-item>
      <el-form-item label="内存使用率阈值 (%)">
        <el-input-number v-model="form.memThreshold" :min="1" :max="100" :step="1" />
        <div class="form-tip">内存使用率超过该值触发告警，恢复后自动清除</div>
      </el-form-item>
      <el-form-item label="温度阈值 (°C)">
        <el-input-number v-model="form.tempThreshold" :min="1" :max="120" :step="1" />
        <div class="form-tip">设备温度超过该值触发告警，恢复后自动清除</div>
      </el-form-item>
      <el-form-item label="离线判定 (分钟)">
        <el-input-number v-model="form.offlineMinutes" :min="1" :max="1440" :step="1" />
        <div class="form-tip">超过该分钟无成功采集即判定设备离线</div>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
        <el-button @click="handleReset">恢复默认值</el-button>
      </el-form-item>
    </el-form>

    <el-divider content-position="left">低速端口豁免</el-divider>
    <div class="whitelist-panel" v-loading="wlLoading">
      <div class="wl-actions">
        <div class="wl-tip">豁免后，该端口协商速率低于 1Gbps 不再告警（如网卡本身只有 100M 属正常的端口）。添加即时生效，移除后下一轮采集恢复告警。</div>
        <el-button size="small" type="primary" @click="openAddDialog">+ 添加豁免</el-button>
      </div>
      <el-table :data="whitelist" size="small" style="width: 100%">
        <el-table-column prop="device_name" label="设备" min-width="140" show-overflow-tooltip />
        <el-table-column label="IP" width="140">
          <template #default="{ row }"><span class="ip-cell">{{ row.device_ip || '—' }}</span></template>
        </el-table-column>
        <el-table-column prop="if_name" label="端口" width="200" />
        <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.reason || '—' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="添加时间" width="160" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button size="small" type="danger" text @click="handleRemove(row)">移除</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无豁免配置" :image-size="50" /></template>
      </el-table>
    </div>

    <el-dialog v-model="addDialogVisible" title="添加端口豁免" width="480px">
      <el-form label-width="70px">
        <el-form-item label="设备">
          <el-select v-model="addForm.deviceId" filterable placeholder="选择设备" style="width: 100%"
            :disabled="addForm.loading" @change="onDeviceChange">
            <el-option v-for="d in devices" :key="d.id" :label="`${d.name} (${d.ip || '—'})`" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="端口">
          <el-select v-model="addForm.ifName" filterable placeholder="先选择设备" style="width: 100%" :disabled="!addForm.deviceId || portOptions.length === 0">
            <el-option v-for="p in portOptions" :key="p.name" :label="p.speedBps != null && p.speedBps < 1e9 ? `${p.name}（当前 ${Math.round(p.speedBps / 1e6)}M）` : p.name" :value="p.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="addForm.reason" placeholder="可选，如：网卡本身只有 100M" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addForm.saving" :disabled="!addForm.deviceId || !addForm.ifName" @click="handleAdd">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchConfig, saveConfig } from '../../api/admin'
import { fetchAllDevices, fetchPortWhitelist, addPortWhitelist, removePortWhitelist, fetchDeviceUpPorts, type PortWhitelistItem } from '../../api/devices'
import BackButton from '../../components/BackButton.vue'

const DEFAULTS = {
  enabled: true,
  cpuThreshold: 90,
  memThreshold: 90,
  tempThreshold: 75,
  offlineMinutes: 15,
}

const loading = ref(false)
const saving = ref(false)
const form = reactive({ ...DEFAULTS })

const KEY_MAP: Record<string, keyof typeof DEFAULTS> = {
  alert_enabled: 'enabled',
  alert_cpu_threshold: 'cpuThreshold',
  alert_mem_threshold: 'memThreshold',
  alert_temp_threshold: 'tempThreshold',
  alert_offline_minutes: 'offlineMinutes',
}

async function load() {
  loading.value = true
  try {
    const configs = await fetchConfig()
    for (const c of configs) {
      const target = KEY_MAP[c.key]
      if (!target) continue
      if (target === 'enabled') form.enabled = c.value !== 'false'
      else form[target] = parseFloat(c.value) || DEFAULTS[target]
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载配置失败')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await saveConfig([
      { key: 'alert_enabled', value: String(form.enabled) },
      { key: 'alert_cpu_threshold', value: String(form.cpuThreshold) },
      { key: 'alert_mem_threshold', value: String(form.memThreshold) },
      { key: 'alert_temp_threshold', value: String(form.tempThreshold) },
      { key: 'alert_offline_minutes', value: String(form.offlineMinutes) },
    ])
    ElMessage.success('配置已保存，下一个采集周期生效')
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function handleReset() {
  Object.assign(form, DEFAULTS)
  ElMessage.info('已恢复默认值，点击「保存配置」生效')
}

// ============ 低速端口豁免 ============
const whitelist = ref<PortWhitelistItem[]>([])
const wlLoading = ref(false)
const devices = ref<{ id: number; name: string; ip: string | null }[]>([])
const addDialogVisible = ref(false)
const portOptions = ref<{ name: string; speedBps: number | null }[]>([])
const addForm = reactive({
  deviceId: null as number | null,
  ifName: '',
  reason: '',
  loading: false,
  saving: false,
})

async function loadWhitelist() {
  wlLoading.value = true
  try { whitelist.value = await fetchPortWhitelist() }
  catch (e: any) { ElMessage.error(e.message || '加载豁免列表失败') }
  finally { wlLoading.value = false }
}

async function openAddDialog() {
  addDialogVisible.value = true
  addForm.deviceId = null
  addForm.ifName = ''
  addForm.reason = ''
  portOptions.value = []
  if (devices.value.length === 0) {
    try {
      addForm.loading = true
      devices.value = (await fetchAllDevices()).map(d => ({ id: d.id, name: d.name, ip: d.ip }))
    } catch (e: any) { ElMessage.error(e.message || '加载设备失败') }
    finally { addForm.loading = false }
  }
}

async function onDeviceChange(deviceId: number) {
  addForm.ifName = ''
  portOptions.value = []
  try {
    const ports = await fetchDeviceUpPorts(deviceId)
    // 竞态保护：响应返回时若已切到其他设备则丢弃
    if (addForm.deviceId !== deviceId) return
    portOptions.value = ports
  } catch (e: any) { ElMessage.warning('读取端口列表失败: ' + e.message) }
}

async function handleAdd() {
  if (!addForm.deviceId || !addForm.ifName) return
  addForm.saving = true
  try {
    await addPortWhitelist({ deviceId: addForm.deviceId, ifName: addForm.ifName, reason: addForm.reason })
    ElMessage.success('豁免已添加，立即生效')
    addDialogVisible.value = false
    loadWhitelist()
  } catch (e: any) { ElMessage.error(e.message || '添加失败') }
  finally { addForm.saving = false }
}

async function handleRemove(row: PortWhitelistItem) {
  try {
    await ElMessageBox.confirm(`确定移除「${row.device_name || ''} ${row.if_name}」的豁免？移除后该端口将恢复低速告警。`, '确认移除', { type: 'warning' })
    await removePortWhitelist(row.id)
    ElMessage.success('豁免已移除，下一轮采集恢复告警')
    loadWhitelist()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e.message || '移除失败')
  }
}

onMounted(() => { load(); loadWhitelist() })
</script>

<style scoped>
.alert-config { max-width: 720px; }
.form-tip { font-size: 12px; color: var(--ops-text-tertiary); margin-left: 12px; }
.page-header { margin-bottom: 16px; }
.whitelist-panel { border: 1px solid var(--ops-border-card); border-radius: 8px; padding: 14px; }
.wl-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.wl-tip { font-size: 12px; color: var(--ops-text-tertiary); line-height: 1.6; }
.ip-cell { font-family: monospace; color: var(--ops-text-secondary); }
</style>
