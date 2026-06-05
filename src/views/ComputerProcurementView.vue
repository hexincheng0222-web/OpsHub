<template>
  <div class="proc-page">
    <!-- 顶部导航栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="$router.push('/')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回</span>
      </button>
      <h3>电脑采购登记表 <span class="top-count">{{ store.computers.length }} 台</span></h3>
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
      <el-input v-model="search" placeholder="搜索型号/部门/申请人/MAC地址..." clearable style="width:280px">
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
      <el-table-column prop="model" label="采购型号" min-width="140" fixed />
      <el-table-column prop="department" label="使用部门" width="100" />
      <el-table-column prop="applicant" label="申请人" width="90" />
      <el-table-column prop="macAddress" label="MAC 地址" width="140" show-overflow-tooltip />
      <el-table-column prop="deviceModel" label="设备型号" min-width="140" show-overflow-tooltip />
      <el-table-column prop="price" label="价格" width="90" align="right" sortable>
        <template #default="{ row }">&yen;{{ row.price.toLocaleString() }}</template>
      </el-table-column>
      <el-table-column prop="receiveDate" label="收货日期" width="110" sortable />
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
    <div v-if="filteredCount > 10" class="pagination">
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
        <el-button @click="drawerVisible = false">关闭</el-button>
        <el-button type="primary" @click="openEditDialog(selectedRow)">编辑</el-button>
      </template>
    </el-drawer>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑电脑采购' : '添加电脑采购'" width="600px" destroy-on-close>
      <el-form :model="form" label-width="130px" :rules="rules" ref="formRef">
        <!-- 设备信息 -->
        <div class="form-section-title">📦 设备信息</div>
        <el-form-item label="采购型号" prop="model"><el-input v-model="form.model" placeholder="如 MacBook Pro 16&quot;" /></el-form-item>
        <el-form-item label="设备型号" prop="deviceModel"><el-input v-model="form.deviceModel" placeholder="如 MacBook Pro M3 Max" /></el-form-item>
        <el-form-item label="MAC 地址"><el-input v-model="form.macAddress" placeholder="AA:BB:CC:DD:EE:FF" /></el-form-item>

        <!-- 人员信息 -->
        <div class="form-section-title">👤 人员信息</div>
        <el-form-item label="使用部门" prop="department"><el-input v-model="form.department" placeholder="如 研发部" /></el-form-item>
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
        <el-form-item label="设备交付人"><el-input v-model="form.deliveryPerson" placeholder="运维组经手人" /></el-form-item>
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
import { ref, reactive, computed } from 'vue'
import { useComputerProcurementStore } from '../stores/procurement'
import type { ComputerProcurement } from '../stores/procurement'
import { Plus, Search, ArrowDown, Download, Upload, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useComputerProcurementStore()
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
const filterDepartment = ref('')
const filterBrand = ref('')
const dateRange = ref<[string, string] | null>(null)
const page = ref(1)
const pageSize = ref(10)

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
}

// ===== 筛选相关 =====
const departments = computed(() => [...new Set(store.computers.map(c => c.department))].sort())
const brands = computed(() => [...new Set(store.computers.map(c => {
  const m = c.model.toLowerCase()
  if (m.includes('macbook') || m.includes('mac')) return 'Apple'
  if (m.includes('dell') || m.includes('xps')) return 'Dell'
  if (m.includes('thinkpad') || m.includes('lenovo')) return 'Lenovo'
  if (m.includes('hp') || m.includes('elitebook')) return 'HP'
  return c.model.split(' ')[0]
}))].sort())

