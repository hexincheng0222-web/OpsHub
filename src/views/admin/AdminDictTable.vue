<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchDict, createDict, updateDict, deleteDict } from '../../api/admin'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'

const route = useRoute()

// 表配置
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

// 加载数据
async function loadData() {
  loading.value = true
  try {
    tableData.value = await fetchDict(dictKey.value)
    // 如果是 printer-models，加载品牌选项
    if (dictKey.value === 'printer-models') {
      const brands = await fetchDict('printer-brands')
      brandOptions.value = brands.map((b: any) => ({ label: b.name, value: b.id }))
      const brandCol = config.value.columns.find(c => c.prop === 'brand_id')
      if (brandCol) brandCol.options = brandOptions.value
    }
    // 如果是 device-models，加载设备类型选项
    if (dictKey.value === 'device-models') {
      const types = await fetchDict('device-types')
      const typeCol = config.value.columns.find(c => c.prop === 'type_key')
      if (typeCol) typeCol.options = types.map((t: any) => ({ label: t.name, value: t.key }))
    }
    // 如果是 toner-models，加载品牌选项
    if (dictKey.value === 'toner-models') {
      const brands = await fetchDict('printer-brands')
      brandOptions.value = brands.map((b: any) => ({ label: b.name, value: b.id }))
      const brandCol = config.value.columns.find(c => c.prop === 'brand_id')
      if (brandCol) brandCol.options = brandOptions.value
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(dictKey, loadData)

// 新增
function handleAdd() {
  isEdit.value = false
  formData.value = {}
  config.value.columns.forEach(col => {
    formData.value[col.prop] = col.type === 'number' ? 0 : ''
  })
  dialogVisible.value = true
}

// 编辑
function handleEdit(row: any) {
  isEdit.value = true
  formData.value = { ...row }
  dialogVisible.value = true
}

// 删除
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

// 提交
async function handleSubmit() {
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

// 表格列宽
function getColWidth(col: ColumnConfig): number | undefined {
  if (col.prop === 'sort_order') return 80
  if (col.prop === 'id') return 70
  if (col.type === 'color') return 100
  if (col.prop === 'u_size' || col.prop === 'ports' || col.prop === 'power_watts') return 90
  if (col.prop === 'brand_id') return 130
  return undefined
}

// 显示品牌名
function getBrandName(brandId: number): string {
  const opt = brandOptions.value.find(o => o.value === brandId)
  return opt ? opt.label : String(brandId)
}

// 显示设备类型名
function getTypeName(typeKey: string): string {
  const typeCol = config.value.columns.find(c => c.prop === 'type_key')
  const opt = typeCol?.options?.find(o => o.value === typeKey)
  return opt ? opt.label : typeKey
}
</script>

<template>
  <div class="dict-page">
    <div class="page-header">
      <h2 class="page-title">{{ config.title }}</h2>
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" style="width: 100%" stripe>
      <el-table-column prop="id" label="ID" width="70" />

      <template v-for="col in config.columns" :key="col.prop">
        <!-- 品牌列（printer-models 特殊处理）-->
        <el-table-column
          v-if="col.prop === 'brand_id'"
          label="所属品牌"
          :width="130"
        >
          <template #default="{ row }">
            {{ getBrandName(row.brand_id) }}
          </template>
        </el-table-column>

        <!-- 设备类型列（device-models 特殊处理）-->
        <el-table-column
          v-else-if="col.prop === 'type_key'"
          label="设备类型"
          :width="110"
        >
          <template #default="{ row }">
            {{ getTypeName(row.type_key) }}
          </template>
        </el-table-column>

        <!-- 颜色列 -->
        <el-table-column
          v-else-if="col.type === 'color'"
          :prop="col.prop"
          :label="col.label"
          :width="getColWidth(col)"
        >
          <template #default="{ row }">
            <div class="color-preview">
              <span class="color-dot" :style="{ background: row[col.prop] }"></span>
              <span>{{ row[col.prop] }}</span>
            </div>
          </template>
        </el-table-column>

        <!-- 文本区域列 -->
        <el-table-column
          v-else-if="col.type === 'textarea'"
          :prop="col.prop"
          :label="col.label"
          show-overflow-tooltip
        />

        <!-- 普通列 -->
        <el-table-column
          v-else
          :prop="col.prop"
          :label="col.label"
          :width="getColWidth(col)"
        />
      </template>

      <el-table-column label="创建时间" width="170" prop="created_at" />

      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" text size="small" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" text size="small" :icon="Delete" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑' : '新增'"
      width="500px"
      destroy-on-close
    >
      <el-form :model="formData" label-width="100px" ref="formRef">
        <template v-for="col in config.columns" :key="col.prop">
          <!-- 颜色选择器 -->
          <el-form-item v-if="col.type === 'color'" :label="col.label">
            <el-color-picker v-model="formData[col.prop]" show-alpha />
          </el-form-item>

          <!-- 下拉选择 -->
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

          <!-- 文本区域 -->
          <el-form-item v-else-if="col.type === 'textarea'" :label="col.label">
            <el-input v-model="formData[col.prop]" type="textarea" :rows="3" />
          </el-form-item>

          <!-- 数字输入 -->
          <el-form-item v-else-if="col.type === 'number'" :label="col.label">
            <el-input-number v-model="formData[col.prop]" :min="0" controls-position="right" style="width: 100%" />
          </el-form-item>

          <!-- 文本输入 -->
          <el-form-item v-else :label="col.label" :required="col.required">
            <el-input v-model="formData[col.prop]" :placeholder="`请输入${col.label}`" />
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">{{ isEdit ? '保存' : '新增' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dict-page {
  max-width: 1100px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--ops-text-primary);
  margin: 0;
}

.color-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: inline-block;
  border: 1px solid var(--ops-border-card);
}
</style>
