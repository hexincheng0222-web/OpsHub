<template>
  <div class="proc-page">
    <!-- 顶部导航栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="$router.push('/')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回</span>
      </button>
      <h3>手机采购登记表 <span class="top-count">{{ store.phones.length }} 台</span></h3>
      <div class="top-actions">
        <el-dropdown @command="handleTopAction" trigger="click">
          <el-button size="small">
            操作 <el-icon><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export">
                <el-icon><download /></el-icon> 导出 CSV
              </el-dropdown-item>
              <el-dropdown-item command="exportSelected" :disabled="!selectedRows.length">
                <el-icon><download /></el-icon> 导出选中 ({{ selectedRows.length }})
              </el-dropdown-item>
              <el-dropdown-item command="import" divided>
                <el-icon><upload /></el-icon> 导入 CSV
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" size="small" @click="openAddDialog">
          <el-icon><Plus /></el-icon> 添加
        </el-button>
      </div>
    </div>

    <!-- 搜索/筛选 -->
    <div class="filter-bar">
      <el-input v-model="searchInput" placeholder="搜索品牌/型号/资产编号/IMEI/领用人..." clearable style="width:300px">
        <template #prefix>
          <el-icon><search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="filterDepartment" placeholder="全部部门" clearable style="width:140px">
        <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
      </el-select>
      <el-select v-model="filterPurchaseType" placeholder="换/新购" clearable style="width:100px">
        <el-option label="新购" value="新购" />
        <el-option label="换" value="换" />
      </el-select>
      <el-select v-model="filterBrand" placeholder="全部品牌" clearable style="width:120px">
        <el-option v-for="b in brands" :key="b" :label="b" :value="b" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width:280px"
      />
      <el-button size="small" @click="resetFilters">重置</el-button>
      <span v-if="filteredCount !== store.phones.length" class="filter-count">筛选 {{ filteredCount }} / {{ store.phones.length }} 条</span>
    </div>

    <!-- 表格 -->
    <el-table
      ref="tableRef"
      :data="pagedData"
      stripe border
      style="width:100%"
      @row-click="openDrawer"
      @selection-change="handleSelectionChange"
      highlight-current-row
      :empty-text="emptyText"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column prop="assetNumber" label="资产编号" width="140" fixed />
      <el-table-column prop="brand" label="品牌" width="110" />
      <el-table-column prop="model" label="型号" min-width="120" show-overflow-tooltip />
      <el-table-column prop="imei" label="IMEI/MEID" width="150" show-overflow-tooltip />
      <el-table-column prop="department" label="领用部门" width="130" />
      <el-table-column prop="recipient" label="领用人" width="80" />
      <el-table-column prop="arrivalDate" label="到货时间" width="110" />
      <el-table-column prop="pickupDate" label="领用时间" width="110" />
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <div class="action-btns">
            <el-button size="small" text @click.stop="openEditDialog(row)">编辑</el-button>
            <el-button size="small" text type="danger" @click.stop="handleDelete(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 批量操作栏 -->
    <div v-if="selectedRows.length" class="batch-bar">
      <span class="batch-count">已选 {{ selectedRows.length }} 项</span>
      <el-button size="small" type="danger" plain @click="batchDelete">
        <el-icon><delete /></el-icon> 批量删除
      </el-button>
      <el-button size="small" @click="batchExport">导出选中</el-button>
      <el-button size="small" text @click="clearSelection">取消选择</el-button>
    </div>

    <!-- 分页 -->
    <div v-if="filteredCount > 0" class="pagination">
      <el-pagination v-model:current-page="page" v-model:pageSize="pageSize" :page-sizes="[10,20,50]"
        :total="filteredCount" layout="total, sizes, prev, pager, next" small />
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="手机采购详情" size="520px">
      <template v-if="selectedRow">
        <div class="drawer-section">
          <div class="drawer-section-title">📱 设备信息</div>
          <div class="drawer-field"><span class="field-label">资产编号</span><span class="field-value mono field-highlight">{{ selectedRow.assetNumber }}</span></div>
          <div class="drawer-field"><span class="field-label">品牌</span><span class="field-value">{{ selectedRow.brand }}</span></div>
          <div class="drawer-field"><span class="field-label">型号</span><span class="field-value field-highlight">{{ selectedRow.model }}</span></div>
          <div class="drawer-field"><span class="field-label">Part No</span><span class="field-value mono">{{ selectedRow.partNo || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">Serial No</span><span class="field-value mono">{{ selectedRow.serialNo || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">IMEI/MEID</span><span class="field-value mono">{{ selectedRow.imei || '—' }}</span></div>
        </div>
        <div class="drawer-section">
          <div class="drawer-section-title">👤 人员信息</div>
          <div class="drawer-field"><span class="field-label">领用部门</span><span class="field-value">{{ selectedRow.department }}</span></div>
          <div class="drawer-field"><span class="field-label">领用人</span><span class="field-value field-highlight">{{ selectedRow.recipient }}</span></div>
          <div class="drawer-field"><span class="field-label">经手人</span><span class="field-value">{{ selectedRow.handler || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">原手机归属</span><span class="field-value">{{ selectedRow.originalOwner || '—' }}</span></div>
        </div>
        <div class="drawer-section">
          <div class="drawer-section-title">📋 采购与审批</div>
          <div class="drawer-field"><span class="field-label">换/新购</span><span class="field-value">{{ selectedRow.purchaseType }}</span></div>
          <div class="drawer-field"><span class="field-label">资产关联</span><span class="field-value mono">{{ selectedRow.assetLink || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">钉钉流程创建人</span><span class="field-value">{{ selectedRow.dingtalkCreator || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">钉钉流程</span><span class="field-value mono">{{ selectedRow.dingtalkFlow || '—' }}</span></div>
        </div>
        <div class="drawer-section">
          <div class="drawer-section-title">📅 时间节点</div>
          <div class="drawer-field"><span class="field-label">到货时间</span><span class="field-value">{{ selectedRow.arrivalDate || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">领用时间</span><span class="field-value">{{ selectedRow.pickupDate || '—' }}</span></div>
        </div>
        <div class="drawer-section" v-if="selectedRow.notes">
          <div class="drawer-section-title">📝 备注</div>
          <div class="drawer-field"><span class="field-value">{{ selectedRow.notes }}</span></div>
        </div>
      </template>
      <template #footer>
        <el-button type="danger" plain @click="handleDelete(selectedRow)">删除</el-button>
        <div style="flex:1" />
        <el-button @click="drawerVisible = false">关闭</el-button>
        <el-button type="primary" @click="openEditDialog(selectedRow)">编辑</el-button>
      </template>
    </el-drawer>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑手机采购' : '添加手机采购'" width="600px" destroy-on-close :before-close="onDialogClose">
      <el-form :model="form" label-width="130px" :rules="rules" ref="formRef">
        <!-- 设备信息 -->
        <div class="form-section-title">📱 设备信息</div>
        <el-form-item label="品牌" prop="brand">
          <el-select v-model="form.brand" filterable placeholder="请选择品牌" style="width:100%" @change="form.model = ''">
            <el-option v-for="b in brands" :key="b" :label="b" :value="b" />
          </el-select>
        </el-form-item>
        <el-form-item label="型号" prop="model">
          <el-select v-model="form.model" filterable placeholder="请先选择品牌" :disabled="!form.brand" style="width:100%">
            <el-option v-for="m in modelOptions" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="资产编号"><el-input v-model="form.assetNumber" placeholder="留空自动生成" /></el-form-item>
        <el-form-item label="Part No"><el-input v-model="form.partNo" placeholder="零件编号" /></el-form-item>
        <el-form-item label="Serial No"><el-input v-model="form.serialNo" placeholder="序列号" /></el-form-item>
        <el-form-item label="IMEI/MEID"><el-input v-model="form.imei" placeholder="15位IMEI" /></el-form-item>

        <!-- 人员信息 -->
        <div class="form-section-title">👤 人员信息</div>
        <el-form-item label="领用部门" prop="department">
          <el-select v-model="form.department" filterable allow-create placeholder="请选择部门" style="width:100%">
            <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="领用人" prop="recipient"><el-input v-model="form.recipient" /></el-form-item>
        <el-form-item label="经手人">
          <el-select v-model="form.handler" filterable allow-create placeholder="请选择经手人" style="width:100%">
            <el-option v-for="h in handlers" :key="h" :label="h" :value="h" />
          </el-select>
        </el-form-item>
        <el-form-item label="原手机归属"><el-input v-model="form.originalOwner" placeholder="换机时填写" /></el-form-item>

        <!-- 采购与审批 -->
        <div class="form-section-title">📋 采购与审批</div>
        <el-form-item label="换/新购" prop="purchaseType">
          <el-radio-group v-model="form.purchaseType">
            <el-radio value="新购">新购</el-radio>
            <el-radio value="换">换</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="资产关联"><el-input v-model="form.assetLink" placeholder="关联电脑资产编号" /></el-form-item>
        <el-form-item label="钉钉流程创建人"><el-input v-model="form.dingtalkCreator" /></el-form-item>
        <el-form-item label="钉钉流程"><el-input v-model="form.dingtalkFlow" placeholder="钉钉流程编号" /></el-form-item>

        <!-- 时间与其他 -->
        <div class="form-section-title">📅 时间与其他</div>
        <el-form-item label="到货时间"><el-date-picker v-model="form.arrivalDate" type="date" value-format="YYYY-MM-DD" format="YYYY年MM月DD日" style="width:100%" /></el-form-item>
        <el-form-item label="领用时间"><el-date-picker v-model="form.pickupDate" type="date" value-format="YYYY-MM-DD" format="YYYY年MM月DD日" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" placeholder="备注信息" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 导入 -->
    <input ref="fileInput" type="file" accept=".csv" style="display:none" @change="handleImport" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { usePhoneProcurementStore } from '../stores/procurement'
import type { PhoneProcurement } from '../stores/procurement'
import { Plus, Search, ArrowDown, Download, Upload, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchDict } from '../api/admin'
import { downloadCsv, escapeCsvField } from '../utils/csv'

const store = usePhoneProcurementStore()

// 字典数据
const departmentOptions = ref<string[]>([])
const handlerOptions = ref<string[]>([])
const phoneBrandOptions = ref<string[]>([])
const phoneModelMap = ref<Record<string, string[]>>({})

onMounted(async () => {
  store.loadPhones()
  try {
    const [depts, handlers, brands, models] = await Promise.all([
      fetchDict('procurement-departments'),
      fetchDict('procurement-handlers'),
      fetchDict('phone-brands'),
      fetchDict('phone-models'),
    ])
    departmentOptions.value = depts.map((d: any) => d.name)
    handlerOptions.value = handlers.map((h: any) => h.name)
    phoneBrandOptions.value = brands.map((b: any) => b.name)
    // 构建品牌→型号映射
    const map: Record<string, string[]> = {}
    for (const brand of brands) {
      const ms = models.filter((m: any) => m.brand_id === brand.id).map((m: any) => m.name)
      map[brand.name] = ms
    }
    phoneModelMap.value = map
  } catch (e) {
    console.error('加载字典数据失败:', e)
  }
})
const tableRef = ref()
const fileInput = ref<HTMLInputElement>()
const formRef = ref()
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const drawerVisible = ref(false)
const selectedRow = ref<PhoneProcurement | null>(null)
const selectedRows = ref<PhoneProcurement[]>([])
const search = ref('')
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { search.value = v }, 300)
})
const filterDepartment = ref('')
const filterPurchaseType = ref('')
const filterBrand = ref('')
const dateRange = ref<[string, string] | null>(null)
const page = ref(1)
const pageSize = ref(10)

// 筛选条件变化时重置分页
watch([search, filterDepartment, filterPurchaseType, filterBrand, dateRange], () => { page.value = 1 })

const form = reactive({
  assetNumber: '', partNo: '', serialNo: '', imei: '',
  arrivalDate: '', pickupDate: '', brand: '', model: '',
  assetLink: '', department: '', handler: '', recipient: '',
  dingtalkCreator: '', purchaseType: '新购', dingtalkFlow: '',
  originalOwner: '', notes: '',
})

const rules = {
  brand: [{ required: true, message: '请输入品牌', trigger: 'blur' }],
  model: [{ required: true, message: '请输入型号', trigger: 'blur' }],
  department: [{ required: true, message: '请输入领用部门', trigger: 'blur' }],
  recipient: [{ required: true, message: '请输入领用人', trigger: 'blur' }],
  imei: [{ pattern: /^\d{15}$/, message: 'IMEI 必须为 15 位数字', trigger: 'blur' }],
}

// ===== 筛选相关 =====
function resetFilters() {
  searchInput.value = ''
  search.value = ''
  filterDepartment.value = ''
  filterPurchaseType.value = ''
  filterBrand.value = ''
  dateRange.value = null
  page.value = 1
}

const departments = computed(() => departmentOptions.value.length ? departmentOptions.value : [...new Set(store.phones.map(p => p.department))].sort())
const brands = computed(() => phoneBrandOptions.value.length ? phoneBrandOptions.value : [...new Set(store.phones.map(p => p.brand))].sort())
const handlers = computed(() => handlerOptions.value.length ? handlerOptions.value : [...new Set(store.phones.map(p => p.handler).filter(Boolean))].sort())

// 品牌 → 型号映射
const phoneModels = computed(() => {
  // 优先用字典数据
  if (Object.keys(phoneModelMap.value).length) return phoneModelMap.value
  // fallback: 从已有数据中补充
  const map: Record<string, string[]> = {}
  for (const p of store.phones) {
    if (p.brand && p.model) {
      if (!map[p.brand]) map[p.brand] = []
      if (!map[p.brand].includes(p.model)) map[p.brand].push(p.model)
    }
  }
  return map
})
const modelOptions = computed(() => {
  if (!form.brand) return []
  return (phoneModels.value[form.brand] || []).sort()
})

const filteredData = computed(() => {
  let data = store.phones
  if (filterDepartment.value) data = data.filter(p => p.department === filterDepartment.value)
  if (filterPurchaseType.value) data = data.filter(p => p.purchaseType === filterPurchaseType.value)
  if (filterBrand.value) data = data.filter(p => p.brand === filterBrand.value)
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    const [start, end] = dateRange.value
    data = data.filter(p => p.arrivalDate && p.arrivalDate >= start && p.arrivalDate <= end)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    data = data.filter(p =>
      p.brand.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q) ||
      p.recipient.toLowerCase().includes(q) ||
      p.imei.toLowerCase().includes(q) ||
      p.assetNumber.toLowerCase().includes(q) ||
      p.partNo.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q)
    )
  }
  return data.sort((a, b) => (b.arrivalDate || '').localeCompare(a.arrivalDate || ''))
})

const filteredCount = computed(() => filteredData.value.length)

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredData.value.slice(start, start + pageSize.value)
})

