<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchLogs, clearLogs, fetchLogModules, fetchLogOperators, exportLogs } from '../../api/admin'
import { Search, Download } from '@element-plus/icons-vue'
import { formatTime } from '../../utils/format'
import { useDebouncedSearch } from '../../composables/useDebouncedSearch'

const logs = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filterModule = ref('')
const filterOperator = ref('')
const filterStatus = ref('')
const dateRange = ref<[string, string] | null>(null)
const moduleOptions = ref<string[]>([])
const operatorOptions = ref<string[]>([])
// 详情抽屉
const drawerVisible = ref(false)
const detailRow = ref<any>(null)

// 防抖搜索：searchText 绑定输入框，searchKeyword 是防抖后的最终值（服务端过滤）
const { searchInput: searchText, search: searchKeyword } = useDebouncedSearch()

async function loadModules() {
  try {
    moduleOptions.value = await fetchLogModules()
  } catch {
    // 失败时使用空数组，模块筛选不可用但不影响列表
    moduleOptions.value = []
  }
}

async function loadOperators() {
  try {
    operatorOptions.value = await fetchLogOperators()
  } catch {
    // 失败时使用空数组，操作用户筛选不可用但不影响列表
    operatorOptions.value = []
  }
}

async function loadLogs() {
  loading.value = true
  try {
    const data = await fetchLogs({
      page: page.value,
      pageSize: pageSize.value,
      module: filterModule.value || undefined,
      operator: filterOperator.value || undefined,
      status: filterStatus.value || undefined,
      startDate: dateRange.value?.[0] || undefined,
      endDate: dateRange.value?.[1] || undefined,
      keyword: searchKeyword.value || undefined,
    })
    logs.value = data.rows
    total.value = data.total
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadModules()
  loadOperators()
  loadLogs()
})

watch(filterModule, () => {
  page.value = 1
  loadLogs()
})

watch(filterOperator, () => {
  page.value = 1
  loadLogs()
})

watch(filterStatus, () => {
  page.value = 1
  loadLogs()
})

watch(dateRange, () => {
  page.value = 1
  loadLogs()
})

watch(searchKeyword, () => {
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

function getActionType(action: string): string {
  if (action === '新增') return 'success'
  if (action === '修改') return 'warning'
  if (action === '删除') return 'danger'
  return 'info'
}

function handleDetail(row: any) {
  detailRow.value = row
  drawerVisible.value = true
}

function handleExport() {
  exportLogs({
    module: filterModule.value || undefined,
    operator: filterOperator.value || undefined,
    status: filterStatus.value || undefined,
    startDate: dateRange.value?.[0] || undefined,
    endDate: dateRange.value?.[1] || undefined,
    keyword: searchKeyword.value || undefined,
  })
}

// 详情字段展示（ip/ua 等可读化）
function detailItems(row: any) {
  return [
    { label: '模块', value: row.module },
    { label: '操作', value: row.action },
    { label: '操作用户', value: row.operator || '—' },
    { label: '目标', value: row.target || '—' },
    { label: '状态', value: row.status === 'fail' ? '失败' : '成功' },
    { label: '错误信息', value: row.error_message || '—' },
    { label: 'IP 地址', value: row.ip_address || '—' },
    { label: 'User-Agent', value: row.user_agent || '—' },
    { label: '请求方法', value: row.request_method || '—' },
    { label: '请求路径', value: row.request_path || '—' },
    { label: '耗时(ms)', value: row.duration_ms ?? '—' },
    { label: '时间', value: formatTime(row.created_at) },
  ]
}

function formatDetail(raw: string | null | undefined): string {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}
</script>

<template>
  <div class="logs-page">
    <div class="page-header">
      <div class="header-left">
        <span class="page-title">操作日志</span>
        <span class="total-text">共 {{ total }} 条</span>
      </div>
      <div class="header-actions">
        <el-button type="primary" text size="small" @click="handleExport">
          <el-icon><Download /></el-icon> 导出
        </el-button>
        <el-button type="danger" text size="small" @click="handleClear">清空全部（30 天自动清理）</el-button>
      </div>
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
      <el-select
        v-model="filterOperator"
        placeholder="操作用户"
        clearable
        size="small"
        style="width: 130px"
      >
        <el-option v-for="u in operatorOptions" :key="u" :label="u" :value="u" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" clearable size="small" style="width: 90px">
        <el-option label="成功" value="success" />
        <el-option label="失败" value="fail" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        size="small"
        style="width: 260px"
      />
      <el-input v-model="searchText" placeholder="搜索..." clearable size="small" :prefix-icon="Search" style="width: 220px" />
    </div>

    <el-table :data="logs" v-loading="loading" style="width: 100%" size="small" @row-click="handleDetail">
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
      <el-table-column label="状态" width="70">
        <template #default="{ row }">
          <el-tag :type="row.status === 'fail' ? 'danger' : 'success'" size="small">
            {{ row.status === 'fail' ? '失败' : '成功' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="operator" label="操作用户" width="90">
        <template #default="{ row }">
          <span class="cell-operator">{{ row.operator || '—' }}</span>
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

    <!-- 日志详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="操作日志详情" size="420px">
      <template v-if="detailRow">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item v-for="item in detailItems(detailRow)" :key="item.label" :label="item.label">
            {{ item.value }}
          </el-descriptions-item>
        </el-descriptions>
        <div class="detail-block">
          <div class="detail-title">详情内容</div>
          <pre class="detail-pre">{{ formatDetail(detailRow.detail) }}</pre>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.logs-page { width: 100%; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.header-left { display: flex; align-items: baseline; gap: 12px; }
.page-title { font-size: 16px; font-weight: 500; color: var(--ops-text-primary); }
.total-text { font-size: 12px; color: var(--ops-text-tertiary); }
.filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.cell-module { font-size: 12px; color: var(--ops-text-tertiary); }
.cell-operator { font-size: 12px; color: var(--ops-text-secondary); }
.cell-action { font-size: 12px; font-weight: 500; }
.cell-action.success { color: var(--ops-accent-green); }
.cell-action.warning { color: var(--ops-accent-yellow); }
.cell-action.danger { color: var(--ops-accent-red); }
.cell-action.info { color: var(--ops-text-tertiary); }
.cell-time { font-size: 12px; color: var(--ops-text-tertiary); font-variant-numeric: tabular-nums; }
.pagination { display: flex; justify-content: center; margin-top: 16px; }
.header-actions { display: flex; align-items: center; gap: 4px; }
.detail-block { margin-top: 20px; }
.detail-title { font-size: 13px; font-weight: 500; color: var(--ops-text-secondary); margin-bottom: 8px; }
.detail-pre {
  font-size: 12px;
  line-height: 1.6;
  color: var(--ops-text-secondary);
  background: var(--ops-bg-page);
  border: 1px solid var(--ops-border-card);
  border-radius: 6px;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
