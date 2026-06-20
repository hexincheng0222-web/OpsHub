<template>
  <div class="log-monitor-audit">
    <!-- 返回按钮 -->
    <div class="page-header">
      <BackButton to="/log-monitor" label="返回仪表盘" />
    </div>
    <!-- 筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filter" size="default">
        <el-form-item label="设备">
          <el-input v-model="filter.device" placeholder="设备 ID" clearable />
        </el-form-item>
        <el-form-item label="异常状态">
          <el-select v-model="filter.abnormal" placeholder="全部" clearable style="width: 120px">
            <el-option label="全部" value="" />
            <el-option label="异常" value="1" />
            <el-option label="正常" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="filter.start_date" type="datetime" placeholder="开始" style="width: 180px" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="filter.end_date" type="datetime" placeholder="结束" style="width: 180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon> 筛选
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="records" stripe v-loading="loading" size="default">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="device_name" label="设备" min-width="140">
          <template #default="{ row }">
            <div>
              <div style="font-weight: 500">{{ row.device_name }}</div>
              <div style="font-size: 12px; color: var(--el-text-color-secondary)">{{ row.device_id }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="log_count" label="日志数" width="70" align="center" />
        <el-table-column prop="llm_summary" label="LLM 摘要" min-width="250" show-overflow-tooltip />
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
        <el-table-column prop="created_at" label="时间" width="180" />
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="showDetail(row)">
              <el-icon><View /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="`审计详情 - ${detail.device_name} (#${detail.id})`" width="700px">
      <div class="detail-section">
        <div class="detail-label">LLM 摘要</div>
        <el-alert :title="detail.llm_summary || '(无摘要)'" :type="detail.has_abnormal ? 'error' : 'success'" :closable="false" />
      </div>
      <div class="detail-section">
        <div class="detail-label">原始日志（{{ detail.log_count }} 条）</div>
        <pre class="log-pre">{{ formattedLogs }}</pre>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, View } from '@element-plus/icons-vue'
import { getAuditList } from '../../api/log-monitor'
import BackButton from '../../components/BackButton.vue'

const filter = ref({ device: '', abnormal: '', start_date: '', end_date: '' })
const records = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<any>({})

const formattedLogs = computed(() => {
  try {
    const logs = JSON.parse(detail.value.raw_logs || '[]')
    return JSON.stringify(logs.slice(0, 100), null, 2)
  } catch {
    return detail.value.raw_logs || ''
  }
})

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filter.value.device) params.device = filter.value.device
    if (filter.value.abnormal) params.abnormal = filter.value.abnormal
    if (filter.value.start_date) params.start_date = new Date(filter.value.start_date).toISOString()
    if (filter.value.end_date) params.end_date = new Date(filter.value.end_date).toISOString()
    const res = await getAuditList(params)
    records.value = res.list
    total.value = res.total
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filter.value = { device: '', abnormal: '', start_date: '', end_date: '' }
  page.value = 1
  loadData()
}

function showDetail(row: any) {
  detail.value = row
  detailVisible.value = true
}

onMounted(loadData)
</script>

<style scoped>
.log-monitor-audit { padding: 0; }
.page-header { margin-bottom: 16px; }
.filter-card { margin-bottom: 16px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.detail-section { margin-bottom: 20px; }
.detail-label { font-weight: 500; margin-bottom: 8px; font-size: 13px; color: var(--el-text-color-secondary); }
.log-pre {
  background: var(--el-fill-color-darker);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  max-height: 400px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}
</style>