const emptyText = computed(() => {
  if (store.phones.length === 0) return '暂无采购记录'
  if (filteredData.value.length === 0) return '未找到匹配的记录，请调整筛选条件'
  return '暂无数据'
})

// ===== 操作函数 =====
function handleSelectionChange(rows: PhoneProcurement[]) {
  selectedRows.value = rows
}

function clearSelection() {
  tableRef.value?.clearSelection()
}

function openDrawer(row: PhoneProcurement) {
  selectedRow.value = row
  drawerVisible.value = true
}

function resetForm() {
  Object.assign(form, {
    assetNumber: '', partNo: '', serialNo: '', imei: '',
    arrivalDate: '', pickupDate: '', brand: '', model: '',
    assetLink: '', department: '', handler: '', recipient: '',
    dingtalkCreator: '', purchaseType: '新购', dingtalkFlow: '',
    originalOwner: '', notes: '',
  })
}

function openAddDialog() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

// 弹窗关闭前确认
const formDirty = computed(() => form.brand || form.model || form.department || form.recipient || form.imei || form.serialNo)
function onDialogClose(done: () => void) {
  if (!editingId.value && formDirty.value) {
    ElMessageBox.confirm('表单已填写内容，确定关闭？', '提示', { type: 'warning' })
      .then(() => done())
      .catch(() => {})
  } else {
    done()
  }
}