const filteredData = computed(() => {
  let data = store.computers
  if (filterDepartment.value) data = data.filter(c => c.department === filterDepartment.value)
  if (filterBrand.value) {
    const brand = filterBrand.value.toLowerCase()
    data = data.filter(c => c.model.toLowerCase().includes(brand))
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

function handleSave() {
  if (!form.model.trim() || !form.department.trim() || !form.applicant.trim()) {
    ElMessage.warning('请填写必填项')
    return
  }
  saving.value = true
  setTimeout(() => {
    if (editingId.value) {
      store.updateComputer(editingId.value, { ...form })
      ElMessage.success('修改成功')
    } else {
      store.addComputer({ id: store.nextId(), ...form })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    saving.value = false
  }, 300)
}

function handleDelete(row: ComputerProcurement) {
  ElMessageBox.confirm(`确定删除「${row.model}」吗？`, '确认删除', { type: 'warning' })
    .then(() => { store.deleteComputer(row.id); ElMessage.success('删除成功') })
    .catch(() => {})
}

function handleTopAction(command: string) {
  if (command === 'export') exportCSV()
  else if (command === 'exportSelected') batchExport()
  else if (command === 'import') importCSV()
}

// ===== 导出 =====
function exportCSV() {
  const header = ['采购型号','使用部门','申请人','MAC 地址','设备型号','使用人 CE 号','实际使用人','申请审批流程','收货日期','固定资产编号','设备交付日期','设备交付人','领用审批流程','已走 CE 流程','价格'].join(',')
  const rows = store.computers.map(c =>
    [c.model, c.department, c.applicant, c.macAddress, c.deviceModel, c.ceNumber, c.actualUser, c.approvalNumber, c.receiveDate, c.assetNumber, c.deliveryDate, c.deliveryPerson, c.pickupApproval, c.ceProcessed ? '是' : '否', c.price].map(v => `"${(v??'').toString().replace(/"/g,'""')}"`).join(',')
  )
  downloadCsv(header, rows, '电脑采购登记表')
}

function batchExport() {
  if (!selectedRows.value.length) { ElMessage.warning('请先选择要导出的记录'); return }
  const header = ['采购型号','使用部门','申请人','MAC 地址','设备型号','价格','收货日期','设备交付日期'].join(',')
  const rows = selectedRows.value.map(c =>
    [c.model, c.department, c.applicant, c.macAddress, c.deviceModel, c.price, c.receiveDate, c.deliveryDate].map(v => `"${(v??'').toString().replace(/"/g,'""')}"`).join(',')
  )
  downloadCsv(header, rows, '电脑采购选中记录')
}

function downloadCsv(header: string, rows: string[], filename: string) {
  const bom = '\uFEFF'
  const csv = bom + header + '\n' + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function batchDelete() {
  ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 条记录吗？`, '批量删除', { type: 'warning' })
    .then(() => {
      selectedRows.value.forEach(r => store.deleteComputer(r.id))
      clearSelection()
      ElMessage.success(`已删除 ${selectedRows.value.length} 条记录`)
    })
    .catch(() => {})
}

// ===== 导入 =====
function importCSV() { fileInput.value?.click() }
function handleImport(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  const r = new FileReader()
  r.onload = () => {
    const text = r.result as string
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) { ElMessage.error('CSV 文件为空'); return }
    let imported = 0
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
      if (cols.length < 4) continue
      store.addComputer({
        id: store.nextId(),
        model: cols[0] || '', department: cols[1] || '', applicant: cols[2] || '',
        macAddress: cols[3] || '', deviceModel: cols[4] || '',
        ceNumber: cols[5] || '', actualUser: cols[6] || '',
        approvalNumber: cols[7] || '', receiveDate: cols[8] || '',
        assetNumber: cols[9] || '', deliveryDate: cols[10] || '',
        deliveryPerson: cols[11] || '', pickupApproval: cols[12] || '',
        ceProcessed: cols[13] === '是', price: parseFloat(cols[14]) || 0,
      })
      imported++
    }
    ElMessage.success(`导入 ${imported} 条`)
    if (fileInput.value) fileInput.value.value = ''
  }
  r.readAsText(f)
}
</script>

<style scoped>
.proc-page { padding: 24px; background: var(--ops-bg-page); min-height: 100vh; }

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

/* 表格操作按钮横排 */
.action-btns { display: flex; align-items: center; gap: 4px; white-space: nowrap; }

/* 筛选栏 */
.filter-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-count { font-size: 12px; color: var(--ops-text-tertiary); }

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
.field-value.price { font-weight: 700; color: var(--ops-accent-blue); font-size: 15px; }
.field-highlight { font-weight: 600; }

/* 表单分组标题 */
.form-section-title { font-size: 13px; font-weight: 600; color: var(--ops-accent-blue); margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--ops-border-card); }
.form-section-title:first-child { margin-top: 0; }
</style>
