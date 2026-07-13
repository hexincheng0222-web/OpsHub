<template>
  <div class="log-monitor-dashboard">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <BackButton to="/" />
        <h2 class="page-title">日志监控仪表盘</h2>
      </div>
      <div class="toolbar-right">
        <span class="toolbar-label">时间范围</span>
        <el-select v-model="timeRange" size="small" style="width: 100px">
          <el-option label="5 分钟" value="5m" />
          <el-option label="15 分钟" value="15m" />
          <el-option label="1 小时" value="1h" />
          <el-option label="6 小时" value="6h" />
          <el-option label="24 小时" value="24h" />
          <el-option label="7 天" value="7d" />
        </el-select>

        <span class="toolbar-label">自动刷新</span>
        <el-select v-model="autoRefresh" size="small" style="width: 90px" @change="setupAutoRefresh">
          <el-option label="关" :value="0" />
          <el-option label="5 秒" :value="5000" />
          <el-option label="10 秒" :value="10000" />
          <el-option label="30 秒" :value="30000" />
          <el-option label="1 分钟" :value="60000" />
          <el-option label="5 分钟" :value="300000" />
        </el-select>

        <el-button size="small" :loading="loading" @click="loadDashboard">
          <el-icon><Refresh /></el-icon>
        </el-button>

        <el-button
          v-if="dashData?.scheduler_running"
          size="small" type="danger" plain
          @click="handleStopScheduler"
        >停止调度</el-button>
        <el-button
          v-else
          size="small" type="success" plain
          @click="handleStartScheduler"
        >启动调度</el-button>
      </div>
    </div>

    <!-- 设备卡片网格 -->
    <div v-if="!dashData?.devices?.length && !loading" class="empty-state">
      <el-empty description="暂无监控设备，请前往配置页面添加">
        <el-button type="primary" @click="$router.push('/admin/log-monitor')">前往配置</el-button>
      </el-empty>
    </div>

    <el-row v-if="loading && !dashData" :gutter="16" class="device-grid">
      <el-col v-for="i in 4" :key="i" :xs="24" :sm="24" :md="12" :lg="12" class="device-col">
        <el-skeleton animated>
          <template #template>
            <div style="padding: 16px;">
              <el-skeleton-item variant="text" style="width: 50%; margin-bottom: 12px;" />
              <el-skeleton-item variant="rect" style="height: 96px; margin-bottom: 12px;" />
              <el-skeleton-item variant="rect" style="height: 60px;" />
            </div>
          </template>
        </el-skeleton>
      </el-col>
    </el-row>
    <el-row v-else :gutter="16" class="device-grid" v-loading="loading">
      <el-col
        v-for="device in dashData?.devices || []"
        :key="device.device_id"
        :xs="24" :sm="24" :md="12" :lg="12"
        class="device-col"
      >
        <div
          class="device-card"
          :class="{
            'card-abnormal': device.analysis?.has_abnormal,
            'card-normal': device.analysis && !device.analysis.has_abnormal,
            'card-unknown': !device.analysis,
          }"
          @click="openDrawer(device)"
        >
          <!-- 卡片头部 -->
          <div class="card-header">
            <div class="device-status-dot" :class="statusClass(device)" />
            <div class="device-info">
              <div class="device-name">{{ device.device_name }}</div>
              <div class="device-ip">{{ device.device_id }}</div>
            </div>
            <el-tag size="small" :type="device.log_count > 0 ? 'info' : 'info'" class="log-count-tag">
              {{ device.log_count }} 条日志
            </el-tag>
          </div>

          <!-- 日志预览 -->
          <div class="card-section">
            <div class="section-title">最近日志</div>
            <div v-if="device.logs.length" class="log-preview">
              <div
                v-for="(log, i) in device.logs.slice(0, 5)"
                :key="i"
                class="log-line"
                :class="'log-' + log.level.toLowerCase()"
              >
                <span class="log-time">{{ log.ts || '--:--' }}</span>
                <span class="log-level">{{ log.level }}</span>
                <span class="log-msg">{{ log.msg }}</span>
              </div>
            </div>
            <div v-else class="no-data-box">暂无日志数据</div>
          </div>

          <!-- AI 分析 -->
          <div class="card-section">
            <div class="section-title">AI 分析</div>
            <div v-if="device.analysis" class="analysis-content">
              <div
                class="analysis-badge"
                :class="device.analysis.error ? 'badge-error' : (device.analysis.has_abnormal ? 'badge-abnormal' : 'badge-normal')"
              >
                {{ device.analysis.error ? '查询失败' : (device.analysis.has_abnormal ? '异常' : '正常') }}
              </div>
              <div class="analysis-summary">{{ truncateText(device.analysis.summary) }}</div>
              <div class="analysis-time" v-if="device.analysis.created_at">
                {{ formatISOTime(device.analysis.created_at) }}
              </div>
            </div>
            <div v-else class="no-data-box">暂无分析数据</div>
          </div>

          <!-- 卡片底部 -->
          <div class="card-footer">
            <el-button text type="primary" size="small" @click.stop="openDrawer(device)">
              查看详情
            </el-button>
            <span v-if="device.analysis?.llm_ms" class="latency">{{ device.analysis.llm_ms }}ms</span>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="drawerVisible"
      :title="`设备详情 - ${drawerDevice?.device_name || ''}`"
      width="95%"
      top="2vh"
      draggable
    >
      <template v-if="drawerDevice">
        <!-- 基本信息 -->
        <div class="drawer-section">
          <div class="drawer-label">基本信息</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="设备名称">{{ drawerDevice.device_name }}</el-descriptions-item>
            <el-descriptions-item label="IP">{{ drawerDevice.device_id }}</el-descriptions-item>
            <el-descriptions-item label="日志数">{{ drawerDevice.log_count }} 条</el-descriptions-item>
            <el-descriptions-item label="LLM 耗时">{{ drawerDevice.analysis?.llm_ms || '-' }}ms</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- AI 分析 -->
        <div class="drawer-section">
          <div class="drawer-section-header">
            <div class="drawer-label">AI 分析结果</div>
            <el-button
              size="small"
              type="warning"
              plain
              :loading="analyzing"
              @click="handleAnalyze(drawerDevice)"
            >
              {{ analyzing ? '分析中...' : '手动 AI 分析' }}
            </el-button>
          </div>
          <el-alert
            v-if="drawerDevice.analysis"
            :title="drawerDevice.analysis.error ? '日志查询失败' : (drawerDevice.analysis.has_abnormal ? '检测到异常' : '设备正常')"
            :type="drawerDevice.analysis.error ? 'warning' : (drawerDevice.analysis.has_abnormal ? 'error' : 'success')"
            :closable="false"
            show-icon
          >
            <template #default>
              <div class="drawer-analysis-text">{{ drawerDevice.analysis.summary }}</div>
            </template>
          </el-alert>
          <el-empty v-else description="暂无分析数据" :image-size="40" />
        </div>

        <!-- 完整日志 -->
        <div class="drawer-section">
          <div class="drawer-section-header">
            <div class="drawer-label">完整日志 ({{ drawerDevice.log_count }} 条)</div>
            <el-select v-model="logLevelFilter" size="small" placeholder="全部级别" clearable style="width: 120px">
              <el-option label="Error" value="error" />
              <el-option label="Warning" value="warning" />
              <el-option label="Info" value="info" />
            </el-select>
          </div>
          <div v-if="filteredDrawerLogs.length" class="drawer-logs">
            <div
              v-for="(log, i) in displayedDrawerLogs"
              :key="i"
              class="log-line"
              :class="'log-' + log.level.toLowerCase()"
            >
              <span class="log-time">{{ log.ts || '--:--' }}</span>
              <span class="log-level">{{ log.level }}</span>
              <span class="log-msg-full">{{ log.msg }}</span>
            </div>
            <el-button v-if="displayedCount < filteredDrawerLogs.length" text size="small" @click="loadMoreLogs">
              加载更多（{{ filteredDrawerLogs.length - displayedCount }} 条剩余）
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import BackButton from '../../components/BackButton.vue'
import {
  getDashboard, startScheduler, stopScheduler, analyzeDevice,
  type DashboardData, type DashboardDevice,
} from '../../api/log-monitor'
import { formatISOTime, truncateText } from '../../utils/format'

