<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchOverview, fetchOverviewTrend } from '../../api/admin'
import {
  Monitor, Connection, Printer,
  FolderOpened, ShoppingBag, Cellphone, DataAnalysis, Document, DataBoard,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { formatTime } from '../../utils/format'

const router = useRouter()

const stats = ref<any>({})
const loading = ref(true)
const trendDays = ref(7)
const trend = ref<{ date: string; count: number }[]>([])
const trendLoading = ref(false)

interface StatCard {
  label: string
  value: number
  icon: any
  color: string
  route?: string  // 点击跳转的路由
}

const statCards = computed<StatCard[]>(() => [
  { label: '设备楼层', value: stats.value.deviceFloors ?? 0, icon: Monitor, color: '#58a6ff', route: '/admin/floors' },
  { label: '设备类型', value: stats.value.deviceTypes ?? 0, icon: Connection, color: '#3fb950', route: '/admin/devices/types' },
  { label: '设备型号', value: stats.value.deviceModels ?? 0, icon: Monitor, color: '#a371f7', route: '/admin/devices/models' },
  { label: '打印机楼层', value: stats.value.printerFloors ?? 0, icon: Printer, color: '#58a6ff', route: '/admin/floors' },
  { label: '打印机品牌', value: stats.value.printerBrands ?? 0, icon: Printer, color: '#d29922', route: '/admin/printers/brands' },
  { label: '打印机型号', value: stats.value.printerModels ?? 0, icon: Printer, color: '#e06c75', route: '/admin/printers/models' },
  { label: '墨粉型号', value: stats.value.tonerModels ?? 0, icon: Printer, color: '#6e7681', route: '/admin/printers/toners' },
  { label: '服务分类', value: stats.value.serviceCategories ?? 0, icon: FolderOpened, color: '#58a6ff', route: '/admin/services/categories' },
  { label: '服务主机', value: stats.value.serviceHosts ?? 0, icon: FolderOpened, color: '#3fb950', route: '/admin/services/hosts' },
  { label: '采购部门', value: stats.value.procurementDepartments ?? 0, icon: DataBoard, color: '#a371f7', route: '/admin/procurement/departments' },
  { label: '采购经手人', value: stats.value.procurementHandlers ?? 0, icon: DataBoard, color: '#d29922', route: '/admin/procurement/handlers' },
  { label: '手机品牌', value: stats.value.phoneBrands ?? 0, icon: Cellphone, color: '#58a6ff', route: '/admin/procurement/phone-brands' },
  { label: '手机型号', value: stats.value.phoneModels ?? 0, icon: Cellphone, color: '#3fb950', route: '/admin/procurement/phone-models' },
  { label: '电脑型号', value: stats.value.computerPurchaseModels ?? 0, icon: Monitor, color: '#a371f7', route: '/admin/procurement/computer-models' },
  { label: '操作日志', value: stats.value.totalLogs ?? 0, icon: Document, color: '#8b949e', route: '/admin/logs' },
])

async function loadStats() {
  loading.value = true
  try {
    stats.value = await fetchOverview()
  } catch (e: any) {
    console.error('加载概览失败:', e)
    ElMessage.error(e.message || '加载概览数据失败')
  } finally {
    loading.value = false
  }
}

async function loadTrend() {
  trendLoading.value = true
  try {
    const res = await fetchOverviewTrend(trendDays.value)
    trend.value = res.trend
  } catch (e: any) {
    console.error('加载趋势失败:', e)
  } finally {
    trendLoading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadTrend()
})

const maxTrend = computed(() => Math.max(1, ...trend.value.map(t => t.count)))

function goTarget(route: string) {
  router.push(route)
}
</script>

<template>
  <div class="overview" v-loading="loading">
    <div class="stat-grid">
      <div
        v-for="card in statCards"
        :key="card.label"
        class="stat-card"
        :class="{ clickable: card.route }"
        :style="{ '--card-color': card.color }"
        @click="card.route && goTarget(card.route)"
      >
        <div class="stat-icon" :style="{ background: card.color + '22', color: card.color }">
          <el-icon :size="18"><component :is="card.icon" /></el-icon>
        </div>
        <div class="stat-value">{{ card.value }}</div>
        <div class="stat-label">{{ card.label }}</div>
        <div v-if="card.route" class="stat-hint">点击查看 →</div>
      </div>
    </div>

    <!-- 操作趋势 -->
    <div class="trend-card">
      <div class="section-header">
        <span class="section-title">操作趋势（近 {{ trendDays }} 天）</span>
        <el-radio-group v-model="trendDays" size="small" @change="loadTrend">
          <el-radio-button :value="7">7 天</el-radio-button>
          <el-radio-button :value="14">14 天</el-radio-button>
          <el-radio-button :value="30">30 天</el-radio-button>
        </el-radio-group>
      </div>
      <div class="trend-chart" v-loading="trendLoading">
        <div v-if="trend.length === 0" class="trend-empty">暂无数据</div>
        <div v-else class="trend-bars">
          <div
            v-for="t in trend"
            :key="t.date"
            class="trend-col"
            :title="`${t.date}：${t.count} 次操作`"
          >
            <div class="trend-bar-wrap">
              <div class="trend-bar" :style="{ height: (t.count / maxTrend * 100) + '%' }">
                <span v-if="t.count > 0" class="trend-count">{{ t.count }}</span>
              </div>
            </div>
            <span class="trend-date">{{ t.date }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="recent-logs">
      <div class="section-header">
        <span class="section-title">最近操作</span>
        <el-button type="primary" text size="small" @click="$router.push('/admin/logs')">查看全部</el-button>
      </div>
      <el-table :data="stats.recentLogs || []" style="width: 100%" :show-header="false" size="small" empty-text="暂无操作日志">
        <el-table-column width="100">
          <template #default="{ row }">
            <span class="log-module">{{ row.module }}</span>
          </template>
        </el-table-column>
        <el-table-column width="60" prop="action" />
        <el-table-column prop="target" />
        <el-table-column width="160" align="right">
          <template #default="{ row }">
            <span class="log-time">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.overview { width: 100%; }

.stat-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.stat-card {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  transition: all 0.2s;
  position: relative;
}
.stat-card.clickable { cursor: pointer; }
.stat-card.clickable:hover {
  border-color: var(--card-color);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}
.stat-card.clickable:hover .stat-hint { opacity: 1; }
.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--ops-text-primary);
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  margin-top: 4px;
}
.stat-hint {
  font-size: 11px;
  color: var(--card-color);
  margin-top: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}

.trend-card {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 24px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.section-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--ops-text-secondary);
  margin: 0;
}
.trend-empty { text-align: center; color: var(--ops-text-tertiary); font-size: 12px; padding: 24px 0; }
.trend-bars { display: flex; align-items: flex-end; gap: 6px; height: 120px; }
.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.trend-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.trend-bar {
  width: 100%;
  max-width: 32px;
  background: linear-gradient(180deg, #58a6ff, #3d8bfd);
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  position: relative;
  transition: height 0.3s;
}
.trend-count {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: var(--ops-text-secondary);
}
.trend-date {
  font-size: 10px;
  color: var(--ops-text-tertiary);
  margin-top: 6px;
  transform: scale(0.85);
}

.recent-logs {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 8px;
  padding: 16px 20px;
}
.log-module {
  font-size: 12px;
  color: var(--ops-text-tertiary);
}
.log-time {
  font-size: 12px;
  color: var(--ops-text-tertiary);
}
</style>
