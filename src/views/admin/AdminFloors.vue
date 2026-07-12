<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchDict, createDict, updateDict, deleteDict } from '../../api/admin'
import { Building, Printer as PrinterIcon } from '@element-plus/icons-vue'
import type { ColumnConfig } from '../../utils/admin-dict-config'

interface DictConfig {
  title: string
  columns: ColumnConfig[]
}

const tabs = [
  { key: 'device-floors', label: '设备楼层', icon: Building, dict: 'device-floors' },
  { key: 'printer-floors', label: '打印机楼层', icon: PrinterIcon, dict: 'printer-floors' },
] as const

const activeTab = ref<(typeof tabs)[number]['key']>('device-floors')
const dictKey = computed(() => tabs.find(t => t.key === activeTab.value)!.dict)

// 设备楼层和打印机楼层 schema 完全一致：name + sort_order
const floorConfig: DictConfig = {
  title: '楼层管理',
  columns: [
    { prop: 'name', label: '楼层名称', type: 'text', required: true },
    { prop: 'sort_order', label: '排序', type: 'number' },
  ],
}

const tableData = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formData = ref<Record<string, any>>({ id: null, name: '', sort_order: 0 })

async function loadData() {
  loading.value = true
  try {
    tableData.value = await fetchDict(dictKey.value)
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(activeTab, () => {
  formData.value = { id: null, name: '', sort_order: 0 }
  loadData()
})

const duplicateName = computed(() => {
  const name = formData.value.name?.trim()
  if (!name) return false
  return tableData.value.some(r => r.name === name && r.id !== formData.value.id)
})

function handleAdd() {
  isEdit.value = false
  formData.value = { id: null, name: '', sort_order: 0 }
  dialogVisible.value = true
}

function handleEdit(row: any) {
  isEdit.value = true
  formData.value = { ...row }
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除楼层「${row.name}」？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteDict(dictKey.value, row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}

async function handleSubmit() {
  if (!formData.value.name?.trim()) {
    ElMessage.warning('请输入楼层名称')
    return
  }
  if (duplicateName.value) {
    ElMessage.warning('楼层名称已存在')
    return
  }
  try {
    if (isEdit.value) {
      await updateDict(dictKey.value, formData.value.id, formData.value)
      ElMessage.success('修改成功')
    } else {
      await createDict(dictKey.value, formData.value)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  }
}
</script>

<template>
  <div class="floors-page">
    <div class="page-header">
      <span class="page-title">楼层管理</span>
    </div>

    <el-tabs v-model="activeTab" class="floor-tabs">
      <el-tab-pane v-for="tab in tabs" :key="tab.key" :name="tab.key">
        <template #label>
          <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
          {{ tab.label }}
        </template>

        <div class="toolbar">
          <el-button type="primary" size="small" @click="handleAdd">新增楼层</el-button>
          <span class="total-text">{{ tableData.length }} 条</span>
        </div>

        <el-table :data="tableData" v-loading="loading" size="small" style="width: 100%">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="name" label="楼层名称" min-width="160" />
          <el-table-column prop="sort_order" label="排序" width="100" align="center" />
          <el-table-column label="创建时间" width="160">
            <template #default="{ row }">
              <span class="cell-time">{{ row.created_at?.replace('T', ' ')?.slice(0, 16) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" text size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="danger" text size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑楼层' : '新增楼层'" width="420px" destroy-on-close>
      <el-form :model="formData" label-width="80px">
        <el-form-item label="楼层名称" required>
          <el-input v-model="formData.name" placeholder="如：3F、负二楼" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="formData.sort_order" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">{{ isEdit ? '保存' : '新增' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.floors-page { width: 100%; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 16px; font-weight: 500; color: var(--ops-text-primary); }
.floor-tabs :deep(.el-tabs__content) { padding-top: 16px; }
.tab-icon { margin-right: 4px; }
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.total-text { font-size: 12px; color: var(--ops-text-tertiary); }
.cell-time { font-size: 12px; color: var(--ops-text-tertiary); font-variant-numeric: tabular-nums; }
</style>