const timeRange = ref('1h')
let timeRangeTimer: ReturnType<typeof setTimeout> | null = null
watch(timeRange, () => {
  if (timeRangeTimer) clearTimeout(timeRangeTimer)
  timeRangeTimer = setTimeout(() => loadDashboard(), 300)
})
const autoRefresh = ref(0)
const loading = ref(false)
const dashData = ref<DashboardData | null>(null)
let refreshTimer: ReturnType<typeof setInterval> | null = null
let requestId = 0

// 抽屉
const drawerVisible = ref(false)
const drawerDevice = ref<DashboardDevice | null>(null)
const analyzing = ref(false)

// 详情弹窗日志分页
const logLevelFilter = ref('')
const displayedCount = ref(50)
const filteredDrawerLogs = computed(() => {
  if (!drawerDevice.value) return []
  const logs = drawerDevice.value.logs
  if (!logLevelFilter.value) return logs
  return logs.filter(l => l.level.toLowerCase() === logLevelFilter.value)
})
const displayedDrawerLogs = computed(() => filteredDrawerLogs.value.slice(0, displayedCount.value))
function loadMoreLogs() { displayedCount.value += 50 }
watch(drawerVisible, (v) => { if (v) { displayedCount.value = 50; logLevelFilter.value = '' } })

