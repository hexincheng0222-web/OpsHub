<template>
  <div class="log-monitor-dashboard">
    <div class="page-header">
      <BackButton to="/" label="返回首页" />
    </div>
    <!-- 状态卡片 -->
    <el-row :gutter="16" class="status-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <div class="card-content">
            <el-icon :size="32" :class="status.running ? 'icon-success' : 'icon-info'">
              <VideoPlay v-if="status.running" /><VideoPause v-else />
            </el-icon>
            <div>
              <div class="card-label">运行状态</div>
              <div class="card-value">
                <el-tag :type="status.running ? 'success' : 'info'" size="small">
                  {{ status.running ? '运行中' : '已停止' }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <div class="card-content">
            <el-icon :size="32" class="icon-primary"><Monitor /></el-icon>
            <div>
              <div class="card-label">监控设备</div>
              <div class="card-value">{{ config.devices?.length || 0 }} 台</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <div class="card-content">
            <el-icon :size="32" class="icon-warning"><WarningFilled /></el-icon>
            <div>
              <div class="card-label">今日异常</div>
              <div class="card-value">{{ todayAbnormal }} 条</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <div class="card-content">
            <el-icon :size="32" class="icon-info"><Clock /></el-icon>
            <div>
              <div class="card-label">上次执行</div>
              <div class="card-value" style="font-size: 13px">
                {{ status.lastRun ? status.lastRun.replace('T', ' ').slice(0, 16) : '未执行' }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <el-button type="primary" :loading="running" @click="handleRunOnce">
        <el-icon><Lightning /></el-icon> 立即执行
      </el-button>
      <el-button v-if="status.running" type="danger" @click="handleStop">
        <el-icon><VideoPause /></el-icon> 停止调度
      </el-button>
      <el-button v-else type="success" @click="handleStart">
        <el-icon><VideoPlay /></el-icon> 启动调度
      </el-button>
      <el-button @click="loadHealth">
        <el-icon><FirstAidKit /></el-icon> 健康检查
      </el-button>
    </div>

    <!-- 最近审计记录 -->
    <el-card shadow="never" class="audit-card">
      <template #header>
        <div class="card-header">
          <span>最近审计记录</span>
          <el-button text type="primary" @click="$router.push('/log-monitor/audit')">
            查看全部 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </template>
      <el-table :data="recentAudit" stripe size="small" v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="device_name" label="设备" min-width="120" />
        <el-table-column prop="log_count" label="日志数" width="70" align="center" />
        <el-table-column prop="llm_summary" label="LLM 摘要" min-width="200" show-overflow-tooltip />
        <el-table-column label="异常" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.has_abnormal ? 'danger' : 'success'" size="small">
              {{ row.has_abnormal ? '异常' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="llm_ms" label="耗时" width="70" align="center">
          <template #default="{ row }">{{ row.llm_ms }}ms</template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="170" />
      </el-table>
      <el-empty v-if="!loading && recentAudit.length === 0" description="暂无审计记录" :image-size="60" />
    </el-card>

    <!-- 健康检查弹窗 -->
    <el-dialog v-model="showHealth" title="系统健康检查" width="500px">
      <div class="health-items">
        <div class="health-item">
          <el-icon :class="healthData?.log_server?.status === 'ok' ? 'icon-success' : 'icon-danger'">
            <CircleCheckFilled v-if="healthData?.log_server?.status === 'ok'" />
            <CircleCloseFilled v-else />
          </el-icon>
          <div>
            <div class="health-label">日志服务器</div>
            <div class="health-detail">
              {{ healthData?.log_server?.status === 'ok' ? `正常 (${healthData.log_server.latency_ms}ms)` : healthData?.log_server?.error || '异常' }}
            </div>
          </div>
        </div>
        <div class="health-item">
          <el-icon :class="healthData?.llm?.status === 'ok' ? 'icon-success' : 'icon-danger'">
            <CircleCheckFilled v-if="healthData?.llm?.status === 'ok'" />
            <CircleCloseFilled v-else />
          </el-icon>
          <div>
            <div class="health-label">LLM 服务</div>
            <div class="health-detail">
              {{ healthData?.llm?.status === 'ok' ? `正常 (${healthData.llm.latency_ms}ms)` : healthData?.llm?.error || '异常' }}
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showHealth = false">关闭</el-button>
        <el-button type="primary" @click="loadHealth">刷新</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  VideoPlay, VideoPause, Monitor, WarningFilled, Clock,
  Lightning, FirstAidKit, ArrowRight, CircleCheckFilled, CircleCloseFilled,
} from '@element-plus/icons-vue'
import {
  getConfig, getAuditList, runOnce, startScheduler,
  stopScheduler, getSchedulerStatus, getHealth,
} from '../../api/log-monitor'
import BackButton from '../../components/BackButton.vue'

const config = ref<any>({})
const status = ref<{ running: boolean; lastRun: string | null }>({ running: false, lastRun: null })
const recentAudit = ref<any[]>([])
const todayAbnormal = ref(0)
const loading = ref(false)
const running = ref(false)
const showHealth = ref(false)
const healthData = ref<any>(null)

async function loadData() {
  loading.value = true
  try {
    const [cfg, audit, st] = await Promise.all([
      getConfig(),
      getAuditList({ page: 1, pageSize: 10 }),
      getSchedulerStatus(),
    ])
    config.value = cfg
    recentAudit.value = audit.list
    status.value = st
    const today = new Date().toISOString().slice(0, 10)
    todayAbnormal.value = audit.list.filter((r: any) => r.created_at >= today && r.has_abnormal).length
  } finally {
    loading.value = false
  }
}

async function loadHealth() {
  healthData.value = await getHealth()
}

async function handleRunOnce() {
  running.value = true
  try {
    await runOnce()
    ElMessage.success('已触发执行')
    setTimeout(loadData, 2000)
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    running.value = false
  }
}

async function handleStart() {
  await startScheduler()
  ElMessage.success('调度器已启动')
  await loadData()
}

async function handleStop() {
  await stopScheduler()
  ElMessage.success('调度器已停止')
  await loadData()
}

onMounted(() => {
  loadData()
  loadHealth()
})
</script>

<style scoped>
.log-monitor-dashboard { padding: 0; }
.page-header { margin-bottom: 16px; }
.status-cards { margin-bottom: 16px; }
.status-card :deep(.el-card__body) { padding: 16px; }
.card-content { display: flex; align-items: center; gap: 12px; }
.card-label { font-size: 12px; color: var(--el-text-color-secondary); }
.card-value { font-size: 18px; font-weight: 600; margin-top: 4px; }
.icon-success { color: var(--el-color-success); }
.icon-warning { color: var(--el-color-warning); }
.icon-danger { color: var(--el-color-danger); }
.icon-primary { color: var(--el-color-primary); }
.icon-info { color: var(--el-color-info); }
.action-bar { margin-bottom: 16px; display: flex; gap: 8px; }
.audit-card { margin-top: 8px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.health-items { display: flex; flex-direction: column; gap: 16px; }
.health-item { display: flex; align-items: center; gap: 12px; }
.health-label { font-weight: 500; }
.health-detail { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
