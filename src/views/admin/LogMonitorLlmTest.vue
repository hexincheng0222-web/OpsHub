<template>
  <div class="llm-test-page">
    <el-card shadow="never">
      <template #header>
        <span>LLM 连通测试</span>
      </template>

      <!-- 当前配置 -->
      <el-descriptions :column="2" border size="default" class="config-info">
        <el-descriptions-item label="API 端点">{{ config.llm?.base_url || '未配置' }}</el-descriptions-item>
        <el-descriptions-item label="模型">{{ config.llm?.model || '未配置' }}</el-descriptions-item>
        <el-descriptions-item label="Temperature">{{ config.llm?.temperature }}</el-descriptions-item>
        <el-descriptions-item label="超时">{{ config.llm?.timeout }}s</el-descriptions-item>
      </el-descriptions>

      <div class="test-btn">
        <el-button type="primary" :loading="testing" @click="handleTest">
          <el-icon><VideoPlay /></el-icon> 开始测试连通性
        </el-button>
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
import { getConfig, testLLM } from '../../api/log-monitor'

const config = ref<any>({})
const result = ref<any>(null)
const testing = ref(false)

async function loadConfig() {
  try {
    config.value = await getConfig()
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

async function handleTest() {
  testing.value = true
  result.value = null
  try {
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
.config-info { margin-bottom: 20px; }
.test-btn { margin-bottom: 20px; text-align: center; }
.test-result { margin-top: 16px; }
</style>
