<template>
  <div class="proc-page">
    <!-- 搜索/筛选 -->
    <div class="filter-bar">
      <el-input v-model="searchInput" placeholder="搜索品牌/型号/资产编号/IMEI/领用人/序列号/经手人/原归属..." clearable style="width:300px">
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
      <el-select v-model="filterRecipient" placeholder="全部领用人" clearable filterable style="width:140px">
        <el-option v-for="r in recipients" :key="r" :label="r" :value="r" />
      </el-select>
      <el-select v-model="dateType" placeholder="日期类型" style="width:100px">
        <el-option label="到货时间" value="arrivalDate" />
        <el-option label="领用时间" value="pickupDate" />
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
            <el-dropdown-item command="all" :disabled="store.phones.length === 0">导出全部 CSV（{{ store.phones.length }}）</el-dropdown-item>
            <el-dropdown-item command="filtered-xlsx" :disabled="filteredCount === 0">导出筛选结果 Excel</el-dropdown-item>
            <el-dropdown-item command="all-xlsx" :disabled="store.phones.length === 0">导出全部 Excel</el-dropdown-item>
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
      :row-class-name="rowClass"
    >
      <template #empty>
        <div class="empty-block">
          <span class="empty-text">{{ emptyText }}</span>
          <el-button v-if="hasActiveFilters" size="small" type="primary" text @click="resetFilters">清空筛选</el-button>
        </div>
      </template>
      <el-table-column type="selection" width="40" />
      <el-table-column v-if="colOn('assetNumber')" prop="assetNumber" label="资产编号" width="140" fixed sortable />
      <el-table-column v-if="colOn('brand')" prop="brand" label="品牌" width="110" sortable />
      <el-table-column v-if="colOn('model')" prop="model" label="型号" min-width="120" show-overflow-tooltip sortable />
      <el-table-column v-if="colOn('imei')" prop="imei" label="IMEI/MEID" width="150" show-overflow-tooltip />
      <el-table-column v-if="colOn('department')" prop="department" label="领用部门" width="130" sortable />
      <el-table-column v-if="colOn('recipient')" prop="recipient" label="领用人" width="80" sortable />
      <el-table-column v-if="colOn('purchaseType')" prop="purchaseType" label="采购类型" width="90" sortable align="center">
        <template #default="{ row }">
          <el-tag :type="row.purchaseType === '换' ? 'warning' : 'success'" size="small" effect="plain">{{ row.purchaseType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="colOn('handler')" prop="handler" label="经手人" width="80" show-overflow-tooltip />
      <el-table-column v-if="colOn('arrivalDate')" prop="arrivalDate" label="到货时间" width="110" sortable :sort-method="sortByArrivalDate" />
      <el-table-column v-if="colOn('pickupDate')" prop="pickupDate" label="领用时间" width="110" sortable :sort-method="sortByPickupDate" />
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
        <div class="drawer-section">
          <div class="drawer-section-title">📜 最近变更</div>
          <div v-if="rowLogs.length === 0" class="drawer-empty">暂无变更记录</div>
          <div v-for="log in rowLogs" :key="log.id" class="log-item">
            <span class="log-action" :class="logActionClass(log.action)">{{ log.action }}</span>
            <span class="log-meta">{{ log.operator }} · {{ log.created_at }}</span>
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
    <input v-if="canEdit" ref="fileInput" type="file" accept=".csv,.xlsx" style="display:none" @change="handleImport" />
    <!-- 模板下载入口（仅管理员可见） -->
    <el-button v-if="canEdit" size="small" text @click="downloadTemplate" style="margin-left:auto">下载导入模板</el-button>
    <!-- 回收站入口（仅管理员可见） -->
    <el-button v-if="canEdit" size="small" text type="warning" @click="openTrash">♻ 回收站</el-button>

    <!-- 回收站抽屉 -->
    <el-drawer v-model="trashVisible" title="回收站（已软删除记录）" size="520px">
      <div v-if="trashRows.length === 0" class="empty-block" style="padding:40px"><span class="empty-text">回收站为空</span></div>
      <div v-for="r in trashRows" :key="r.id" class="trash-item">
        <div class="trash-body">
          <span class="trash-title">{{ r.brand }} {{ r.model }}</span>
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
import { usePhoneProcurementStore } from '../../stores/procurement'
import type { PhoneProcurement } from '../../stores/procurement'
import { Search, Delete, Setting, Download, ArrowDown, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchDict } from '../../api/admin'
import { fetchLogs } from '../../api/admin'
import { useAuthStore } from '../../stores/auth'
import { downloadCsv, escapeCsvField } from '../../utils/csv'
import { downloadXlsx, parseXlsx } from '../../utils/excel'
import { fetchPhoneTrash, restorePhone, purgePhone } from '../../api/phone-procurement'

const store = usePhoneProcurementStore()
const authStore = useAuthStore()
const canEdit = computed(() => authStore.isAdmin)
const route = useRoute()
const router = useRouter()

// ===== 列显隐配置 =====
const COL_KEYS: { key: string; label: string }[] = [
  { key: 'assetNumber', label: '资产编号' },
  { key: 'brand', label: '品牌' },
  { key: 'model', label: '型号' },
  { key: 'imei', label: 'IMEI/MEID' },
  { key: 'department', label: '领用部门' },
  { key: 'recipient', label: '领用人' },
  { key: 'purchaseType', label: '采购类型' },
  { key: 'handler', label: '经手人' },
  { key: 'arrivalDate', label: '到货时间' },
  { key: 'pickupDate', label: '领用时间' },
]
const DEFAULT_VISIBLE_COLS = COL_KEYS.map(c => c.key)
const visibleCols = ref<string[]>(DEFAULT_VISIBLE_COLS.slice())
function colOn(key: string) { return visibleCols.value.includes(key) }

// 行高亮：未领用 / 换机无原归属 加警告底色
function rowClass({ row }: { row: PhoneProcurement }) {
  const cls: string[] = []
  if (!row.pickupDate) cls.push('row-warn-pickup')
  if (row.purchaseType === '换' && !row.originalOwner) cls.push('row-warn-exchange')
  return cls.join(' ')
}

// 字典数据
const departmentOptions = ref<string[]>([])
const handlerOptions = ref<string[]>([])
const phoneBrandOptions = ref<string[]>([])
const phoneModelMap = ref<Record<string, string[]>>({})

const tableRef = ref()
const fileInput = ref<HTMLInputElement>()
const formRef = ref()
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const returnToDrawer = ref(false)   // 标记编辑是否从抽屉进入，保存后据此回抽屉
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
const filterRecipient = ref('')
const dateRange = ref<[string, string] | null>(null)
const dateType = ref<'arrivalDate' | 'pickupDate'>('arrivalDate')
const page = ref(1)
const pageSize = ref(10)

// 筛选条件变化时重置分页
watch([search, filterDepartment, filterPurchaseType, filterBrand, filterRecipient, dateRange, dateType], () => { page.value = 1 })

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
  imei: [{ pattern: /^(\d{15}|[0-9A-Fa-f]{14})$/, message: 'IMEI 为 15 位数字，MEID 为 14 位十六进制字符', trigger: 'blur' }],
}

// ===== 筛选状态持久化到 URL query =====
function applyFiltersFromQuery() {
  const q = route.query
  const s = (q['p_search'] as string) || ''
  searchInput.value = s
  search.value = s
  filterDepartment.value = (q['p_dept'] as string) || ''
  filterPurchaseType.value = (q['p_ptype'] as string) || ''
  filterBrand.value = (q['p_brand'] as string) || ''
  filterRecipient.value = (q['p_recip'] as string) || ''
  const dstart = (q['p_dstart'] as string) || ''
  const dend = (q['p_dend'] as string) || ''
  dateRange.value = (dstart && dend) ? [dstart, dend] : null
  const dtype = (q['p_dtype'] as string) || 'arrivalDate'
  dateType.value = (dtype === 'pickupDate' ? 'pickupDate' : 'arrivalDate')
}
function syncFiltersToQuery() {
  const q: Record<string, string> = { ...route.query as Record<string, string> }
  const set = (k: string, v: string) => { if (v) q[k] = v; else delete q[k] }
  set('p_search', search.value)
  set('p_dept', filterDepartment.value)
  set('p_ptype', filterPurchaseType.value)
  set('p_brand', filterBrand.value)
  set('p_recip', filterRecipient.value)
  set('p_dstart', dateRange.value?.[0] || '')
  set('p_dend', dateRange.value?.[1] || '')
  set('p_dtype', dateType.value === 'pickupDate' ? 'pickupDate' : '')
  router.replace({ query: q })
}
// 筛选条件变化时同步到 URL（非 immediate，首次挂载由 applyFiltersFromQuery 先读）
watch([search, filterDepartment, filterPurchaseType, filterBrand, filterRecipient, dateRange, dateType], syncFiltersToQuery)

// ===== 筛选相关 =====
function resetFilters() {
  searchInput.value = ''
  search.value = ''
  filterDepartment.value = ''
  filterPurchaseType.value = ''
  filterBrand.value = ''
  filterRecipient.value = ''
  dateRange.value = null
  dateType.value = 'arrivalDate'
  page.value = 1
}

const departments = computed(() => departmentOptions.value.length ? departmentOptions.value : [...new Set(store.phones.map(p => p.department))].sort())
const brands = computed(() => phoneBrandOptions.value.length ? phoneBrandOptions.value : [...new Set(store.phones.map(p => p.brand))].sort())
const handlers = computed(() => handlerOptions.value.length ? handlerOptions.value : [...new Set(store.phones.map(p => p.handler).filter(Boolean))].sort())
const recipients = computed(() => [...new Set(store.phones.map(p => p.recipient).filter(Boolean))].sort())

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
  if (filterRecipient.value) data = data.filter(p => p.recipient === filterRecipient.value)
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    const [start, end] = dateRange.value
    const prop = dateType.value
    data = data.filter(p => {
      const v = (p as any)[prop] as string | undefined
      return v && v >= start && v <= end
    })
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
      p.serialNo.toLowerCase().includes(q) ||
      p.handler.toLowerCase().includes(q) ||
      p.originalOwner.toLowerCase().includes(q) ||
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

// 是否有激活的筛选条件（用于空状态「清空筛选」按钮显隐）
const hasActiveFilters = computed(() =>
  !!search.value || !!filterDepartment.value || !!filterPurchaseType.value ||
  !!filterBrand.value || !!filterRecipient.value || !!dateRange.value
)

// ===== 操作函数 =====
// 日期列自定义排序工厂（空值统一沉底）
function makeDateSorter(prop: string) {
  return (a: PhoneProcurement, b: PhoneProcurement) => {
    const va = (a as any)[prop] || ''
    const vb = (b as any)[prop] || ''
    if (!va && !vb) return 0
    if (!va) return 1
    if (!vb) return -1
    return va.localeCompare(vb)
  }
}
const sortByArrivalDate = makeDateSorter('arrivalDate')
const sortByPickupDate = makeDateSorter('pickupDate')

function handleSelectionChange(rows: PhoneProcurement[]) {
  selectedRows.value = rows
}

function clearSelection() {
  tableRef.value?.clearSelection()
}

function openDrawer(row: PhoneProcurement) {
  selectedRow.value = row
  drawerVisible.value = true
  loadRowLogs(row)
}

// 详情抽屉：该条最近变更日志（拉 module=手机采购 全量，客户端按 target 过滤）
interface LogRow { id: number; action: string; target: string; operator: string; created_at: string }
const rowLogs = ref<LogRow[]>([])
async function loadRowLogs(row: PhoneProcurement) {
  rowLogs.value = []
  try {
    const data = await fetchLogs({ module: '手机采购', pageSize: 9999 }) as { rows: LogRow[] }
    const targets = [row.model, `${row.brand} ${row.model}`, row.assetNumber, `ID:${row.id}`].filter(Boolean)
    rowLogs.value = data.rows
      .filter(l => targets.some(t => l.target === t))
      .slice(0, 5)
  } catch { /* 日志加载失败静默 */ }
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
const formDirty = computed(() =>
  form.assetNumber || form.partNo || form.serialNo || form.imei ||
  form.arrivalDate || form.pickupDate || form.brand || form.model ||
  form.assetLink || form.department || form.handler || form.recipient ||
  form.dingtalkCreator || form.dingtalkFlow || form.originalOwner || form.notes
)
// 编辑模式记录原始快照，用于判断是否改动
const editingSnapshot = ref<string>('')
function snapshotForm(): string { return JSON.stringify({ ...form }) }
function onDialogClose(done: () => void) {
  // 新增模式：有填写才确认；编辑模式：有改动才确认
  const needConfirm = editingId.value
    ? snapshotForm() !== editingSnapshot.value
    : formDirty.value
  if (needConfirm) {
    ElMessageBox.confirm('表单内容已改动，确定关闭？', '提示', { type: 'warning' })
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
  editingSnapshot.value = snapshotForm()
  returnToDrawer.value = drawerVisible.value   // 若抽屉正开则记 true，保存后回抽屉
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
  // IMEI/MEID 查重（排除编辑自身）
  if (form.imei) {
    const dup = store.phones.find(p => p.imei === form.imei && p.id !== editingId.value)
    if (dup) {
      ElMessage.warning(`IMEI/MEID 已存在（资产编号 ${dup.assetNumber || dup.model}），请核对后再保存`)
      return
    }
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
    // 编辑保存后若此前从抽屉进入，则同步 selectedRow 为更新后的行并重新打开抽屉
    if (editingId.value && returnToDrawer.value) {
      const updated = store.phones.find(p => p.id === editingId.value)
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

async function handleDelete(row: PhoneProcurement) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.brand} ${row.model}」（${row.assetNumber}）吗？`, '确认删除', { type: 'warning' })
    await store.deletePhone(row.id)
    ElMessage.success('删除成功')
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}

// ===== 导出 =====
const CSV_HEADERS = ['资产编号','Part No','Serial No','IMEI/MEID','到货时间','领用时间','品牌','型号','资产关联','领用部门','经手人','领用人','钉钉流程创建人','换/新购','钉钉流程','原手机归属','备注'].join(',')
const XLSX_HEADERS = ['资产编号','Part No','Serial No','IMEI/MEID','到货时间','领用时间','品牌','型号','资产关联','领用部门','经手人','领用人','钉钉流程创建人','换/新购','钉钉流程','原手机归属','备注']
function toRowArr(p: PhoneProcurement): (string | number | boolean)[] {
  return [p.assetNumber, p.partNo, p.serialNo, p.imei, p.arrivalDate, p.pickupDate, p.brand, p.model, p.assetLink, p.department, p.handler, p.recipient, p.dingtalkCreator, p.purchaseType, p.dingtalkFlow, p.originalOwner, p.notes]
}
function toCsvRow(p: PhoneProcurement) {
  return toRowArr(p).map(escapeCsvField).join(',')
}
function batchExport() {
  if (!selectedRows.value.length) { ElMessage.warning('请先选择要导出的记录'); return }
  downloadCsv(CSV_HEADERS, selectedRows.value.map(toCsvRow), '手机采购选中记录')
}

// 导出下拉命令：CSV / Excel
function onExportCmd(cmd: string) {
  if (cmd === 'filtered' || cmd === 'filtered-xlsx') {
    if (filteredCount.value === 0) { ElMessage.warning('当前筛选结果为空'); return }
    const rows = filteredData.value.map(toRowArr)
    if (cmd === 'filtered') downloadCsv(CSV_HEADERS, filteredData.value.map(toCsvRow), '手机采购筛选结果')
    else downloadXlsx(XLSX_HEADERS, rows, '手机采购筛选结果')
    ElMessage.success(`已导出筛选结果 ${filteredCount.value} 条`)
  } else if (cmd === 'all' || cmd === 'all-xlsx') {
    if (store.phones.length === 0) { ElMessage.warning('暂无可导出的数据'); return }
    const rows = store.phones.map(toRowArr)
    if (cmd === 'all') downloadCsv(CSV_HEADERS, store.phones.map(toCsvRow), '手机采购全部记录')
    else downloadXlsx(XLSX_HEADERS, rows, '手机采购全部记录')
    ElMessage.success(`已导出全部 ${store.phones.length} 条`)
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
            // 用后端 /trash/restore 恢复原记录（保持 id/资产号不变），而非 addPhone 新增
            try {
              await restorePhone(rows.map(r => r.id))
              ElMessage.success('已撤销删除')
              await store.loadPhones()
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

// 下载导入模板（表头顺序与 handleImport 解析一致，共 17 列）
function downloadTemplate() {
  const header = '资产编号,Part No,Serial No,IMEI/MEID,到货时间,领用时间,品牌,型号,资产关联,领用部门,经手人,领用人,钉钉流程创建人,换/新购,钉钉流程,原手机归属,备注'
  const sample = 'IT-PH-2024-001,P-A1234,S-5678,123456789012345,2024-06-01,2024-06-05,Apple,iPhone 15,IT-PC-2024-001,研发部,李四,张三,王五,新购,DLG-2024-0001,,新机领用'
  downloadCsv(header, [sample], '手机采购导入模板')
}
// 解析后的统一处理（CSV 和 Excel 共用）：表头映射 + IMEI 查重 + dry-run 预览 + 提交
async function processImportFromGrid(headers: string[], rows: string[][]) {
  const HEADER_MAP: Record<string, string> = {
    '资产编号': 'assetNumber', 'Part No': 'partNo', 'Serial No': 'serialNo',
    'IMEI/MEID': 'imei', '到货时间': 'arrivalDate', '领用时间': 'pickupDate',
    '品牌': 'brand', '型号': 'model', '资产关联': 'assetLink',
    '领用部门': 'department', '经手人': 'handler', '领用人': 'recipient',
    '钉钉流程创建人': 'dingtalkCreator', '换/新购': 'purchaseType',
    '钉钉流程': 'dingtalkFlow', '原手机归属': 'originalOwner', '备注': 'notes',
  }
  const colIndex: Record<string, number> = {}
  headers.forEach((h, i) => {
    const field = HEADER_MAP[h]
    if (field) colIndex[field] = i
  })
  const matchedFields = Object.keys(colIndex)
  if (matchedFields.length === 0) {
    ElMessage.error('未识别到任何表头，请确认首行含中文表头（可先下载导入模板对照）')
    if (fileInput.value) fileInput.value.value = ''
    return
  }
  const outRows: any[] = []
  let skippedEmpty = 0
  let skippedDupImei = 0
  const skippedDupImeiLines: number[] = []
  const seenImeis = new Set<string>()
  const existImeis = new Set(store.phones.map(p => p.imei).filter(Boolean))
  rows.forEach((cols, i) => {
    const get = (field: string) => cols[colIndex[field]] ?? ''
    if (cols.every(c => !c)) { skippedEmpty++; return }
    const imei = get('imei')
    if (imei) {
      if (existImeis.has(imei) || seenImeis.has(imei)) { skippedDupImei++; skippedDupImeiLines.push(i + 2); return }
      seenImeis.add(imei)
    }
    outRows.push({
      assetNumber: get('assetNumber'), partNo: get('partNo'),
      serialNo: get('serialNo'), imei, arrivalDate: get('arrivalDate'),
      pickupDate: get('pickupDate'), brand: get('brand'), model: get('model'),
      assetLink: get('assetLink'), department: get('department'), handler: get('handler'),
      recipient: get('recipient'), dingtalkCreator: get('dingtalkCreator'),
      purchaseType: get('purchaseType') || '新购', dingtalkFlow: get('dingtalkFlow'),
      originalOwner: get('originalOwner'), notes: get('notes'),
    })
  })
  try {
    if (outRows.length === 0) {
      ElMessage.warning('解析后无可导入的有效行，请检查表头或下载模板对照')
      return
    }
    const skippedTotal = skippedEmpty + skippedDupImei
    const summaryLines: string[] = [`将导入 <b style="color:var(--ops-accent-blue)">${outRows.length}</b> 条记录`]
    if (matchedFields.length < 17) summaryLines.push(`识别 <b>${matchedFields.length}/17</b> 列`)
    if (skippedTotal) summaryLines.push(`跳过 <b style="color:#e6a23c">${skippedTotal}</b> 行（空行 ${skippedEmpty} / IMEI 重复 ${skippedDupImei}）`)
    if (skippedDupImeiLines.length) summaryLines.push(`<div style="font-size:12px;color:var(--ops-text-tertiary);margin-top:8px">IMEI 重复行：${skippedDupImeiLines.join(', ')}</div>`)
    try {
      await ElMessageBox.confirm(summaryLines.join('<br>'), '导入预览', {
        dangerouslyUseHTMLString: true, confirmButtonText: '确认导入', cancelButtonText: '取消',
        type: skippedTotal || matchedFields.length < 17 ? 'warning' : 'info',
      })
    } catch { ElMessage.info('已取消导入'); return }
    const result = await store.batchImport(outRows)
    ElMessage[result.errors?.length ? 'warning' : 'success'](`导入 ${result.imported} 条${result.errors?.length ? `，${result.errors.length} 条失败: ${result.errors[0]}` : ''}`)
  } catch (e: any) {
    ElMessage.error(e.message || '导入失败')
  }
  if (fileInput.value) fileInput.value.value = ''
}
function handleImport(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  const isXlsx = f.name.toLowerCase().endsWith('.xlsx')
  if (isXlsx) {
    parseXlsx(f).then(({ headers, rows }) => {
      if (rows.length === 0) { ElMessage.error('Excel 文件为空或仅有表头'); if (fileInput.value) fileInput.value.value = ''; return }
      return processImportFromGrid(headers, rows)
    }).catch((e: any) => {
      ElMessage.error(e.message || 'Excel 导入失败')
      if (fileInput.value) fileInput.value.value = ''
    })
    return
  }
  // CSV 路径
  const r = new FileReader()
  r.onload = async () => {
    const text = r.result as string
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) { ElMessage.error('CSV 文件为空'); return }
    const headers = lines[0].split(',').map(c => c.replace(/^"|"$/g, '').trim())
    const rows = lines.slice(1).map(line => line.split(',').map(c => c.replace(/^"|"$/g, '').trim()))
    await processImportFromGrid(headers, rows)
  }
  r.readAsText(f)
}

// 按记录 id 打开详情抽屉（供概览跳转调用）
function openRowDrawer(id: number) {
  const row = store.phones.find(p => p.id === id)
  if (row) openDrawer(row)
}

// ===== 回收站（#29 软删除）=====
const trashVisible = ref(false)
const trashRows = ref<any[]>([])
async function openTrash() {
  trashVisible.value = true
  try {
    const data = await fetchPhoneTrash()
    trashRows.value = data.list || []
  } catch (e: any) {
    ElMessage.error(e.message || '加载回收站失败')
  }
}
async function restoreTrash(ids: number[]) {
  if (!ids.length) return
  try {
    await restorePhone(ids)
    ElMessage.success(`已恢复 ${ids.length} 条`)
    trashRows.value = trashRows.value.filter(r => !ids.includes(r.id))
    await store.loadPhones()
  } catch (e: any) { ElMessage.error(e.message || '恢复失败') }
}
async function purgeTrash(ids: number[]) {
  if (!ids.length) return
  try {
    await ElMessageBox.confirm(`确定永久删除 ${ids.length} 条记录吗？此操作不可恢复`, '永久删除', { type: 'warning', confirmButtonText: '永久删除', cancelButtonText: '取消' })
  } catch { return }
  try {
    await purgePhone(ids)
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
    return true
  } catch (e) {
    console.error('加载字典数据失败:', e)
    ElMessage.warning('手机型号字典加载失败，请刷新重试')
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

/* 筛选栏 */
.filter-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filter-count { font-size: 12px; color: var(--ops-text-tertiary); }
.empty-block { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px; }
.empty-text { font-size: 13px; color: var(--ops-text-tertiary); }

/* 表格操作按钮横排 */
.action-btns { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.read-only-hint { font-size: 11px; color: var(--ops-text-tertiary); }
.trash-item { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--ops-border-card); }
.trash-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.trash-title { font-size: 13px; color: var(--ops-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trash-meta { font-size: 11px; color: var(--ops-text-tertiary); }

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
:deep(.el-table__body tr.row-warn-pickup td.el-table__cell) {
  background: rgba(230, 162, 60, 0.12) !important;
}
:deep(.el-table__body tr.row-warn-exchange td.el-table__cell) {
  background: rgba(245, 108, 108, 0.12) !important;
}
:deep(.el-table__body tr.row-warn-pickup.row-warn-exchange td.el-table__cell) {
  background: rgba(230, 162, 60, 0.22) !important;
}
:deep(.el-table__body tr.row-warn-pickup:hover td.el-table__cell),
:deep(.el-table__body tr.row-warn-exchange:hover td.el-table__cell) {
  background: rgba(88, 166, 255, 0.08) !important;
}
</style>
