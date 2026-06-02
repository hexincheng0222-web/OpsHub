<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchOverview } from '../../api/admin'
import { Monitor, Connection, Printer, FolderOpened, Document } from '@element-plus/icons-vue'

const stats = ref<any>({})
const loading = ref(true)

const statCards = computed(() => [
  { label: '设备楼层', value: stats.value.deviceFloors ?? 0, icon: Monitor, color: '#58a6ff' },
  { label: '设备类型', value: stats.value.deviceTypes ?? 0, icon: Connection, color: '#3fb950' },
  { label: '设备型号', value: stats.value.deviceModels ?? 0, icon: Monitor, color: '#a371f7' },
  { label: '打印机品牌', value: stats.value.printerBrands ?? 0, icon: Printer, color: '#d29922' },
  { label: '打印机型号', value: stats.value.printerModels ?? 0, icon: Printer, color: '#e06c75' },
  { label: '墨粉型号', value: stats.value.tonerModels ?? 0, icon: Printer, color: '#6e7681' },
  { label: '服务分类', value: stats.value.serviceCategories ?? 0, icon: FolderOpened, color: '#58a6ff' },
  { label: '操作日志', value: stats.value.totalLogs ?? 0, icon: Document, color: '#8b949e' },
])

onMounted(async () => {
  try {
    stats.value = await fetchOverview()
  } catch (e) {
    console.error('加载概览失败:', e)
  } finally {
    loading.value = false
  }
})

function formatTime(t: string) {
  if (!t) return ''
  return t.replace('T', ' ').slice(0, 19)
}
</script>

<script lang="ts">
import { computed } from 'vue'
export default {}
</script>

<template>
  <div class="overview">
    <h2 class="page-title">系统概览</h2>

    <div v-loading="loading" class="stat-grid">
      <div v-for="card in statCards" :key="card.label" class="stat-card">
        <div class="stat-icon" :style="{ color: card.color, background: card.color + '18' }">
          <el-icon :size="28"><component :is="card.icon" /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </div>
      </div>
    </div>

    <!-- 最近操作日志 -->
    <div class="recent-logs">
      <h3 class="section-title">最近操作</h3>
      <el-table :data="stats.recentLogs || []" style="width: 100%" :show-header="false" size="small" empty-text="暂无操作日志">
        <el-table-column width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.module }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column width="60" prop="action" />
        <el-table-column prop="target" />
        <el-table-column width="180" align="right">
          <template #default="{ row }">
            <span class="log-time">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.overview {
  max-width: 1000px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--ops-text-primary);
  margin: 0 0 24px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 10px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: border-color 0.2s;
}

.stat-card:hover {
  border-color: var(--ops-accent-blue);
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--ops-text-primary);
}

.stat-label {
  font-size: 13px;
  color: var(--ops-text-secondary);
  margin-top: 2px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-text-primary);
  margin: 0 0 16px;
}

.log-time {
  font-size: 12px;
  color: var(--ops-text-tertiary);
}

.recent-logs {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 10px;
  padding: 20px;
}
</style>