function openEditDialog(row: PhoneProcurement | null) {
  if (!row) return
  editingId.value = row.id
  Object.assign(form, { ...row })
  dialogVisible.value = true
  drawerVisible.value = false
}

async function handleSave() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const data = { ...form }
    if (editingId.value) {
      await store.updatePhone(editingId.value, data)
      ElMessage.success('修改成功')
    } else {
      await store.addPhone(data as Omit<PhoneProcurement, 'id'>)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    saving.value = false
  }
}

function handleDelete(row: PhoneProcurement) {
  ElMessageBox.confirm(`确定删除「${row.brand} ${row.model}」（${row.assetNumber}）吗？`, '确认删除', { type: 'warning' })
    .then(async () => { await store.deletePhone(row.id); ElMessage.success('删除成功') })
    .catch(() => {})
}

function handleTopAction(command: string) {
  if (command === 'export') exportCSV()
  else if (command === 'exportSelected') batchExport()
  else if (command === 'import') importCSV()
}

// ===== 导出 =====
function exportCSV() {
  const header = ['资产编号','Part No','Serial No','IMEI/MEID','到货时间','领用时间','品牌','型号','资产关联','领用部门','经手人','领用人','钉钉流程创建人','换/新购','钉钉流程','原手机归属','备注'].join(',')
  const rows = store.phones.map(p =>
    [p.assetNumber, p.partNo, p.serialNo, p.imei, p.arrivalDate, p.pickupDate, p.brand, p.model, p.assetLink, p.department, p.handler, p.recipient, p.dingtalkCreator, p.purchaseType, p.dingtalkFlow, p.originalOwner, p.notes].map(escapeCsvField).join(',')
  )
  downloadCsv(header, rows, '手机采购登记表')
}

