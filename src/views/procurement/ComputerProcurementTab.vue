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
      <el-select v-model="filterCeProcessed" placeholder="CE 流程" clearable style="width:120px">
        <el-option label="已走" :value="true" />
        <el-option label="未走" :value="false" />
      </el-select>
      <el-select v-model="dateType" placeholder="日期类型" style="width:100px">
        <el-option label="收货日期" value="receiveDate" />
        <el-option label="交付日期" value="deliveryDate" />
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
      <el-dropdown size="small" @command="onExportCmd">
        <el-button size="small">
          <el-icon><Download /></el-icon> 导出<el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="filtered" :disabled="filteredCount === 0">导出筛选结果 CSV（{{ filteredCount }}）</el-dropdown-item>
            <el-dropdown-item command="all" :disabled="store.computers.length === 0">导出全部 CSV（{{ store.computers.length }}）</el-dropdown-item>
            <el-dropdown-item command="filtered-xlsx" :disabled="filteredCount === 0">导出筛选结果 Excel</el-dropdown-item>
            <el-dropdown-item command="all-xlsx" :disabled="store.computers.length === 0">导出全部 Excel</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button size="small" text @click="refreshDicts">
        <el-icon><Refresh /></el-icon> 刷新字典
      </el-button>
      <el-popover trigger="click" placement="bottom" :width="220">
        <template #reference>
          <el-button size="small">
            <el-icon><Setting /></el-icon> 列设置
          </el-button>
        </template>
        <div class="col-settings">
          <div class="col-settings-title">显示列（{{ visibleCols.length }}/{{ COL_KEYS.length }}）</div>
          <el-checkbox-group v-model="visibleCols" size="small">
            <div v-for="col in COL_KEYS" :key="col.key" class="col-settings-item">
              <el-checkbox :value="col.key" :label="col.label" />
            </div>
          </el-checkbox-group>
          <div class="col-settings-actions">
            <el-button size="small" text @click="visibleCols = COL_KEYS.map(c => c.key)">全显</el-button>
            <el-button size="small" text @click="visibleCols = []">全隐</el-button>
            <el-button size="small" text type="primary" @click="visibleCols = DEFAULT_VISIBLE_COLS.slice()">默认</el-button>
          </div>
        </div>
      </el-popover>
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
      :row-class-name="rowClass"
    >
      <template #empty>
        <div class="empty-block">
          <span class="empty-text">{{ emptyText }}</span>
          <el-button v-if="hasActiveFilters" size="small" type="primary" text @click="resetFilters">清空筛选</el-button>
        </div>
      </template>
      <el-table-column type="selection" width="40" />
      <el-table-column v-if="colOn('assetNumber')" prop="assetNumber" label="资产序号" width="130" fixed show-overflow-tooltip sortable />
      <el-table-column v-if="colOn('model')" prop="model" label="采购型号" min-width="140" sortable />
      <el-table-column v-if="colOn('department')" prop="department" label="使用部门" width="100" sortable />
      <el-table-column v-if="colOn('applicant')" prop="applicant" label="申请人" width="90" sortable />
      <el-table-column v-if="colOn('macAddress')" prop="macAddress" label="MAC 地址" width="140" show-overflow-tooltip />
      <el-table-column v-if="colOn('deviceModel')" prop="deviceModel" label="设备型号" min-width="140" show-overflow-tooltip />
      <el-table-column v-if="colOn('receiveDate')" prop="receiveDate" label="收货日期" width="110" sortable :sort-method="sortByReceiveDate" />
      <el-table-column v-if="colOn('deliveryDate')" prop="deliveryDate" label="交付日期" width="110" sortable :sort-method="sortByDeliveryDate" />
      <el-table-column v-if="colOn('price')" prop="price" label="价格" width="120" sortable align="right">
        <template #default="{ row }">
          <span class="cell-price">¥{{ (row.price || 0).toLocaleString() }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <div class="action-btns">
            <el-button v-if="canEdit" size="small" text @click.stop="openEditDialog(row)">编辑</el-button>
            <el-button v-if="canEdit" size="small" text type="danger" @click.stop="handleDelete(row)">删除</el-button>
            <span v-if="!canEdit" class="read-only-hint">只读</span>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 批量操作栏 -->
    <div v-if="selectedRows.length" class="batch-bar">
      <span class="batch-count">已选 {{ selectedRows.length }} 项</span>
      <el-button v-if="canEdit" size="small" type="danger" plain @click="batchDelete">
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
        <div class="drawer-section">
          <div class="drawer-section-title">📜 最近变更</div>
          <div v-if="rowLogs.length === 0" class="drawer-empty">暂无变更记录</div>
          <div v-for="log in rowLogs" :key="log.id" class="log-item">
            <span class="log-action" :class="logActionClass(log.action)">{{ log.action }}</span>
            <span class="log-meta">{{ log.operator }} · {{ log.time }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button v-if="canEdit" type="danger" plain @click="selectedRow && handleDelete(selectedRow)">删除</el-button>
        <el-button-group class="drawer-nav">
          <el-button size="small" :disabled="!canPrevRow" @click="goPrevRow">上一条</el-button>
          <el-button size="small" :disabled="!canNextRow" @click="goNextRow">下一条</el-button>
        </el-button-group>
        <div style="flex:1" />
        <el-button @click="drawerVisible = false">关闭</el-button>
        <el-button v-if="canEdit" type="primary" @click="openEditDialog(selectedRow)">编辑</el-button>
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
    <input v-if="canEdit" ref="fileInput" type="file" accept=".csv,.xlsx" style="display:none" @change="handleImport" />
    <!-- 模板下载入口（仅管理员可见，隐藏在筛选栏右侧） -->
    <el-button v-if="canEdit" size="small" text @click="downloadTemplate" style="margin-left:auto">下载导入模板</el-button>
    <!-- 回收站入口（仅管理员可见） -->
    <el-button v-if="canEdit" size="small" text type="warning" @click="openTrash">♻ 回收站</el-button>

    <!-- 回收站抽屉 -->
    <el-drawer v-model="trashVisible" title="回收站（已软删除记录）" size="520px">
      <div v-if="trashRows.length === 0" class="empty-block" style="padding:40px"><span class="empty-text">回收站为空</span></div>
      <div v-for="r in trashRows" :key="r.id" class="trash-item">
        <div class="trash-body">
          <span class="trash-title">{{ r.model || `ID:${r.id}` }}</span>
          <span class="trash-meta">{{ r.department }} · 删除于 {{ r.deleted_at }}</span>
        </div>
        <el-button size="small" type="primary" text @click="restoreTrash([r.id])">恢复</el-button>
        <el-button size="small" type="danger" text @click="purgeTrash([r.id])">永久删除</el-button>
      </div>
      <template #footer>
        <el-button v-if="trashRows.length" type="primary" plain @click="restoreTrash(trashRows.map(r => r.id))">全部恢复</el-button>
        <el-button v-if="trashRows.length" type="danger" plain @click="purgeAllTrash">清空回收站</el-button>
        <div style="flex:1" />
        <el-button @click="trashVisible = false">关闭</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useComputerProcurementStore } from '../../stores/procurement'
import type { ComputerProcurement } from '../../stores/procurement'
import { Search, Delete, Setting, Download, ArrowDown, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchDict } from '../../api/admin'
import { fetchLogs } from '../../api/admin'
import { useAuthStore } from '../../stores/auth'
import { downloadCsv, escapeCsvField } from '../../utils/csv'
import { downloadXlsx, parseXlsx } from '../../utils/excel'
import { fetchComputerTrash, restoreComputer, purgeComputer } from '../../api/computer-procurement'

const store = useComputerProcurementStore()
const authStore = useAuthStore()
const canEdit = computed(() => authStore.isAdmin)
const route = useRoute()
const router = useRouter()

// ===== 列显隐配置 =====
const COL_KEYS: { key: string; label: string }[] = [
  { key: 'assetNumber', label: '资产序号' },
  { key: 'model', label: '采购型号' },
  { key: 'department', label: '使用部门' },
  { key: 'applicant', label: '申请人' },
  { key: 'macAddress', label: 'MAC 地址' },
  { key: 'deviceModel', label: '设备型号' },
  { key: 'receiveDate', label: '收货日期' },
  { key: 'deliveryDate', label: '交付日期' },
  { key: 'price', label: '价格' },
]
const DEFAULT_VISIBLE_COLS = COL_KEYS.map(c => c.key)
const visibleCols = ref<string[]>(DEFAULT_VISIBLE_COLS.slice())
function colOn(key: string) { return visibleCols.value.includes(key) }

// 行高亮：未走 CE 流程 / 未交付 加警告底色
function rowClass({ row }: { row: ComputerProcurement }) {
  const cls: string[] = []
  if (!row.ceProcessed) cls.push('row-warn-ce')
  if (!row.deliveryDate) cls.push('row-warn-delivery')
  return cls.join(' ')
}

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
const returnToDrawer = ref(false)   // 标记编辑是否从抽屉进入，保存后据此回抽屉
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
const filterCeProcessed = ref<boolean | ''>('')
const dateRange = ref<[string, string] | null>(null)
const dateType = ref<'receiveDate' | 'deliveryDate'>('receiveDate')
const page = ref(1)
const pageSize = ref(10)

// 筛选条件变化时重置分页
watch([search, filterDepartment, filterBrand, filterCeProcessed, dateRange, dateType], () => { page.value = 1 })

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

// ===== 筛选状态持久化到 URL query =====
// query key 前缀 c_ 避免与手机 tab 冲突
const FILTER_QKEYS = ['c_search', 'c_dept', 'c_brand', 'c_ce', 'c_dstart', 'c_dend', 'c_dtype'] as const
function applyFiltersFromQuery() {
  const q = route.query
  const s = (q['c_search'] as string) || ''
  searchInput.value = s
  search.value = s
  filterDepartment.value = (q['c_dept'] as string) || ''
  filterBrand.value = (q['c_brand'] as string) || ''
  const ce = q['c_ce'] as string | undefined
  filterCeProcessed.value = ce === '1' ? true : (ce === '0' ? false : '')
  const dstart = (q['c_dstart'] as string) || ''
  const dend = (q['c_dend'] as string) || ''
  dateRange.value = (dstart && dend) ? [dstart, dend] : null
  const dtype = (q['c_dtype'] as string) || 'receiveDate'
  dateType.value = (dtype === 'deliveryDate' ? 'deliveryDate' : 'receiveDate')
}
function syncFiltersToQuery() {
  const q: Record<string, string> = { ...route.query as Record<string, string> }
  // 写入或清除每个 key（空值清除避免 URL 冗长）
  const set = (k: string, v: string) => { if (v) q[k] = v; else delete q[k] }
  set('c_search', search.value)
  set('c_dept', filterDepartment.value)
  set('c_brand', filterBrand.value)
  set('c_ce', filterCeProcessed.value === true ? '1' : (filterCeProcessed.value === false ? '0' : ''))
  set('c_dstart', dateRange.value?.[0] || '')
  set('c_dend', dateRange.value?.[1] || '')
  set('c_dtype', dateType.value === 'receiveDate' ? '' : 'deliveryDate')
  router.replace({ query: q })
}
// 筛选条件变化时同步到 URL（首次挂载由 applyFiltersFromQuery 先读，再起 watch）
watch([search, filterDepartment, filterBrand, filterCeProcessed, dateRange, dateType], syncFiltersToQuery)

// ===== 筛选相关 =====
function resetFilters() {
  searchInput.value = ''
  search.value = ''
  filterDepartment.value = ''
  filterBrand.value = ''
  filterCeProcessed.value = ''
  dateRange.value = null
  dateType.value = 'receiveDate'
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
  if (filterCeProcessed.value !== '') {
    data = data.filter(c => c.ceProcessed === filterCeProcessed.value)
  }
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    const [start, end] = dateRange.value
    const prop = dateType.value
    data = data.filter(c => {
      const v = (c as any)[prop] as string | undefined
      return v && v >= start && v <= end
    })
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

// 是否有激活的筛选条件（用于空状态「清空筛选」按钮显隐）
const hasActiveFilters = computed(() =>
  !!search.value || !!filterDepartment.value || !!filterBrand.value ||
  filterCeProcessed.value !== '' || !!dateRange.value
)

// ===== 操作函数 =====
// 日期列自定义排序工厂（空值统一沉底）
function makeDateSorter(prop: string) {
  return (a: ComputerProcurement, b: ComputerProcurement) => {
    const va = (a as any)[prop] || ''
    const vb = (b as any)[prop] || ''
    if (!va && !vb) return 0
    if (!va) return 1
    if (!vb) return -1
    return va.localeCompare(vb)
  }
}
const sortByReceiveDate = makeDateSorter('receiveDate')
const sortByDeliveryDate = makeDateSorter('deliveryDate')

function handleSelectionChange(rows: ComputerProcurement[]) {
  selectedRows.value = rows
}

function clearSelection() {
  tableRef.value?.clearSelection()
}

function openDrawer(row: ComputerProcurement) {
  selectedRow.value = row
  drawerVisible.value = true
  loadRowLogs(row)
}

// 详情抽屉：该条最近变更日志（拉 module=电脑采购 全量，客户端按 target 过滤）
interface LogRow { id: number; action: string; target: string; operator: string; created_at: string }
const rowLogs = ref<LogRow[]>([])
async function loadRowLogs(row: ComputerProcurement) {
  rowLogs.value = []
  try {
    const data = await fetchLogs({ module: '电脑采购', pageSize: 9999 }) as { rows: LogRow[] }
    const targets = [row.model, `ID:${row.id}`].filter(Boolean)
    rowLogs.value = data.rows
      .filter(l => targets.some(t => l.target === t || l.target?.includes(row.model)))
      .slice(0, 5)
  } catch { /* 日志加载失败静默，不影响详情查看 */ }
}
function logActionClass(action: string) {
  if (action === '新增') return 'log-add'
  if (action === '删除' || action === '批量删除') return 'log-del'
  return 'log-edit'
}

// 详情抽屉上一条/下一条（基于当前筛选结果顺序）
const currentRowIndex = computed(() => {
  if (!selectedRow.value) return -1
  return filteredData.value.findIndex(r => r.id === selectedRow.value!.id)
})
const canPrevRow = computed(() => currentRowIndex.value > 0)
const canNextRow = computed(() =>
  currentRowIndex.value >= 0 && currentRowIndex.value < filteredData.value.length - 1
)
function goPrevRow() {
  if (!canPrevRow.value) return
  selectedRow.value = filteredData.value[currentRowIndex.value - 1]
}
function goNextRow() {
  if (!canNextRow.value) return
  selectedRow.value = filteredData.value[currentRowIndex.value + 1]
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
// 编辑模式记录原始快照，用于判断是否改动
const editingSnapshot = ref<string>('')
function snapshotForm(): string {
  return JSON.stringify({
    ...form, macAddress: form.macAddress, deviceModel: form.deviceModel,
  })
}
function onDialogClose(done: () => void) {
  // 新增模式：有填写才确认；编辑模式：有改动才确认
  const needConfirm = editingId.value
    ? snapshotForm() !== editingSnapshot.value
    : formDirty.value
  if (needConfirm) {
    ElMessageBox.confirm('表单内容已改动，确定关闭？', '提示', { type: 'warning' }).then(() => done()).catch(() => {})
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
  editingSnapshot.value = snapshotForm()
  returnToDrawer.value = drawerVisible.value   // 若抽屉正开则记 true，保存后回抽屉
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
  // MAC 地址查重（排除编辑自身）
  if (form.macAddress) {
    const dup = store.computers.find(c => c.macAddress === form.macAddress && c.id !== editingId.value)
    if (dup) {
      ElMessage.warning(`MAC 地址已存在（资产序号 ${dup.assetNumber || dup.model}），请核对后再保存`)
      return
    }
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
    // 编辑保存后若此前从抽屉进入，则同步 selectedRow 为更新后的行并重新打开抽屉
    if (editingId.value && returnToDrawer.value) {
      const updated = store.computers.find(c => c.id === editingId.value)
      if (updated) {
        selectedRow.value = updated
        drawerVisible.value = true
      }
      returnToDrawer.value = false
    }
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
const XLSX_HEADERS = ['采购型号','使用部门','申请人','MAC 地址','设备型号','使用人 CE 号','实际使用人','申请审批流程','收货日期','固定资产编号','设备交付日期','设备交付人','领用审批流程','已走 CE 流程','价格']
function toRowArr(c: ComputerProcurement): (string | number | boolean)[] {
  return [c.model, c.department, c.applicant, c.macAddress, c.deviceModel, c.ceNumber, c.actualUser, c.approvalNumber, c.receiveDate, c.assetNumber, c.deliveryDate, c.deliveryPerson, c.pickupApproval, c.ceProcessed ? '是' : '否', c.price]
}
function toCsvRow(c: ComputerProcurement) {
  return toRowArr(c).map(escapeCsvField).join(',')
}
function batchExport() {
  if (!selectedRows.value.length) { ElMessage.warning('请先选择要导出的记录'); return }
  const rows = selectedRows.value.map(toCsvRow)
  downloadCsv(CSV_HEADERS, rows, '电脑采购选中记录')
}

// 导出下拉命令：CSV / Excel
function onExportCmd(cmd: string) {
  if (cmd === 'filtered' || cmd === 'filtered-xlsx') {
    if (filteredCount.value === 0) { ElMessage.warning('当前筛选结果为空'); return }
    const rows = filteredData.value.map(toRowArr)
    if (cmd === 'filtered') downloadCsv(CSV_HEADERS, filteredData.value.map(toCsvRow), '电脑采购筛选结果')
    else downloadXlsx(XLSX_HEADERS, rows, '电脑采购筛选结果')
    ElMessage.success(`已导出筛选结果 ${filteredCount.value} 条`)
  } else if (cmd === 'all' || cmd === 'all-xlsx') {
    if (store.computers.length === 0) { ElMessage.warning('暂无可导出的数据'); return }
    const rows = store.computers.map(toRowArr)
    if (cmd === 'all') downloadCsv(CSV_HEADERS, store.computers.map(toCsvRow), '电脑采购全部记录')
    else downloadXlsx(XLSX_HEADERS, rows, '电脑采购全部记录')
    ElMessage.success(`已导出全部 ${store.computers.length} 条`)
  }
}

async function batchDelete() {
  const count = selectedRows.value.length
  const rows = [...selectedRows.value]
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${count} 条记录吗？`, '批量删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch { return }
  try {
    await store.batchDelete(rows.map(r => r.id))
    clearSelection()
    ElMessage({
      message: h('span', null, [
        h('span', null, `已删除 ${count} 条记录`),
        h('span', {
          style: 'color:var(--ops-accent-blue);cursor:pointer;margin-left:12px;font-weight:600',
          onClick: async () => {
            // 用后端 /trash/restore 恢复原记录（保持 id/资产号不变），而非 addComputer 新增
            try {
              await restoreComputer(rows.map(r => r.id))
              ElMessage.success('已撤销删除')
              await store.fetchComputers()
            } catch (e: any) {
              ElMessage.error('撤销失败：' + (e.message || ''))
            }
          }
        }, '撤销')
      ]),
      duration: 5000,
    })
  } catch (e: any) {
    ElMessage.error(e.message || '批量删除失败')
  }
}

// ===== 导入 =====
function importCSV() { fileInput.value?.click() }

// 下载导入模板（表头顺序与 handleImport 解析一致）
function downloadTemplate() {
  const header = '采购型号,使用部门,申请人,MAC 地址,设备型号,使用人 CE 号,实际使用人,申请审批流程,收货日期,固定资产编号,设备交付日期,设备交付人,领用审批流程,已走 CE 流程,价格'
  const sample = 'MacBook Pro 16,研发部,张三,AA:BB:CC:DD:EE:FF,Apple MacBook Pro 16,CE00001,张三,DLG-2024-0001,2024-06-01,IT-PC-2024-001,2024-06-10,李四,DLG-2024-0002,否,18999.00'
  downloadCsv(header, [sample], '电脑采购导入模板')
}
// 解析后的统一处理（CSV 和 Excel 共用）：校验 + dry-run 预览 + 提交
async function processImportRows(rawRows: any[][], skippedMacIn: number, skippedMacLinesIn: number[], skippedDupMacIn: number, skippedDupMacLinesIn: number[]) {
  // rawRows 是 [[cols...], ...] 形式，转成对象数组
  const rows: any[] = rawRows.map(cols => ({
    model: cols[0] || '', department: cols[1] || '', applicant: cols[2] || '',
    macAddress: cols[3] || '', deviceModel: cols[4] || '',
    ceNumber: cols[5] || '', actualUser: cols[6] || '',
    approvalNumber: cols[7] || '', receiveDate: cols[8] || '',
    assetNumber: cols[9] || '', deliveryDate: cols[10] || '',
    deliveryPerson: cols[11] || '', pickupApproval: cols[12] || '',
    ceProcessed: cols[13] === '是', price: parseFloat(cols[14]) || 0,
  }))
  const skippedMac = skippedMacIn, skippedDupMac = skippedDupMacIn
  const skippedMacLines = skippedMacLinesIn, skippedDupMacLines = skippedDupMacLinesIn
  try {
    if (rows.length === 0) {
      ElMessage.warning('解析后无可导入的有效行，请检查文件内容或下载模板对照')
      return
    }
    const skippedTotal = skippedMac + skippedDupMac
    const summaryLines: string[] = [`将导入 <b style="color:var(--ops-accent-blue)">${rows.length}</b> 条记录`]
    if (skippedTotal) summaryLines.push(`跳过 <b style="color:#e6a23c">${skippedTotal}</b> 行（MAC 格式 ${skippedMac} / 重复 ${skippedDupMac}）`)
    if (skippedMacLines.length) summaryLines.push(`<div style="font-size:12px;color:var(--ops-text-tertiary);margin-top:8px">MAC 格式错误行：${skippedMacLines.join(', ')}</div>`)
    if (skippedDupMacLines.length) summaryLines.push(`<div style="font-size:12px;color:var(--ops-text-tertiary);">MAC 重复行：${skippedDupMacLines.join(', ')}</div>`)
    try {
      await ElMessageBox.confirm(summaryLines.join('<br>'), '导入预览', {
        dangerouslyUseHTMLString: true, confirmButtonText: '确认导入', cancelButtonText: '取消',
        type: skippedTotal ? 'warning' : 'info',
      })
    } catch { ElMessage.info('已取消导入'); return }
    const result = await store.batchImport(rows)
    ElMessage[result.errors?.length ? 'warning' : 'success'](`导入 ${result.imported} 条${result.errors?.length ? `，${result.errors.length} 条失败: ${result.errors[0]}` : ''}`)
  } catch (e: any) {
    ElMessage.error(e.message || '导入失败')
  }
  if (fileInput.value) fileInput.value.value = ''
}
// MAC 校验 + 查重共用逻辑（CSV 行号和 Excel 行号都 1-based 含表头）
function validateMacRows(rawRows: string[][]) {
  const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/
  const validRows: string[][] = []
  let skippedMac = 0, skippedDupMac = 0
  const skippedMacLines: number[] = [], skippedDupMacLines: number[] = []
  const seenMacs = new Set<string>()
  const existMacs = new Set(store.computers.map(c => c.macAddress).filter(Boolean))
  rawRows.forEach((cols, i) => {
    const macAddress = cols[3] || ''
    if (macAddress && !macRegex.test(macAddress)) { skippedMac++; skippedMacLines.push(i + 2); return }
    if (macAddress) {
      if (existMacs.has(macAddress) || seenMacs.has(macAddress)) { skippedDupMac++; skippedDupMacLines.push(i + 2); return }
      seenMacs.add(macAddress)
    }
    validRows.push(cols)
  })
  return { validRows, skippedMac, skippedMacLines, skippedDupMac, skippedDupMacLines }
}
async function handleImport(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  const isXlsx = f.name.toLowerCase().endsWith('.xlsx')
  if (isXlsx) {
    try {
      const { headers, rows } = await parseXlsx(f)
      if (rows.length === 0) { ElMessage.error('Excel 文件为空或仅有表头'); return }
      // Excel 按「采购型号」列定位（与 CSV 列序一致），取前 15 列
      const COL_ORDER = ['采购型号','使用部门','申请人','MAC 地址','设备型号','使用人 CE 号','实际使用人','申请审批流程','收货日期','固定资产编号','设备交付日期','设备交付人','领用审批流程','已走 CE 流程','价格']
      const idxMap = COL_ORDER.map(h => headers.indexOf(h))
      const mapped = rows.map(r => idxMap.map((idx, j) => idx >= 0 ? r[idx] : (j === 13 ? '否' : '')))
      const { validRows, skippedMac, skippedMacLines, skippedDupMac, skippedDupMacLines } = validateMacRows(mapped)
      await processImportRows(validRows, skippedMac, skippedMacLines, skippedDupMac, skippedDupMacLines)
    } catch (e: any) {
      ElMessage.error(e.message || 'Excel 导入失败')
      if (fileInput.value) fileInput.value.value = ''
    }
    return
  }
  // CSV 路径（保留原逻辑）
  const r = new FileReader()
  r.onload = async () => {
    const text = r.result as string
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) { ElMessage.error('CSV 文件为空'); return }
    const rawRows: string[][] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
      if (cols.length < 4) continue
      rawRows.push(cols)
    }
    const { validRows, skippedMac, skippedMacLines, skippedDupMac, skippedDupMacLines } = validateMacRows(rawRows)
    await processImportRows(validRows, skippedMac, skippedMacLines, skippedDupMac, skippedDupMacLines)
  }
  r.readAsText(f)
}

// 按记录 id 打开详情抽屉（供概览跳转调用）
function openRowDrawer(id: number) {
  const row = store.computers.find(c => c.id === id)
  if (row) openDrawer(row)
}

// ===== 回收站（#29 软删除）=====
const trashVisible = ref(false)
const trashRows = ref<any[]>([])
async function openTrash() {
  trashVisible.value = true
  try {
    const data = await fetchComputerTrash()
    trashRows.value = data.list || []
  } catch (e: any) {
    ElMessage.error(e.message || '加载回收站失败')
  }
}
async function restoreTrash(ids: number[]) {
  if (!ids.length) return
  try {
    await restoreComputer(ids)
    ElMessage.success(`已恢复 ${ids.length} 条`)
    trashRows.value = trashRows.value.filter(r => !ids.includes(r.id))
    await store.loadComputers()
  } catch (e: any) { ElMessage.error(e.message || '恢复失败') }
}
async function purgeTrash(ids: number[]) {
  if (!ids.length) return
  try {
    await ElMessageBox.confirm(`确定永久删除 ${ids.length} 条记录吗？此操作不可恢复`, '永久删除', { type: 'warning', confirmButtonText: '永久删除', cancelButtonText: '取消' })
  } catch { return }
  try {
    await purgeComputer(ids)
    ElMessage.success(`已永久删除 ${ids.length} 条`)
    trashRows.value = trashRows.value.filter(r => !ids.includes(r.id))
  } catch (e: any) { ElMessage.error(e.message || '永久删除失败') }
}
async function purgeAllTrash() {
  const allIds = trashRows.value.map(r => r.id)
  await purgeTrash(allIds)
}

// 暴露方法给父组件
defineExpose({ openAddDialog, importCSV, openRowDrawer })

// 字典数据加载（挂载与「刷新字典」按钮共用）
async function loadDicts() {
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
    return true
  } catch (e) {
    console.error('加载字典数据失败:', e)
    ElMessage.warning('电脑型号字典加载失败，请刷新重试')
    return false
  }
}

// 手动刷新字典（新增字典项后无需刷新整页）
async function refreshDicts() {
  const ok = await loadDicts()
  if (ok) ElMessage.success('字典已刷新')
}

onMounted(async () => {
  // 先从 URL query 回填筛选状态（再起 watch 已在顶层注册，非 immediate 首次不触发）
  applyFiltersFromQuery()
  await loadDicts()
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
.read-only-hint { font-size: 11px; color: var(--ops-text-tertiary); }
.trash-item { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--ops-border-card); }
.trash-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.trash-title { font-size: 13px; color: var(--ops-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trash-meta { font-size: 11px; color: var(--ops-text-tertiary); }

/* 筛选栏 */
.filter-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filter-count { font-size: 12px; color: var(--ops-text-tertiary); }
.empty-block { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px; }
.empty-text { font-size: 13px; color: var(--ops-text-tertiary); }

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
.cell-price { font-weight: 600; color: var(--ops-accent-blue); font-size: 13px; }
.field-highlight { font-weight: 600; }

/* 表单分组标题 */
.form-section-title { font-size: 13px; font-weight: 600; color: var(--ops-accent-blue); margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--ops-border-card); }
.form-section-title:first-child { margin-top: 0; }

/* 列设置下拉 */
.col-settings { padding: 4px 0; }
.col-settings-title { font-size: 12px; color: var(--ops-text-tertiary); margin-bottom: 8px; }
.col-settings-item { padding: 2px 0; }
.col-settings-item :deep(.el-checkbox__label) { font-size: 13px; }
.col-settings-actions { display: flex; gap: 4px; margin-top: 8px; border-top: 1px solid var(--ops-border-card); padding-top: 8px; }

/* 抽屉上一条/下一条 */
.drawer-nav { margin-left: 8px; }
.drawer-empty { font-size: 12px; color: var(--ops-text-tertiary); padding: 4px 0; }
.log-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
.log-action { padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.log-add { background: rgba(103,194,58,0.15); color: #67c23a; }
.log-del { background: rgba(245,108,108,0.15); color: #f56c6c; }
.log-edit { background: rgba(88,166,255,0.15); color: var(--ops-accent-blue); }
.log-meta { color: var(--ops-text-tertiary); }

/* 行高亮（覆盖斑马纹） */
:deep(.el-table__body tr.row-warn-ce td.el-table__cell) {
  background: rgba(230, 162, 60, 0.12) !important;
}
:deep(.el-table__body tr.row-warn-delivery td.el-table__cell) {
  background: rgba(245, 108, 108, 0.12) !important;
}
:deep(.el-table__body tr.row-warn-ce.row-warn-delivery td.el-table__cell) {
  background: rgba(230, 162, 60, 0.22) !important;
}
:deep(.el-table__body tr.row-warn-ce:hover td.el-table__cell),
:deep(.el-table__body tr.row-warn-delivery:hover td.el-table__cell) {
  background: rgba(88, 166, 255, 0.08) !important;
}
</style>
