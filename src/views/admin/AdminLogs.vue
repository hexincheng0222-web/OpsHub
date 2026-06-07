<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchLogs, clearLogs } from '../../api/admin'
import { Search } from '@element-plus/icons-vue'

const logs = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filterModule = ref('')
const searchText = ref('')

const moduleOptions = [
  '设备楼层', '设备类型', '设备型号',
  '打印机品牌', '打印机型号', '墨粉型号',
  '服务分类', '系统',
]

const filteredLogs = computed(() => {
  if (!searchText.value) return logs.value
  const q = searchText.value.toLowerCase()
  return logs.value.filter(row =>
    (row.module || '').toLowerCase().includes(q) ||
    (row.action || '').toLowerCase().includes(q) ||
    (row.target || '').toLowerCase().includes(q) ||
    (row.detail || '').toLowerCase().includes(q)
  )
})

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

watch(filterModule, () => {
  page.value = 1
  loadLogs()
})

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
      <div class="header-left">
        <span class="page-title">操作日志</span>
        <span class="total-text">共 {{ total }} 条</span>
      </div>
      <el-button type="danger" text size="small" @click="handleClear">清空</el-button>
    </div>

    <div class="filter-bar">
      <el-select
        v-model="filterModule"
        placeholder="模块"
        clearable
        size="small"
        style="width: 140px"
      >
        <el-option v-for="m in moduleOptions" :key="m" :label="m" :value="m" />
      </el-select>
      <el-input v-model="searchText" placeholder="搜索..." clearable size="small" :prefix-icon="Search" style="width: 220px" />
    </div>

    <el-table :data="filteredLogs" v-loading="loading" style="width: 100%" size="small">
      <el-table-column prop="module" label="模块" width="110">
        <template #default="{ row }">
          <span class="cell-module">{{ row.module }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="action" label="操作" width="70">
        <template #default="{ row }">
          <span class="cell-action" :class="getActionType(row.action)">{{ row.action }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="target" label="目标" min-width="160" show-overflow-tooltip />
      <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
      <el-table-column prop="created_at" label="时间" width="160">
        <template #default="{ row }">
          <span class="cell-time">{{ formatTime(row.created_at) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination" v-if="total > pageSize">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="(p: number) => { page = p; loadLogs() }"
      />
    </div>
  </div>
</template>

<style scoped>
.logs-page {
  max-width: 1000px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--ops-text-primary);
}

.total-text {
  font-size: 12px;
  color: var(--ops-text-tertiary);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.cell-module {
  font-size: 12px;
  color: var(--ops-text-tertiary);
}

.cell-action {
  font-size: 12px;
  font-weight: 500;
}
.cell-action.success { color: #3fb950; }
.cell-action.warning { color: #d29922; }
.cell-action.danger { color: #f85149; }
.cell-action.info { color: var(--ops-text-tertiary); }

.cell-time {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