function batchExport() {
  if (!selectedRows.value.length) { ElMessage.warning('请先选择要导出的记录'); return }
  const header = ['资产编号','Part No','Serial No','IMEI/MEID','到货时间','领用时间','品牌','型号','资产关联','领用部门','经手人','领用人','钉钉流程创建人','换/新购','钉钉流程','原手机归属','备注'].join(',')
  const rows = selectedRows.value.map(p =>
    [p.assetNumber, p.partNo, p.serialNo, p.imei, p.arrivalDate, p.pickupDate, p.brand, p.model, p.assetLink, p.department, p.handler, p.recipient, p.dingtalkCreator, p.purchaseType, p.dingtalkFlow, p.originalOwner, p.notes].map(escapeCsvField).join(',')
  )
  downloadCsv(header, rows, '手机采购选中记录')
}


function batchDelete() {
  const count = selectedRows.value.length
  ElMessageBox.confirm(`确定删除选中的 ${count} 条记录吗？`, '批量删除', { type: 'warning' })
    .then(async () => {
      await store.batchDelete(selectedRows.value.map(r => r.id))
      clearSelection()
      ElMessage.success(`已删除 ${count} 条记录`)
    })
    .catch(() => {})
}

// ===== 导入 =====
function importCSV() { fileInput.value?.click() }
function handleImport(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  const r = new FileReader()
  r.onload = async () => {
    const text = r.result as string
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) { ElMessage.error('CSV 文件为空'); return }
    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
      if (cols.length < 7) continue
      rows.push({
        assetNumber: cols[0] || '', partNo: cols[1] || '',
        serialNo: cols[2] || '', imei: cols[3] || '', arrivalDate: cols[4] || '',
        pickupDate: cols[5] || '', brand: cols[6] || '', model: cols[7] || '',
        assetLink: cols[8] || '', department: cols[9] || '', handler: cols[10] || '',
        recipient: cols[11] || '', dingtalkCreator: cols[12] || '',
        purchaseType: cols[13] || '新购', dingtalkFlow: cols[14] || '',
        originalOwner: cols[15] || '', notes: cols[16] || '',
      })
    }
    try {
      const result = await store.batchImport(rows)
      if (result.errors && result.errors.length) {
        ElMessage.warning(`导入 ${result.imported} 条，${result.errors.length} 条失败: ${result.errors[0]}`)
      } else {
        ElMessage.success(`导入 ${result.imported} 条`)
      }
    } catch (e: any) {
      ElMessage.error(e.message || '导入失败')
    }
    if (fileInput.value) fileInput.value.value = ''
  }
  r.readAsText(f)
}
</script>