function openDrawer(device: DashboardDevice) {
  drawerDevice.value = device
  drawerVisible.value = true
}

async function handleAnalyze(device: DashboardDevice) {
  analyzing.value = true
  try {
    const res = await analyzeDevice(device.device_id, device.hostname, timeRange.value)
    // 更新弹窗中的分析结果
    if (drawerDevice.value) {
      drawerDevice.value = {
        ...drawerDevice.value,
        analysis: {
          summary: res.summary,
          has_abnormal: res.has_abnormal,
          llm_ms: res.llm_ms,
          created_at: res.created_at,
          error: res.error,
        },
      }
    }
    // 同步更新仪表盘数据
    const dev = dashData.value?.devices.find(d => d.device_id === device.device_id)
    if (dev) {
      dev.analysis = {
        summary: res.summary,
        has_abnormal: res.has_abnormal,
        llm_ms: res.llm_ms,
        created_at: res.created_at,
        error: res.error,
      }
    }
    ElMessage.success('AI 分析完成')
  } catch (e: any) {
    ElMessage.error('AI 分析失败: ' + e.message)
  } finally {
    analyzing.value = false
  }
}

function statusClass(device: DashboardDevice): string {
  if (!device.analysis) return 'dot-unknown'
  if (device.analysis.error) return 'dot-warning'
  return device.analysis.has_abnormal ? 'dot-abnormal' : 'dot-normal'
}

async function loadDashboard() {
  const myId = ++requestId
  loading.value = true
  try {
    const data = await getDashboard(timeRange.value)
    if (myId !== requestId) return  // 已被新请求取代，丢弃
    dashData.value = data
  } catch (e: any) {
    if (myId === requestId) ElMessage.error('加载失败: ' + e.message)
  } finally {
    if (myId === requestId) loading.value = false
  }
}

function setupAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (autoRefresh.value > 0) {
    refreshTimer = setInterval(loadDashboard, autoRefresh.value)
  }
}

