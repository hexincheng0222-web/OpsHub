<template>
  <div class="log-monitor-config">
    <div class="page-header">
      <BackButton to="/admin" />
    </div>
    <el-form ref="formRef" :model="form" label-width="130px" v-loading="loading">
      <!-- 日志服务器（Loki） -->
      <el-divider content-position="left">Loki 日志源</el-divider>
      <el-form-item label="Loki 地址" prop="log_server.base_url">
        <el-input v-model="form.log_server.base_url" placeholder="http://10.3.0.143:3100（留空则使用模拟数据）" style="width: 380px; margin-right: 8px" />
        <el-button size="default" :loading="testingLoki" @click="handleTestLoki">测试连接</el-button>
        <div class="form-tip">填写 Loki 的 HTTP 地址，设备自动发现和日志拉取均通过此地址查询</div>
      </el-form-item>
      <el-form-item label="超时(秒)" prop="log_server.timeout">
        <el-input-number v-model="form.log_server.timeout" :min="1" :max="300" />
      </el-form-item>

      <!-- 监控设备 -->
      <el-divider content-position="left">监控设备</el-divider>
      <div v-for="(device, idx) in form.devices" :key="idx" class="device-row">
        <el-form-item :label="`设备 ${Number(idx) + 1}`" style="margin-bottom: 8px">
          <el-input v-model="device.device_id" placeholder="device_id" style="width: 180px; margin-right: 8px" />
          <el-input v-model="device.name" placeholder="设备名称" style="width: 180px; margin-right: 8px" />
          <el-button type="danger" text @click="removeDevice(Number(idx))" :disabled="form.devices.length <= 1">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-form-item>
      </div>
      <div style="display: flex; gap: 8px; margin-bottom: 16px">
        <el-button type="primary" text @click="addDevice">
          <el-icon><Plus /></el-icon> 添加设备
        </el-button>
        <el-button type="success" text :loading="discovering" @click="handleDiscover">
          <el-icon><Refresh /></el-icon> 从 Loki 自动获取
        </el-button>
      </div>

      <!-- LLM 配置：已移至独立页面 -->
      <el-divider content-position="left">LLM 配置</el-divider>
      <el-form-item label="LLM 配置">
        <div class="llm-redirect">
          <span class="form-tip">LLM 参数（端点/模型/API Key/提示词）已移至独立页面统一管理</span>
          <el-button type="primary" size="small" @click="$router.push('/admin/log-monitor/llm-test')">
            前往 LLM 配置
          </el-button>
        </div>
      </el-form-item>

      <!-- 调度配置 -->
      <el-divider content-position="left">调度配置</el-divider>
      <el-form-item label="轮询间隔(秒)" prop="scheduler.interval">
        <el-input-number v-model="form.scheduler.interval" :min="10" :max="86400" />
      </el-form-item>
      <el-form-item label="时间窗口(秒)" prop="scheduler.window">
        <el-input-number v-model="form.scheduler.window" :min="1" :max="86400" />
      </el-form-item>

      <!-- 告警推送 -->
      <el-divider content-position="left">告警推送</el-divider>
      <el-form-item label="告警推送" prop="alert.enabled">
        <el-switch v-model="form.alert.enabled" />
      </el-form-item>
      <el-form-item label="Webhook 地址" prop="alert.webhook">
        <el-input v-model="form.alert.webhook" placeholder="企业微信/钉钉机器人 URL" />
      </el-form-item>
      <el-form-item label="静默时段" prop="alert.silent_hours">
        <el-input v-model="form.alert.silent_hours" placeholder="如 22:00-08:00" />
      </el-form-item>
      <el-form-item label="冷却期（分钟）" prop="alert.cooldown_minutes">
        <el-input-number v-model="form.alert.cooldown_minutes" :min="0" :max="1440" />
      </el-form-item>

      <!-- 提交 -->
      <el-form-item>
        <el-button type="primary" @click="handleSave" :loading="saving">保存配置</el-button>
        <el-button @click="loadConfig">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Refresh } from '@element-plus/icons-vue'
import { getConfig, updateConfig, discoverDevices, testLokiConnection } from '../../api/log-monitor'
import BackButton from '../../components/BackButton.vue'

const form = ref<any>({
  log_server: {},
  devices: [],
  llm: {},
  scheduler: {},
  alert: { enabled: false, webhook: '', silent_hours: '', cooldown_minutes: 0 },
})
const loading = ref(false)
const saving = ref(false)
const discovering = ref(false)
const testingLoki = ref(false)

async function loadConfig() {
  loading.value = true
  try {
    const cfg = await getConfig()
    // API Key 不回传明文：LLM 配置已移至独立页面，此处仅保留非 llm 字段
    const { llm: _llm, ...rest } = cfg
    form.value = {
      alert: { enabled: false, webhook: '', silent_hours: '', cooldown_minutes: 0 },
      ...rest,
      llm: {}, // 保留空块占位，避免 form 引用不存在
    }
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function addDevice() {
  form.value.devices.push({ device_id: '', name: '' })
}

function removeDevice(idx: number) {
  form.value.devices.splice(idx, 1)
}

async function handleDiscover() {
  discovering.value = true
  try {
    const devices = await discoverDevices()
    if (!devices.length) {
      ElMessage.warning('未发现任何设备')
      return
    }
    const newDevices = devices.map(d => ({ device_id: d.device_id, name: d.name }))
    const newCount = newDevices.length
    const addedCount = devices.filter(d => d.is_new).length
    form.value.devices = newDevices
    ElMessage.success(`已从 Loki 获取 ${newCount} 台设备${addedCount > 0 ? `（${addedCount} 台新发现）` : ''}`)
  } catch (e: any) {
    ElMessage.error('获取失败: ' + e.message)
  } finally {
    discovering.value = false
  }
}

async function handleTestLoki() {
  const url = form.value.log_server?.base_url
  if (!url) {
    ElMessage.warning('请先填写 Loki 地址')
    return
  }
  testingLoki.value = true
  try {
    const res = await testLokiConnection(url)
    if (res.success) {
      ElMessage.success(`连接成功！延迟 ${res.latency_ms}ms，${res.label_count} 个标签可用`)
    } else {
      ElMessage.error(`连接失败${res.error ? '：' + res.error : ''}`)
    }
  } catch (e: any) {
    ElMessage.error('测试失败: ' + e.message)
  } finally {
    testingLoki.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const payload = { ...form.value }
    // LLM 配置由独立页面管理，此处保存时移除 llm 块，避免覆盖已保存的 LLM 配置
    delete payload.llm
    await updateConfig(payload)
    ElMessage.success('配置已保存')
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

onMounted(loadConfig)
</script>

<style scoped>
.log-monitor-config { padding: 0; }
.page-header { margin-bottom: 16px; }
.device-row { display: flex; align-items: center; }
.form-tip { font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 4px; line-height: 1.4; }
.llm-redirect { display: flex; align-items: center; gap: 12px; }
</style>