<style scoped>
.proc-page { padding: 24px; background: var(--ops-bg-page); min-height: 100vh; }
:deep(.el-table__body tr) { cursor: pointer; }

/* ===== 表头高亮 ===== */
:deep(.el-table thead th) {
  background: linear-gradient(180deg, rgba(88,166,255,0.12) 0%, rgba(88,166,255,0.04) 100%) !important;
  color: var(--ops-accent-blue) !important;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  text-align: center;
  border-bottom: 2px solid rgba(88,166,255,0.25) !important;
}
:deep(.el-table thead th .cell) {
  color: var(--ops-accent-blue);
  font-weight: 700;
  text-align: center;
}

/* 表格内容居中 */
:deep(.el-table td.el-table__cell .cell) {
  text-align: center;
}

/* 顶部导航 */
.top-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px 0; border-bottom: 1px solid var(--ops-border-card); }
.top-bar h3 { flex: 1; font-size: 16px; font-weight: 600; color: var(--ops-text-primary); margin: 0; }
.top-actions { display: flex; gap: 8px; align-items: center; }
.back-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px 6px 10px; background: var(--ops-bg-card-hover); border: 1px solid var(--ops-border-card); border-radius: 20px; color: var(--ops-text-secondary); cursor: pointer; font-size: 12px; font-family: inherit; transition: all 0.2s ease; }
.back-btn svg { transition: transform 0.2s ease; }
.back-btn:hover { color: var(--ops-accent-blue); border-color: rgba(88,166,255,0.3); }
.back-btn:hover svg { transform: translateX(-2px); }

