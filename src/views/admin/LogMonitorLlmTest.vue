<template>
  <div class="llm-config-page">
    <div class="page-header">
      <BackButton to="/admin/log-monitor" />
      <span class="page-title">LLM 配置</span>
    </div>

    <el-card shadow="never">
      <!-- LLM 配置表单 -->
      <el-form :model="form" label-width="130px" v-loading="loading">
        <el-form-item label="API 端点" prop="base_url">
          <el-input v-model="form.base_url" placeholder="http://10.3.0.200:17002/v1" style="width: 380px" />
        </el-form-item>
        <el-form-item label="模型名称" prop="model">
          <el-input v-model="form.model" placeholder="Qwen3.5-9B-AWQ" style="width: 380px" />
        </el-form-item>
        <el-form-item label="API Key" prop="api_key">
          <el-input v-model="form.api_key" placeholder="留空则不修改" show-password style="width: 380px" />
          <div class="form-tip">
            <span v-if="hasApiKey" style="color: var(--ops-accent-green, #3fb950)">✅ 已配置（留空保存则不修改）</span>
            <span v-else>尚未配置 API Key</span>
          </div>
        </el-form-item>
        <el-form-item label="Temperature" prop="temperature">
          <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" />
        </el-form-item>
        <el-form-item label="最大 Tokens" prop="max_tokens">
          <el-input-number v-model="form.max_tokens" :min="1" :max="16384" />
        </el-form-item>
        <el-form-item label="超时(秒)" prop="timeout">
          <el-input-number v-model="form.timeout" :min="1" :max="600" />
        </el-form-item>
        <el-form-item label="重试次数" prop="retries">
          <el-input-number v-model="form.retries" :min="0" :max="10" />
        </el-form-item>
        <el-form-item label="System Prompt" prop="system_prompt">
          <el-input
            v-model="form.system_prompt"
            type="textarea"
            :rows="8"
            placeholder="定义 LLM 如何分析日志、关注哪些异常类型"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSave" :loading="saving">保存配置</el-button>
          <el-button @click="loadConfig">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>
        <span>LLM 连通测试</span>
      </template>
      <div class="test-area">
        <el-button type="primary" :loading="testing" @click="handleTest">
          <el-icon><VideoPlay /></el-icon> 测试当前配置连通性
        </el-button>
        <div class="form-tip">测试会使用下方已填写的配置发起一次真实调用（未保存也会用表单值测试）</div>
      </div>

      <!-- 测试结果 -->
      <div v-if="result" class="test-result">
        <el-alert
          :title="result.success ? `连接成功（耗时 ${result.latency_ms}ms）` : '连接失败'"
          :type="result.success ? 'success' : 'error'"
          :closable="false"
          show-icon
        >
          <template v-if="result.success && result.response">
            <div style="margin-top: 8px">
              <span style="color: var(--el-text-color-secondary)">返回内容：</span>
              <code>{{ result.response }}</code>
            </div>
          </template>
          <template v-if="!result.success && result.error">
            <div style="margin-top: 8px">
              <span style="color: var(--el-text-color-secondary)">错误：</span>
              <code>{{ result.error }}</code>
            </div>
          </template>
        </el-alert>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay } from '@element-plus/icons-vue'
import { getConfig, updateConfig, testLLM } from '../../api/log-monitor'
import BackButton from '../../components/BackButton.vue'

const form = ref<any>({
  base_url: '',
  model: '',
  api_key: '',
  temperature: 0.1,
  max_tokens: 2048,
  timeout: 120,
  retries: 2,
  system_prompt: '',
})
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const hasApiKey = ref(false)
const result = ref<any>(null)

async function loadConfig() {
  loading.value = true
  try {
    const cfg = await getConfig()
    // API Key 不回传明文：标记是否已配置，输入框留空（留空=不修改）
    hasApiKey.value = !!(cfg.llm?.has_api_key || cfg.llm?.api_key)
    form.value = {
      base_url: cfg.llm?.base_url || '',
      model: cfg.llm?.model || '',
      api_key: '',
      temperature: cfg.llm?.temperature ?? 0.1,
      max_tokens: cfg.llm?.max_tokens ?? 2048,
      timeout: cfg.llm?.timeout ?? 120,
      retries: cfg.llm?.retries ?? 2,
      system_prompt: cfg.llm?.system_prompt || '',
    }
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

/** 组装提交 payload：只提交 llm 块；api_key 留空 = 不修改 */
function buildPayload() {
  const { api_key, ...rest } = form.value
  const payload: any = { llm: { ...rest } }
  if (api_key) payload.llm.api_key = api_key
  return payload
}

async function handleSave() {
  saving.value = true
  try {
    await updateConfig(buildPayload())
    ElMessage.success('配置已保存')
    hasApiKey.value = !!form.value.api_key || hasApiKey.value
    form.value.api_key = ''
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

/** 连通测试：优先用表单当前值（含未保存的修改），再回填保存后测试更准确 */
async function handleTest() {
  testing.value = true
  result.value = null
  try {
    // 用表单当前配置临时保存为 llm 块（后端 llm-test 读取的是已保存配置）
    // 若表单值与已保存一致，直接测试；否则先保存再测
    await updateConfig(buildPayload())
    result.value = await testLLM()
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    testing.value = false
  }
}

onMounted(loadConfig)
</script>

<style scoped>
.llm-config-page { padding: 0; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.page-title { font-size: 16px; font-weight: 500; color: var(--ops-text-primary); }
.form-tip { font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 4px; line-height: 1.4; }
.test-area { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.test-result { margin-top: 16px; }
</style>