async function handleStartScheduler() {
  try {
    await startScheduler()
    ElMessage.success('调度器已启动')
    await loadDashboard()
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

async function handleStopScheduler() {
  try {
    await stopScheduler()
    ElMessage.success('调度器已停止')
    await loadDashboard()
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

onMounted(() => {
  loadDashboard()
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped>
.log-monitor-dashboard {
  padding: 0;
  min-height: 100vh;
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.toolbar-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 设备网格 */
.device-grid {
  margin: 0 -8px;
}
.device-col {
  padding: 8px;
}

/* 设备卡片 */
.device-card {
  background: var(--el-bg-card, rgba(255,255,255,0.06));
  border: 1px solid var(--el-border-color-lighter, rgba(255,255,255,0.1));
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
  position: relative;
  overflow: hidden;
}
.device-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

/* 卡片左边框状态色 */
.card-abnormal { border-left-color: var(--el-color-danger); }
.card-normal { border-left-color: var(--el-color-success); }
.card-unknown { border-left-color: var(--el-color-info); }

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.device-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-normal {
  background: var(--el-color-success);
  box-shadow: 0 0 8px var(--el-color-success);
  animation: pulse-glow 2s ease-in-out infinite;
}
.dot-abnormal {
  background: var(--el-color-danger);
  box-shadow: 0 0 8px var(--el-color-danger);
  animation: pulse-glow 1s ease-in-out infinite;
}
.dot-unknown {
  background: var(--el-color-info);
  box-shadow: 0 0 4px var(--el-color-info);
}
.dot-warning {
  background: var(--el-color-warning);
  box-shadow: 0 0 8px var(--el-color-warning);
  animation: pulse-glow 1s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.device-info {
  flex: 1;
  min-width: 0;
}
.device-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.device-ip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.log-count-tag {
  flex-shrink: 0;
}

/* 卡片区块 */
.card-section {
  margin-bottom: 12px;
}
.section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

/* 日志预览 */
.log-preview {
  background: rgba(0,0,0,0.15);
  border-radius: 8px;
  padding: 8px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  line-height: 1.6;
  max-height: 140px;
  min-height: 96px;
  overflow: hidden;
}
.log-line {
  display: flex;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
}
.log-time {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  width: 140px;
}
.log-level {
  flex-shrink: 0;
  width: 42px;
  font-weight: 500;
}
.log-msg {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-text-color-regular);
}
.log-msg-full {
  word-break: break-all;
  color: var(--el-text-color-regular);
}

/* 日志级别颜色 */
.log-info .log-level { color: var(--el-text-color-secondary); }
.log-warning .log-level { color: var(--el-color-warning); }
.log-error .log-level { color: var(--el-color-danger); }

/* AI 分析 */
.analysis-content {
  background: rgba(0,0,0,0.15);
  border: 1px solid var(--el-border-color-lighter, rgba(255,255,255,0.1));
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.analysis-badge {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
}
.badge-abnormal {
  background: rgba(var(--el-color-danger-rgb), 0.15);
  color: var(--el-color-danger);
}
.badge-normal {
  background: rgba(var(--el-color-success-rgb), 0.15);
  color: var(--el-color-success);
}
.badge-error {
  background: rgba(var(--el-color-warning-rgb), 0.15);
  color: var(--el-color-warning);
}
.analysis-summary {
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.analysis-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
  align-self: flex-end;
  white-space: nowrap;
}

/* 无数据 */
.no-data-box {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 16px 12px;
  background: rgba(0,0,0,0.1);
  border: 1px dashed var(--el-border-color-lighter, rgba(255,255,255,0.1));
  border-radius: 8px;
}

/* 卡片底部 */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.latency {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 空状态 */
.empty-state {
  padding: 80px 0;
  text-align: center;
}

/* 抽屉样式 */
.drawer-section {
  margin-bottom: 24px;
}
.drawer-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.drawer-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}
.drawer-analysis-text {
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 13px;
  max-height: 200px;
  overflow-y: auto;
}
.drawer-logs {
  background: rgba(0,0,0,0.15);
  border-radius: 8px;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.8;
  max-height: 65vh;
  overflow-y: auto;
}
</style>
