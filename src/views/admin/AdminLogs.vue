<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchLogs, clearLogs } from '../../api/admin'
import { Delete } from '@element-plus/icons-vue'

const logs = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filterModule = ref('')

const moduleOptions = [
  '设备楼层', '设备类型', '设备型号',
  '打印机品牌', '打印机型号', '墨粉型号',
  '服务分类', '系统',
]

async function loadLogs() {
  loading.value = true
  try {
    const data = await fetchLogs({
      page: page.value,
      pageSize: pageSize.value,
      module: filterModule.value || undefined,
    })
    logs.value = data.rows
    total.value = data.total
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadLogs)

function handlePageChange(p: number) {
  page.value = p
  loadLogs()
}

function handleFilterChange() {
  page.value = 1
  loadLogs()
}

async function handleClear() {
  try {
    await ElMessageBox.confirm('确定清空所有操作日志？此操作不可恢复。', '确认清空', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await clearLogs()
    ElMessage.success('日志已清空')
    page.value = 1
    loadLogs()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '操作失败')
  }
}

function formatTime(t: string) {
  if (!t) return ''
  return t.replace('T', ' ').slice(0, 19)
}

function getActionType(action: string): string {
  if (action === '新增') return 'success'
  if (action === '修改') return 'warning'
  if (action === '删除') return 'danger'
  return 'info'
}
</script>

<template>
  <div class="logs-page">
    <div class="page-header">
      <h2 class="page-title">操作日志</h2>
      <el-button type="danger" plain :icon="Delete" @click="handleClear" size="small">清空日志</el-button>
    </div>

    <div class="filter-bar">
      <el-select
        v-model="filterModule"
        placeholder="按模块筛选"
        clearable
        style="width: 180px"
        @change="handleFilterChange"
      >
        <el-option v-for="m in moduleOptions" :key="m" :label="m" :value="m" />
      </el-select>
      <span class="total-text">共 {{ total }} 条</span>
    </div>

    <el-table :data="logs" v-loading="loading" style="width: 100%" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="module" label="模块" width="120">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ row.module }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="action" label="操作" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="getActionType(row.action)">{{ row.action }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="target" label="目标" width="200" show-overflow-tooltip />
      <el-table-column prop="detail" label="详情" show-overflow-tooltip />
      <el-table-column prop="created_at" label="时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination" v-if="total > pageSize">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.logs-page {
  max-width: 1100px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--ops-text-primary);
  margin: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.total-text {
  font-size: 13px;
  color: var(--ops-text-secondary);
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
