<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchDict, createDict, updateDict, deleteDict } from '../../api/admin'
import { Search } from '@element-plus/icons-vue'

const route = useRoute()

interface ColumnConfig {
  prop: string
  label: string
  type: 'text' | 'number' | 'select' | 'color' | 'textarea'
  required?: boolean
  width?: number
  options?: { label: string; value: any }[]
}

const tableConfigs: Record<string, { title: string; columns: ColumnConfig[] }> = {
  'device-floors': {
    title: '楼层管理',
    columns: [
      { prop: 'name', label: '楼层名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'device-types': {
    title: '设备类型',
    columns: [
      { prop: 'key', label: '类型键名', type: 'text', required: true },
      { prop: 'name', label: '显示名称', type: 'text', required: true },
      { prop: 'abbr', label: '缩写', type: 'text', required: true },
      { prop: 'icon', label: '图标', type: 'text' },
      { prop: 'color', label: '颜色', type: 'color' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'device-models': {
    title: '设备型号库',
    columns: [
      { prop: 'name', label: '型号名称', type: 'text', required: true },
      { prop: 'type_key', label: '设备类型', type: 'select', required: true, options: [] },
      { prop: 'manufacturer', label: '厂商', type: 'text' },
      { prop: 'u_size', label: 'U 数', type: 'number' },
      { prop: 'ports', label: '端口数', type: 'number' },
      { prop: 'power_watts', label: '功耗(W)', type: 'number' },
      { prop: 'description', label: '描述', type: 'textarea' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'printer-floors': {
    title: '楼层管理',
    columns: [
      { prop: 'name', label: '楼层名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'printer-brands': {
    title: '品牌管理',
    columns: [
      { prop: 'name', label: '品牌名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'printer-models': {
    title: '型号管理',
    columns: [
      { prop: 'brand_id', label: '所属品牌', type: 'select', required: true, options: [] },
      { prop: 'name', label: '型号名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'toner-models': {
    title: '墨粉型号',
    columns: [
      { prop: 'name', label: '墨粉型号', type: 'text', required: true },
      { prop: 'brand_id', label: '所属品牌', type: 'select', required: true, options: [] },
      { prop: 'compatible', label: '适用机型', type: 'textarea' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'service-categories': {
    title: '服务分类',
    columns: [
      { prop: 'name', label: '分类名称', type: 'text', required: true },
      { prop: 'icon', label: '图标', type: 'text' },
      { prop: 'color', label: '颜色', type: 'color' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'service-hosts': {
    title: '服务主机',
    columns: [
      { prop: 'name', label: '主机名称', type: 'text', required: true },
      { prop: 'ip', label: 'IP 地址', type: 'text' },
      { prop: 'os', label: '操作系统', type: 'text' },
      { prop: 'description', label: '描述', type: 'textarea' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'procurement-departments': {
    title: '采购部门',
    columns: [
      { prop: 'name', label: '部门名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'procurement-handlers': {
    title: '采购经手人',
    columns: [
      { prop: 'name', label: '姓名', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'phone-brands': {
    title: '手机品牌',
    columns: [
      { prop: 'name', label: '品牌名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'phone-models': {
    title: '手机型号',
    columns: [
      { prop: 'brand_id', label: '所属品牌', type: 'select', required: true, options: [] },
      { prop: 'name', label: '型号名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'computer-purchase-models': {
    title: '电脑采购型号',
    columns: [
      { prop: 'name', label: '采购型号', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'computer-device-models': {
    title: '电脑设备型号',
    columns: [
      { prop: 'purchase_model_id', label: '所属采购型号', type: 'select', required: true, options: [] },
      { prop: 'name', label: '设备型号', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
}

const dictKey = computed(() => route.meta.dict as string)
const config = computed(() => tableConfigs[dictKey.value] || { title: '', columns: [] })

const tableData = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formData = ref<Record<string, any>>({})
const formRef = ref()
const brandOptions = ref<{ label: string; value: number }[]>([])
const searchText = ref('')
const selectedBrand = ref<number | null>(null)

const formRules = computed(() => {
  const rules: Record<string, any[]> = {}
  for (const col of config.value.columns) {
    if (col.required) {
      rules[col.prop] = [{ required: true, message: `请输入${col.label}`, trigger: col.type === 'select' ? 'change' : 'blur' }]
    }
  }
  return rules
})

const filteredData = computed(() => {
  let data = tableData.value
  // 品牌筛选（手机型号页面）
  if (dictKey.value === 'phone-models' && selectedBrand.value !== null) {
    data = data.filter(row => row.brand_id === selectedBrand.value)
  }
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    data = data.filter(row => {
      return Object.values(row).some(v =>
        String(v).toLowerCase().includes(q)
      )
    })
  }
  return data
})

// 手机型号页面：品牌卡片数据
const brandCards = computed(() => {
  if (dictKey.value !== 'phone-models') return []
  const counts: Record<number, number> = {}
  tableData.value.forEach(row => {
    counts[row.brand_id] = (counts[row.brand_id] || 0) + 1
  })
  return brandOptions.value.map(b => ({
    id: b.value,
    name: b.label,
    count: counts[b.value] || 0,
  }))
})

function selectBrand(id: number | null) {
  selectedBrand.value = selectedBrand.value === id ? null : id
}

async function loadData() {
  loading.value = true
  try {
    tableData.value = await fetchDict(dictKey.value)
    if (dictKey.value === 'printer-models') {
      const brands = await fetchDict('printer-brands')
      brandOptions.value = brands.map((b: any) => ({ label: b.name, value: b.id }))
      const brandCol = config.value.columns.find(c => c.prop === 'brand_id')
      if (brandCol) brandCol.options = brandOptions.value
    }
    if (dictKey.value === 'device-models') {
      const types = await fetchDict('device-types')
      const typeCol = config.value.columns.find(c => c.prop === 'type_key')
      if (typeCol) typeCol.options = types.map((t: any) => ({ label: t.name, value: t.key }))
    }
    if (dictKey.value === 'toner-models') {
      const brands = await fetchDict('printer-brands')
      brandOptions.value = brands.map((b: any) => ({ label: b.name, value: b.id }))
      const brandCol = config.value.columns.find(c => c.prop === 'brand_id')
      if (brandCol) brandCol.options = brandOptions.value
    }
    if (dictKey.value === 'phone-models') {
      const brands = await fetchDict('phone-brands')
      brandOptions.value = brands.map((b: any) => ({ label: b.name, value: b.id }))
      const brandCol = config.value.columns.find(c => c.prop === 'brand_id')
      if (brandCol) brandCol.options = brandOptions.value
    }
    if (dictKey.value === 'computer-device-models') {
      const models = await fetchDict('computer-purchase-models')
      const pmCol = config.value.columns.find(c => c.prop === 'purchase_model_id')
      if (pmCol) pmCol.options = models.map((m: any) => ({ label: m.name, value: m.id }))
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(dictKey, () => {
  selectedBrand.value = null
  searchText.value = ''
  loadData()
})

function handleAdd() {
  isEdit.value = false
  formData.value = {}
  config.value.columns.forEach(col => {
    formData.value[col.prop] = col.type === 'number' ? 0 : ''
  })
  dialogVisible.value = true
}

function handleEdit(row: any) {
  isEdit.value = true
  formData.value = { ...row }
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」？`, '确认删除', {
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
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
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

function getColWidth(col: ColumnConfig): number | undefined {
  if (col.prop === 'sort_order') return 80
  if (col.prop === 'id') return 70
  if (col.type === 'color') return 100
  if (col.prop === 'u_size' || col.prop === 'ports' || col.prop === 'power_watts') return 90
  if (col.prop === 'brand_id') return 130
  return undefined
}

function getBrandName(brandId: number): string {
  const opt = brandOptions.value.find(o => o.value === brandId)
  return opt ? opt.label : String(brandId)
}

function getTypeName(typeKey: string): string {
  const typeCol = config.value.columns.find(c => c.prop === 'type_key')
  const opt = typeCol?.options?.find(o => o.value === typeKey)
  return opt ? opt.label : typeKey
}
</script>

<template>
  <div class="dict-page">
    <div class="page-header">
      <div class="header-left">
        <span class="page-title">{{ config.title }}</span>
        <span class="total-text">{{ filteredData.length }} 条</span>
      </div>
      <div class="header-actions">
        <el-input v-model="searchText" placeholder="搜索..." clearable size="small" :prefix-icon="Search" style="width: 200px" />
        <el-button type="primary" size="small" @click="handleAdd">新增</el-button>
      </div>
    </div>

    <!-- 手机型号品牌卡片 -->
    <div v-if="dictKey === 'phone-models' && brandCards.length" class="brand-cards">
      <div
        v-for="brand in brandCards"
        :key="brand.id"
        class="brand-card"
        :class="{ active: selectedBrand === brand.id }"
        @click="selectBrand(brand.id)"
      >
        <span class="brand-name">{{ brand.name }}</span>
        <span class="brand-count">{{ brand.count }}</span>
      </div>
    </div>

    <el-table
      :data="filteredData"
      v-loading="loading"
      style="width: 100%"
      size="small"
    >
      <el-table-column prop="id" label="ID" width="60" />

      <template v-for="col in config.columns" :key="col.prop">
        <el-table-column
          v-if="col.prop === 'brand_id'"
          label="所属品牌"
          :width="130"
        >
          <template #default="{ row }">
            <span class="cell-text">{{ getBrandName(row.brand_id) }}</span>
          </template>
        </el-table-column>

        <el-table-column
          v-else-if="col.prop === 'type_key'"
          label="设备类型"
          :width="110"
        >
          <template #default="{ row }">
            <span class="cell-text">{{ getTypeName(row.type_key) }}</span>
          </template>
        </el-table-column>

        <el-table-column
          v-else-if="col.type === 'color'"
          :prop="col.prop"
          :label="col.label"
          :width="getColWidth(col)"
        >
          <template #default="{ row }">
            <div class="color-preview">
              <span class="color-dot" :style="{ background: row[col.prop] }"></span>
              <span class="cell-text">{{ row[col.prop] }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          v-else-if="col.type === 'textarea'"
          :prop="col.prop"
          :label="col.label"
          show-overflow-tooltip
        />

        <el-table-column
          v-else
          :prop="col.prop"
          :label="col.label"
          :width="getColWidth(col)"
        />
      </template>

      <el-table-column label="创建时间" width="150" prop="created_at">
        <template #default="{ row }">
          <span class="cell-time">{{ row.created_at?.replace('T', ' ')?.slice(0, 16) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" text size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" text size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑' : '新增'"
      width="480px"
      destroy-on-close
    >
      <el-form :model="formData" :rules="formRules" label-width="90px" ref="formRef" size="default">
        <template v-for="col in config.columns" :key="col.prop">
          <el-form-item v-if="col.type === 'color'" :label="col.label">
            <el-color-picker v-model="formData[col.prop]" show-alpha />
          </el-form-item>

          <el-form-item v-else-if="col.type === 'select'" :label="col.label" :required="col.required">
            <el-select v-model="formData[col.prop]" placeholder="请选择" style="width: 100%">
              <el-option
                v-for="opt in col.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item v-else-if="col.type === 'textarea'" :label="col.label">
            <el-input v-model="formData[col.prop]" type="textarea" :rows="3" />
          </el-form-item>

          <el-form-item v-else-if="col.type === 'number'" :label="col.label">
            <el-input-number v-model="formData[col.prop]" :min="0" controls-position="right" style="width: 100%" />
          </el-form-item>

          <el-form-item v-else :label="col.label" :required="col.required">
            <el-input v-model="formData[col.prop]" :placeholder="`请输入${col.label}`" />
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <el-button size="default" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" size="default" @click="handleSubmit">{{ isEdit ? '保存' : '新增' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dict-page {
  width: 100%;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cell-text {
  font-size: 13px;
  color: var(--ops-text-secondary);
}

.cell-time {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.color-preview {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  display: inline-block;
  border: 1px solid var(--ops-border-card);
}

/* 品牌卡片 */
.brand-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.brand-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.brand-card:hover {
  border-color: var(--ops-accent-blue);
}

.brand-card.active {
  background: rgba(88, 166, 255, 0.08);
  border-color: var(--ops-accent-blue);
}

.brand-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ops-text-primary);
}

.brand-count {
  font-size: 11px;
  color: var(--ops-text-tertiary);
  background: var(--ops-bg-page);
  padding: 1px 6px;
  border-radius: 10px;
}
</style>
