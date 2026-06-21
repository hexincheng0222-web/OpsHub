<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fetchOverview } from '../../api/admin'
import { Monitor, Connection, Printer, FolderOpened, Document, DataBoard, Cellphone } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { formatTime } from '../../utils/format'

const stats = ref<any>({})
const loading = ref(true)

const statCards = computed(() => [
  { label: '设备楼层', value: stats.value.deviceFloors ?? 0, icon: Monitor, color: '#58a6ff' },
  { label: '设备类型', value: stats.value.deviceTypes ?? 0, icon: Connection, color: '#3fb950' },
  { label: '设备型号', value: stats.value.deviceModels ?? 0, icon: Monitor, color: '#a371f7' },
  { label: '打印机楼层', value: stats.value.printerFloors ?? 0, icon: Printer, color: '#58a6ff' },
  { label: '打印机品牌', value: stats.value.printerBrands ?? 0, icon: Printer, color: '#d29922' },
  { label: '打印机型号', value: stats.value.printerModels ?? 0, icon: Printer, color: '#e06c75' },
  { label: '墨粉型号', value: stats.value.tonerModels ?? 0, icon: Printer, color: '#6e7681' },
  { label: '服务分类', value: stats.value.serviceCategories ?? 0, icon: FolderOpened, color: '#58a6ff' },
  { label: '服务主机', value: stats.value.serviceHosts ?? 0, icon: FolderOpened, color: '#3fb950' },
  { label: '采购部门', value: stats.value.procurementDepartments ?? 0, icon: DataBoard, color: '#a371f7' },
  { label: '采购经手人', value: stats.value.procurementHandlers ?? 0, icon: DataBoard, color: '#d29922' },
  { label: '手机品牌', value: stats.value.phoneBrands ?? 0, icon: Cellphone, color: '#58a6ff' },
  { label: '手机型号', value: stats.value.phoneModels ?? 0, icon: Cellphone, color: '#3fb950' },
  { label: '电脑采购型号', value: stats.value.computerPurchaseModels ?? 0, icon: Monitor, color: '#a371f7' },
  { label: '电脑设备型号', value: stats.value.computerDeviceModels ?? 0, icon: Monitor, color: '#d29922' },
  { label: '操作日志', value: stats.value.totalLogs ?? 0, icon: Document, color: '#8b949e' },
])

onMounted(async () => {
  try {
    stats.value = await fetchOverview()
  } catch (e: any) {
    console.error('加载概览失败:', e)
    ElMessage.error(e.message || '加载概览数据失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="overview" v-loading="loading">
    <div class="stat-grid">
      <div v-for="card in statCards" :key="card.label" class="stat-card">
        <div class="stat-value">{{ card.value }}</div>
        <div class="stat-label">{{ card.label }}</div>
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
.overview {
  width: 100%;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--ops-border-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--ops-bg-card);
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--ops-text-primary);
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  margin-top: 6px;
}

.recent-logs {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 8px;
  padding: 16px 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--ops-text-secondary);
  margin: 0;
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
