<template>
  <div class="proc-page">
    <!-- 搜索/筛选 -->
    <div class="filter-bar">
      <el-input v-model="searchInput" placeholder="搜索型号/部门/申请人/MAC地址..." clearable style="width:300px">
        <template #prefix>
          <el-icon><search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="filterDepartment" placeholder="全部部门" clearable style="width:140px">
        <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
      </el-select>
      <el-select v-model="filterBrand" placeholder="全部品牌" clearable style="width:140px">
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
      <span v-if="filteredCount !== store.computers.length" class="filter-count">筛选 {{ filteredCount }} / {{ store.computers.length }} 条</span>
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
      <el-table-column prop="assetNumber" label="资产序号" width="130" fixed show-overflow-tooltip />
      <el-table-column prop="model" label="采购型号" min-width="140" />
      <el-table-column prop="department" label="使用部门" width="100" />
      <el-table-column prop="applicant" label="申请人" width="90" />
      <el-table-column prop="macAddress" label="MAC 地址" width="140" show-overflow-tooltip />
      <el-table-column prop="deviceModel" label="设备型号" min-width="140" show-overflow-tooltip />
      <el-table-column prop="receiveDate" label="收货日期" width="110" />
      <el-table-column prop="deliveryDate" label="交付日期" width="110" />
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

    <!-- 价格合计 -->
    <div v-if="filteredCount > 0" class="price-summary">
      筛选结果合计: <strong>¥{{ filteredPriceTotal.toLocaleString() }}</strong>
    </div>

    <!-- 分页 -->
    <div v-if="filteredCount > 0" class="pagination">
      <el-pagination v-model:current-page="page" v-model:pageSize="pageSize" :page-sizes="[10,20,50]"
        :total="filteredCount" layout="total, sizes, prev, pager, next" small />
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="电脑采购详情" size="520px">
      <template v-if="selectedRow">
        <div class="drawer-section">
          <div class="drawer-section-title">📦 设备信息</div>
          <div class="drawer-field"><span class="field-label">采购型号</span><span class="field-value field-highlight">{{ selectedRow.model }}</span></div>
          <div class="drawer-field"><span class="field-label">设备型号</span><span class="field-value">{{ selectedRow.deviceModel || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">MAC 地址</span><span class="field-value mono">{{ selectedRow.macAddress || '—' }}</span></div>
        </div>
        <div class="drawer-section">
          <div class="drawer-section-title">👤 人员信息</div>
          <div class="drawer-field"><span class="field-label">使用部门</span><span class="field-value">{{ selectedRow.department }}</span></div>
          <div class="drawer-field"><span class="field-label">申请人</span><span class="field-value field-highlight">{{ selectedRow.applicant }}</span></div>
          <div class="drawer-field"><span class="field-label">实际使用人</span><span class="field-value">{{ selectedRow.actualUser || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">使用人 CE 号</span><span class="field-value">{{ selectedRow.ceNumber || '—' }}</span></div>
        </div>
        <div class="drawer-section">
          <div class="drawer-section-title">📋 审批流程</div>
          <div class="drawer-field"><span class="field-label">申请审批流程（钉钉）</span><span class="field-value mono">{{ selectedRow.approvalNumber || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">领用审批流程（钉钉）</span><span class="field-value mono">{{ selectedRow.pickupApproval || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">是否已走 CE 流程</span><span class="field-value">{{ selectedRow.ceProcessed ? '✅ 已走' : '❌ 未走' }}</span></div>
        </div>
        <div class="drawer-section">
          <div class="drawer-section-title">💰 资产与交付</div>
          <div class="drawer-field"><span class="field-label">价格</span><span class="field-value price">&yen;{{ selectedRow.price.toLocaleString() }}</span></div>
          <div class="drawer-field"><span class="field-label">关联固定资产编号</span><span class="field-value mono">{{ selectedRow.assetNumber || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">收货日期</span><span class="field-value">{{ selectedRow.receiveDate || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">设备交付日期</span><span class="field-value">{{ selectedRow.deliveryDate || '—' }}</span></div>
          <div class="drawer-field"><span class="field-label">设备交付人</span><span class="field-value">{{ selectedRow.deliveryPerson || '—' }}</span></div>
        </div>
      </template>
      <template #footer>
        <el-button type="danger" plain @click="selectedRow && handleDelete(selectedRow)">删除</el-button>
        <div style="flex:1" />
        <el-button @click="drawerVisible = false">关闭</el-button>
        <el-button type="primary" @click="openEditDialog(selectedRow)">编辑</el-button>
      </template>
    </el-drawer>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑电脑采购' : '添加电脑采购'" width="600px" destroy-on-close :before-close="onDialogClose">
      <el-form :model="form" label-width="130px" :rules="rules" ref="formRef">
        <!-- 设备信息 -->
        <div class="form-section-title">📦 设备信息</div>
        <el-form-item label="采购型号" prop="model">
          <el-select v-model="form.model" filterable allow-create placeholder="请选择采购型号" style="width:100%" @change="form.deviceModel = ''">
            <el-option v-for="m in purchaseModelOpts" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备型号" prop="deviceModel">
          <el-select v-model="form.deviceModel" filterable allow-create placeholder="请先选择采购型号" :disabled="!form.model" style="width:100%">
            <el-option v-for="m in deviceModelOptions" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="MAC 地址"><el-input v-model="form.macAddress" placeholder="AA:BB:CC:DD:EE:FF" /></el-form-item>

        <!-- 人员信息 -->
        <div class="form-section-title">👤 人员信息</div>
        <el-form-item label="使用部门" prop="department">
          <el-select v-model="form.department" filterable allow-create placeholder="请选择部门" style="width:100%">
            <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请人" prop="applicant"><el-input v-model="form.applicant" /></el-form-item>
        <el-form-item label="实际使用人"><el-input v-model="form.actualUser" placeholder="与申请人不同时填写" /></el-form-item>
        <el-form-item label="使用人 CE 号"><el-input v-model="form.ceNumber" placeholder="CE 编号" /></el-form-item>

        <!-- 审批流程 -->
        <div class="form-section-title">📋 审批流程</div>
        <el-form-item label="申请审批流程"><el-input v-model="form.approvalNumber" placeholder="钉钉流程编号" /></el-form-item>
        <el-form-item label="领用审批流程"><el-input v-model="form.pickupApproval" placeholder="钉钉流程编号" /></el-form-item>
        <el-form-item label="已走 CE 流程"><el-switch v-model="form.ceProcessed" /></el-form-item>

        <!-- 资产与交付 -->
        <div class="form-section-title">💰 资产与交付</div>
        <el-form-item label="价格" prop="price"><el-input-number v-model="form.price" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="固定资产编号"><el-input v-model="form.assetNumber" placeholder="IT-PC-YYYY-NNN" /></el-form-item>
        <el-form-item label="收货日期"><el-date-picker v-model="form.receiveDate" type="date" value-format="YYYY-MM-DD" format="YYYY年MM月DD日" style="width:100%" /></el-form-item>
        <el-form-item label="设备交付日期"><el-date-picker v-model="form.deliveryDate" type="date" value-format="YYYY-MM-DD" format="YYYY年MM月DD日" style="width:100%" /></el-form-item>
        <el-form-item label="设备交付人">
          <el-select v-model="form.deliveryPerson" filterable allow-create placeholder="请选择交付人" style="width:100%">
            <el-option v-for="p in deliveryPersons" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
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
import { useComputerProcurementStore } from '../../stores/procurement'
import type { ComputerProcurement } from '../../stores/procurement'
import { Search, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchDict } from '../../api/admin'
import { downloadCsv, escapeCsvField } from '../../utils/csv'

const store = useComputerProcurementStore()

// 字典数据
const departmentOptions = ref<string[]>([])
const handlerOptions = ref<string[]>([])
const purchaseModelOptions = ref<string[]>([])
const deviceModelMap = ref<Record<string, string[]>>({})

const tableRef = ref()
const fileInput = ref<HTMLInputElement>()
const formRef = ref()
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const drawerVisible = ref(false)
const selectedRow = ref<ComputerProcurement | null>(null)
const selectedRows = ref<ComputerProcurement[]>([])
const search = ref('')
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { search.value = v }, 300)
})
const filterDepartment = ref('')
const filterBrand = ref('')
const dateRange = ref<[string, string] | null>(null)
const page = ref(1)
const pageSize = ref(10)

// 筛选条件变化时重置分页
watch([search, filterDepartment, filterBrand, dateRange], () => { page.value = 1 })

const form = reactive({
  model: '', department: '', applicant: '', macAddress: '', deviceModel: '',
  ceNumber: '', actualUser: '', approvalNumber: '', receiveDate: '',
  assetNumber: '', deliveryDate: '', deliveryPerson: '', pickupApproval: '',
  ceProcessed: false, price: 0,
})

const rules = {
  model: [{ required: true, message: '请输入采购型号', trigger: 'blur' }],
  department: [{ required: true, message: '请输入使用部门', trigger: 'blur' }],
  applicant: [{ required: true, message: '请输入申请人', trigger: 'blur' }],
  deviceModel: [{ required: true, message: '请输入设备型号', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  macAddress: [{ pattern: /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, message: '格式: AA:BB:CC:DD:EE:FF', trigger: 'blur' }],
}

// ===== 筛选相关 =====
function resetFilters() {
  searchInput.value = ''
  search.value = ''
  filterDepartment.value = ''
  filterBrand.value = ''
  dateRange.value = null
  page.value = 1
}

const departments = computed(() => departmentOptions.value.length ? departmentOptions.value : [...new Set(store.computers.map(c => c.department))].sort())
const deliveryPersons = computed(() => handlerOptions.value.length ? handlerOptions.value : [...new Set(store.computers.map(c => c.deliveryPerson).filter(Boolean))].sort())

// 品牌推断（从采购型号提取首词）
function inferBrand(model: string): string {
  if (!model) return ''
  const m = model.toLowerCase()
  if (m.includes('macbook') || m.includes('mac')) return 'Apple'
  if (m.includes('dell') || m.includes('xps') || m.includes('latitude')) return 'Dell'
  if (m.includes('thinkpad') || m.includes('lenovo')) return 'Lenovo'
  if (m.includes('hp') || m.includes('elitebook') || m.includes('probook')) return 'HP'
  if (m.includes('asus') || m.includes('zenbook')) return 'ASUS'
  if (m.includes('surface')) return 'Microsoft'
  return model.split(' ')[0] || model
}
// 从采购型号字典提取品牌列表
const brands = computed(() => {
  const dictBrands = purchaseModelOpts.value.map(m => inferBrand(m))
  const dataBrands = store.computers.map(c => inferBrand(c.model))
  return [...new Set([...dictBrands, ...dataBrands])].filter(Boolean).sort()
})

// 采购型号 → 设备型号映射
const purchaseModels = computed(() => {
  // 优先用字典数据
  if (Object.keys(deviceModelMap.value).length) return deviceModelMap.value
  // fallback: 从已有数据中补充
  const map: Record<string, string[]> = {}
  for (const c of store.computers) {
    if (c.model) {
      if (!map[c.model]) map[c.model] = []
      if (c.deviceModel && !map[c.model].includes(c.deviceModel)) map[c.model].push(c.deviceModel)
    }
  }
  return map
})
const purchaseModelOpts = computed(() => purchaseModelOptions.value.length ? purchaseModelOptions.value : Object.keys(purchaseModels.value).sort())
const deviceModelOptions = computed(() => {
  if (!form.model) return []
  return (purchaseModels.value[form.model] || []).sort()
})

const filteredData = computed(() => {
  let data = store.computers
  if (filterDepartment.value) data = data.filter(c => c.department === filterDepartment.value)
  if (filterBrand.value) {
    data = data.filter(c => inferBrand(c.model) === filterBrand.value)
  }
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    const [start, end] = dateRange.value
    data = data.filter(c => c.receiveDate && c.receiveDate >= start && c.receiveDate <= end)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    data = data.filter(c =>
      c.model.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q) ||
      c.applicant.toLowerCase().includes(q) ||
      c.macAddress.toLowerCase().includes(q) ||
      c.deviceModel.toLowerCase().includes(q) ||
      c.assetNumber.toLowerCase().includes(q)
    )
  }
  return data.sort((a, b) => (b.receiveDate || '').localeCompare(a.receiveDate || ''))
})

const filteredCount = computed(() => filteredData.value.length)
const filteredPriceTotal = computed(() => filteredData.value.reduce((sum, c) => sum + (c.price || 0), 0))

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredData.value.slice(start, start + pageSize.value)
})

const emptyText = computed(() => {
  if (store.computers.length === 0) return '暂无采购记录'
  if (filteredData.value.length === 0) return '未找到匹配的记录，请调整筛选条件'
  return '暂无数据'
})

// ===== 操作函数 =====
function handleSelectionChange(rows: ComputerProcurement[]) {
  selectedRows.value = rows
}

function clearSelection() {
  tableRef.value?.clearSelection()
}

function openDrawer(row: ComputerProcurement) {
  selectedRow.value = row
  drawerVisible.value = true
}

function resetForm() {
  Object.assign(form, {
    model: '', department: '', applicant: '', macAddress: '', deviceModel: '',
    ceNumber: '', actualUser: '', approvalNumber: '', receiveDate: '',
    assetNumber: '', deliveryDate: '', deliveryPerson: '', pickupApproval: '',
    ceProcessed: false, price: 0,
  })
}

function openAddDialog() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

const formDirty = computed(() =>
  form.model || form.department || form.applicant || form.macAddress ||
  form.deviceModel || form.ceNumber || form.actualUser || form.approvalNumber ||
  form.receiveDate || form.assetNumber || form.deliveryDate || form.deliveryPerson ||
  form.pickupApproval || form.price > 0
)
function onDialogClose(done: () => void) {
  if (!editingId.value && formDirty.value) {
    ElMessageBox.confirm('表单已填写内容，确定关闭？', '提示', { type: 'warning' }).then(() => done()).catch(() => {})
  } else { done() }
}

function openEditDialog(row: ComputerProcurement | null) {
  if (!row) return
  editingId.value = row.id
  Object.assign(form, {
    model: row.model, department: row.department, applicant: row.applicant,
    macAddress: row.macAddress, deviceModel: row.deviceModel,
    ceNumber: row.ceNumber, actualUser: row.actualUser,
    approvalNumber: row.approvalNumber, receiveDate: row.receiveDate || '',
    assetNumber: row.assetNumber, deliveryDate: row.deliveryDate || '',
    deliveryPerson: row.deliveryPerson, pickupApproval: row.pickupApproval,
    ceProcessed: row.ceProcessed, price: row.price,
  })
  dialogVisible.value = true
  drawerVisible.value = false
}

async function handleSave() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  // 手动校验 MAC 地址（覆盖 blur 未触发的情况）
  if (form.macAddress && !/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(form.macAddress)) {
    ElMessage.warning('MAC 地址格式不正确，应为 AA:BB:CC:DD:EE:FF')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await store.updateComputer(editingId.value, { ...form })
      ElMessage.success('修改成功')
    } else {
      await store.addComputer({ ...form } as Omit<ComputerProcurement, 'id'>)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: ComputerProcurement) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.model}」（${row.assetNumber || row.applicant}）吗？`, '确认删除', { type: 'warning' })
    await store.deleteComputer(row.id)
    ElMessage.success('删除成功')
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}

// ===== 导出 =====
const CSV_HEADERS = '采购型号,使用部门,申请人,MAC 地址,设备型号,使用人 CE 号,实际使用人,申请审批流程,收货日期,固定资产编号,设备交付日期,设备交付人,领用审批流程,已走 CE 流程,价格'
function toCsvRow(c: ComputerProcurement) {
  return [c.model, c.department, c.applicant, c.macAddress, c.deviceModel, c.ceNumber, c.actualUser, c.approvalNumber, c.receiveDate, c.assetNumber, c.deliveryDate, c.deliveryPerson, c.pickupApproval, c.ceProcessed ? '是' : '否', c.price].map(escapeCsvField).join(',')
}
function batchExport() {
  if (!selectedRows.value.length) { ElMessage.warning('请先选择要导出的记录'); return }
  const rows = selectedRows.value.map(toCsvRow)
  downloadCsv(CSV_HEADERS, rows, '电脑采购选中记录')
}

async function batchDelete() {
  const count = selectedRows.value.length
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${count} 条记录吗？`, '批量删除', { type: 'warning' })
    await store.batchDelete(selectedRows.value.map(r => r.id))
    clearSelection()
    ElMessage.success(`已删除 ${count} 条记录`)
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '批量删除失败')
  }
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
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/
    let skippedMac = 0
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
      if (cols.length < 4) continue
      const macAddress = cols[3] || ''
      if (macAddress && !macRegex.test(macAddress)) { skippedMac++; continue }
      rows.push({
        model: cols[0] || '', department: cols[1] || '', applicant: cols[2] || '',
        macAddress, deviceModel: cols[4] || '',
        ceNumber: cols[5] || '', actualUser: cols[6] || '',
        approvalNumber: cols[7] || '', receiveDate: cols[8] || '',
        assetNumber: cols[9] || '', deliveryDate: cols[10] || '',
        deliveryPerson: cols[11] || '', pickupApproval: cols[12] || '',
        ceProcessed: cols[13] === '是', price: parseFloat(cols[14]) || 0,
      })
    }
    try {
      const result = await store.batchImport(rows)
      const msg = [`导入 ${result.imported} 条`]
      if (skippedMac) msg.push(`${skippedMac} 条 MAC 格式跳过`)
      if (result.errors?.length) msg.push(`${result.errors.length} 条失败: ${result.errors[0]}`)
      if (result.errors?.length || skippedMac) ElMessage.warning(msg.join('，'))
      else ElMessage.success(msg[0])
    } catch (e: any) {
      ElMessage.error(e.message || '导入失败')
    }
    if (fileInput.value) fileInput.value.value = ''
  }
  r.readAsText(f)
}

