<template>
  <div class="log-monitor-config">
    <div class="page-header">
      <BackButton to="/admin" />
    </div>
    <el-form ref="formRef" :model="form" label-width="130px" v-loading="loading">
      <!-- 日志服务器 -->
      <el-divider content-position="left">日志服务器</el-divider>
      <el-form-item label="基础 URL" prop="log_server.base_url">
        <el-input v-model="form.log_server.base_url" placeholder="http://127.0.0.1:8080" />
      </el-form-item>
      <el-form-item label="请求路径" prop="log_server.path">
        <el-input v-model="form.log_server.path" placeholder="/api/v1/logs?device_id={device_id}&start_time={start_time}&end_time={end_time}" />
      </el-form-item>
      <el-form-item label="分页大小" prop="log_server.page_size">
        <el-input-number v-model="form.log_server.page_size" :min="1" :max="10000" />
      </el-form-item>
      <el-form-item label="超时(秒)" prop="log_server.timeout">
        <el-input-number v-model="form.log_server.timeout" :min="1" :max="300" />
      </el-form-item>

      <!-- 监控设备 -->
      <el-divider content-position="left">监控设备</el-divider>
      <div v-for="(device, idx) in form.devices" :key="idx" class="device-row">
        <el-form-item :label="`设备 ${idx + 1}`" style="margin-bottom: 8px">
          <el-input v-model="device.device_id" placeholder="device_id" style="width: 180px; margin-right: 8px" />
          <el-input v-model="device.name" placeholder="设备名称" style="width: 180px; margin-right: 8px" />
          <el-button type="danger" text @click="removeDevice(idx)" :disabled="form.devices.length <= 1">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-form-item>
      </div>
      <el-button type="primary" text @click="addDevice" style="margin-bottom: 16px">
        <el-icon><Plus /></el-icon> 添加设备
      </el-button>

      <!-- LLM 配置 -->
      <el-divider content-position="left">LLM 配置</el-divider>
      <el-form-item label="API 端点" prop="llm.base_url">
        <el-input v-model="form.llm.base_url" placeholder="http://10.3.0.200:17002/v1" />
      </el-form-item>
      <el-form-item label="模型名称" prop="llm.model">
        <el-input v-model="form.llm.model" placeholder="Qwen3.5-9B-AWQ" />
      </el-form-item>
      <el-form-item label="API Key" prop="llm.api_key">
        <el-input v-model="form.llm.api_key" placeholder="EMPTY" show-password />
      </el-form-item>
      <el-form-item label="Temperature" prop="llm.temperature">
        <el-input-number v-model="form.llm.temperature" :min="0" :max="2" :step="0.1" />
      </el-form-item>
      <el-form-item label="最大 Tokens" prop="llm.max_tokens">
        <el-input-number v-model="form.llm.max_tokens" :min="1" :max="16384" />
      </el-form-item>
      <el-form-item label="超时(秒)" prop="llm.timeout">
        <el-input-number v-model="form.llm.timeout" :min="1" :max="600" />
      </el-form-item>
      <el-form-item label="重试次数" prop="llm.retries">
        <el-input-number v-model="form.llm.retries" :min="0" :max="10" />
      </el-form-item>

      <!-- 分析约束 -->
      <el-divider content-position="left">分析约束（System Prompt）</el-divider>
      <el-form-item label="提示词" prop="llm.system_prompt">
        <el-input
          v-model="form.llm.system_prompt"
          type="textarea"
          :rows="10"
          placeholder="定义 LLM 如何分析日志、关注哪些异常类型"
        />
      </el-form-item>

      <!-- 调度配置 -->
      <el-divider content-position="left">调度配置</el-divider>
      <el-form-item label="轮询间隔(秒)" prop="scheduler.interval">
        <el-input-number v-model="form.scheduler.interval" :min="10" :max="86400" />
      </el-form-item>
      <el-form-item label="时间窗口(秒)" prop="scheduler.window">
        <el-input-number v-model="form.scheduler.window" :min="1" :max="86400" />
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
import { Plus, Delete } from '@element-plus/icons-vue'
import { getConfig, updateConfig } from '../../api/log-monitor'
import BackButton from '../../components/BackButton.vue'

const form = ref<any>({
  log_server: {},
  devices: [],
  llm: {},
  scheduler: {},
})
const loading = ref(false)
const saving = ref(false)

async function loadConfig() {
  loading.value = true
  try {
    form.value = await getConfig()
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

async function handleSave() {
  saving.value = true
  try {
    await updateConfig(form.value)
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
</style>