/* 顶部标题数量徽标 */
.top-count { font-size: 12px; font-weight: 400; color: var(--ops-text-tertiary); margin-left: 6px; }

/* 筛选栏 */
.filter-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-count { font-size: 12px; color: var(--ops-text-tertiary); }

/* 表格操作按钮横排 */
.action-btns { display: flex; align-items: center; gap: 4px; white-space: nowrap; }

/* 批量操作 */
.batch-bar { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 10px 14px; background: var(--ops-bg-card); border: 1px solid var(--ops-border-card); border-radius: 8px; }
.batch-count { font-size: 12px; color: var(--ops-accent-blue); font-weight: 600; }

/* 分页 */
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }

/* 详情抽屉 */
.drawer-section { margin-bottom: 20px; }
.drawer-section-title { font-size: 12px; font-weight: 600; color: var(--ops-accent-blue); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--ops-border-card); letter-spacing: 0.3px; }
.drawer-field { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
.field-label { font-size: 11px; color: var(--ops-text-tertiary); text-transform: uppercase; letter-spacing: 0.3px; }
.field-value { font-size: 13px; color: var(--ops-text-primary); }
.field-value.mono { font-family: 'SF Mono','Consolas',monospace; }
.field-highlight { font-weight: 600; }

/* 表单分组标题 */
.form-section-title { font-size: 13px; font-weight: 600; color: var(--ops-accent-blue); margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--ops-border-card); }
.form-section-title:first-child { margin-top: 0; }
</style>