// 暴露方法给父组件
defineExpose({ openAddDialog, importCSV })

onMounted(async () => {
  try {
    const [depts, handlers, purchaseModels, deviceModels] = await Promise.all([
      fetchDict('procurement-departments'),
      fetchDict('procurement-handlers'),
      fetchDict('computer-purchase-models'),
      fetchDict('computer-device-models'),
    ])
    departmentOptions.value = depts.map((d: any) => d.name)
    handlerOptions.value = handlers.map((h: any) => h.name)
    purchaseModelOptions.value = purchaseModels.map((m: any) => m.name)
    // 构建采购型号→设备型号映射
    const map: Record<string, string[]> = {}
    for (const pm of purchaseModels) {
      const dms = deviceModels.filter((dm: any) => dm.purchase_model_id === pm.id).map((dm: any) => dm.name)
      map[pm.name] = dms
    }
    deviceModelMap.value = map
  } catch (e) {
    console.error('加载字典数据失败:', e)
    ElMessage.warning('电脑型号字典加载失败，请刷新重试')
  }
})
</script>

<style scoped>
.proc-page { padding: 16px 24px; background: var(--ops-bg-page); flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
:deep(.el-table__body tr) { cursor: pointer; }
.price-summary { text-align: right; padding: 8px 0; font-size: 13px; color: var(--ops-text-secondary); }
.price-summary strong { color: var(--ops-accent-blue); font-size: 15px; }
.field-value.price { text-align: right; font-weight: 700; color: var(--ops-accent-blue); }

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

/* 表格操作按钮横排 */
.action-btns { display: flex; align-items: center; gap: 4px; white-space: nowrap; }

/* 筛选栏 */
.filter-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filter-count { font-size: 12px; color: var(--ops-text-tertiary); }

/* 批量操作 */
.batch-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--ops-bg-card); border: 1px solid var(--ops-border-card); border-radius: 8px; }
.batch-count { font-size: 12px; color: var(--ops-accent-blue); font-weight: 600; }

/* 分页 */
.pagination { display: flex; justify-content: flex-end; }

/* 详情抽屉 */
.drawer-section { margin-bottom: 20px; }
.drawer-section-title { font-size: 12px; font-weight: 600; color: var(--ops-accent-blue); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--ops-border-card); letter-spacing: 0.3px; }
.drawer-field { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
.field-label { font-size: 11px; color: var(--ops-text-tertiary); text-transform: uppercase; letter-spacing: 0.3px; }
.field-value { font-size: 13px; color: var(--ops-text-primary); }
.field-value.mono { font-family: 'SF Mono','Consolas',monospace; }
.field-value.price { font-weight: 700; color: var(--ops-accent-blue); font-size: 15px; }
.field-highlight { font-weight: 600; }

/* 表单分组标题 */
.form-section-title { font-size: 13px; font-weight: 600; color: var(--ops-accent-blue); margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--ops-border-card); }
.form-section-title:first-child { margin-top: 0; }
</style>
