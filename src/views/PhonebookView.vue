<template>
  <div class="phonebook-page">
    <div class="top-bar">
      <button class="back-btn" @click="$router.push('/phones')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回</span>
      </button>
      <h3>电话簿管理 <span class="top-count">{{ contacts.length }} 条</span></h3>
      <div class="top-actions">
        <el-input v-model="searchInput" placeholder="搜索姓名/号码/部门..." clearable size="small" style="width:200px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filterType" placeholder="全部类型" clearable size="small" style="width:100px">
          <el-option label="内部" value="internal" />
          <el-option label="外部" value="external" />
        </el-select>
        <el-button size="small" @click="syncFromPbx" :loading="syncing">
          <el-icon><Refresh /></el-icon> PBX 同步
        </el-button>
        <el-button size="small" @click="openAdd">新增</el-button>
        <el-dropdown @command="handleAction" trigger="click">
          <el-button size="small">更多 <el-icon><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="import">导入 Excel</el-dropdown-item>
              <el-dropdown-item command="deploy" :disabled="!contacts.length">推送电话簿</el-dropdown-item>
              <el-dropdown-item command="batchDelete" :disabled="!selectedIds.length" divided>批量删除 ({{ selectedIds.length }})</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <el-table :data="pagedData" stripe @selection-change="onSelectionChange" v-loading="loading" style="width:100%">
      <el-table-column type="selection" width="40" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="number" label="号码" width="120" />
      <el-table-column prop="department" label="部门" min-width="120" />
      <el-table-column prop="position" label="职位" width="100" />
      <el-table-column label="类型" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.type === 'internal' ? 'success' : 'info'" size="small">{{ row.type === 'internal' ? '内部' : '外部' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="notes" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination" v-if="filteredContacts.length > pageSize">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[20, 50, 100, 200]" :total="filteredContacts.length" layout="total, sizes, prev, pager, next" small @update:page-size="savePageSize" />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑联系人' : '新增联系人'" width="480px" destroy-on-close>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="70px">
        <el-form-item label="姓名" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="号码" prop="number"><el-input v-model="form.number" placeholder="分机号或手机号" /></el-form-item>
        <el-form-item label="部门"><el-input v-model="form.department" /></el-form-item>
        <el-form-item label="职位"><el-input v-model="form.position" /></el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio value="internal">内部</el-radio>
            <el-radio value="external">外部</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 推送弹窗 -->
    <el-dialog v-model="deployVisible" title="推送电话簿到话机" width="600px" destroy-on-close>
      <div v-if="phones.length === 0" style="text-align:center;padding:20px;color:var(--ops-text-tertiary)">暂无在线话机</div>
      <div v-else>
        <el-input v-model="phoneSearch" placeholder="搜索分机号或 IP..." clearable size="small" style="width:100%;margin-bottom:12px" />
        <el-checkbox v-model="selectAll" @change="toggleSelectAll" style="margin-bottom:12px">全选 ({{ filteredPhones.length }})</el-checkbox>
        <div style="max-height:300px;overflow-y:auto">
        <el-checkbox-group v-model="deployPhones">
          <div v-for="p in filteredPhones" :key="p.id" style="padding:4px 0">
            <el-checkbox :value="p.id">{{ p.extension }} — {{ p.ip || '无IP' }} <el-tag size="small" type="success">在线</el-tag></el-checkbox>
          </div>
        </el-checkbox-group>
        </div>
        <div style="margin-top:16px">
          <el-radio-group v-model="deployMode">
            <el-radio value="remote">远程 XML 电话簿</el-radio>
            <el-radio value="local">本地联系人</el-radio>
            <el-radio value="both">两者都推送</el-radio>
          </el-radio-group>
        </div>
      </div>
      <template #footer>
        <el-button @click="deployVisible = false">取消</el-button>
        <el-button type="primary" @click="doDeploy" :loading="deploying" :disabled="!deployPhones.length">推送 ({{ deployPhones.length }})</el-button>
      </template>
    </el-dialog>

    <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" style="display:none" @change="handleImport" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, ArrowDown } from '@element-plus/icons-vue'
import * as phonebookApi from '../api/phonebook'
import type { PhonebookContact } from '../api/phonebook'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'

const route = useRoute()
const router = useRouter()

const fileInput = ref<HTMLInputElement>()
const loading = ref(false)
const contacts = ref<PhonebookContact[]>([])
const { searchInput, search } = useDebouncedSearch()
// 从 URL 恢复筛选状态
searchInput.value = (route.query.search as string) || ''
const filterType = ref((route.query.type as string) || '')
const page = ref(1)
const pageSize = ref(parseInt(localStorage.getItem('phonebook_pageSize') || '50'))
function savePageSize(size: number) { localStorage.setItem('phonebook_pageSize', String(size)) }
const selectedIds = ref<number[]>([])

// 筛选同步到 URL
watch([search, filterType], () => {
  router.replace({ query: { search: search.value || undefined, type: filterType.value || undefined } })
})

watch([search, filterType], () => { page.value = 1 })

const filteredContacts = computed(() => {
  let data = contacts.value
  if (filterType.value) data = data.filter(c => c.type === filterType.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    data = data.filter(c => c.name?.toLowerCase().includes(q) || c.number?.toLowerCase().includes(q) || c.department?.toLowerCase().includes(q))
  }
  return data
})
const pagedData = computed(() => { const s = (page.value - 1) * pageSize.value; return filteredContacts.value.slice(s, s + pageSize.value) })

async function loadContacts() {
  loading.value = true
  try {
    contacts.value = await phonebookApi.fetchPhonebook()
  } catch (e: any) {
    ElMessage.error(e.message || '加载电话簿失败')
  } finally { loading.value = false }
}

onMounted(loadContacts)

// 新增/编辑
const dialogVisible = ref(false)
const editId = ref<number | null>(null)
const formRef = ref()
const saving = ref(false)
const form = reactive({ name: '', number: '', department: '', position: '', type: 'external' as 'internal' | 'external', notes: '' })
const rules = { name: [{ required: true, message: '请输入姓名', trigger: 'blur' }], number: [{ required: true, message: '请输入号码', trigger: 'blur' }] }

function openAdd() { editId.value = null; Object.assign(form, { name: '', number: '', department: '', position: '', type: 'external' as const, notes: '' }); dialogVisible.value = true }
function openEdit(row: PhonebookContact) { editId.value = row.id; Object.assign(form, row); dialogVisible.value = true }

async function handleSave() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    if (editId.value) {
      await phonebookApi.updateContact(editId.value, { ...form })
      ElMessage.success('修改成功')
    } else {
      await phonebookApi.createContact({ ...form })
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadContacts()
  } catch (e: any) { ElMessage.error(e.message || '操作失败') }
  finally { saving.value = false }
}

async function handleDelete(row: PhonebookContact) {
  try {
    await ElMessageBox.confirm(`确定删除联系人「${row.name}」？`, '删除确认', { type: 'warning' })
  } catch { return }
  try {
    await phonebookApi.deleteContact(row.id)
    ElMessage.success('已删除')
    loadContacts()
  } catch (e: any) { ElMessage.error(e.message || '删除失败') }
}

function onSelectionChange(rows: PhonebookContact[]) { selectedIds.value = rows.map(r => r.id) }

async function handleAction(cmd: string) {
  if (cmd === 'import') fileInput.value?.click()
  else if (cmd === 'deploy') openDeploy()
  else if (cmd === 'batchDelete') {
    try {
      await ElMessageBox.confirm(`确定删除 ${selectedIds.value.length} 条联系人？`, '批量删除', { type: 'warning' })
    } catch { return }
    try {
      await phonebookApi.batchDeleteContacts(selectedIds.value)
      ElMessage.success('已删除')
      loadContacts()
    } catch (e: any) { ElMessage.error(e.message || '批量删除失败') }
  }
}

// PBX 同步
const syncing = ref(false)
async function syncFromPbx() {
  syncing.value = true
  try {
    const result = await phonebookApi.syncFromPbx()
    ElMessage.success(`同步完成，${result.synced} 个分机`)
    // 如果返回了联系人列表直接使用，否则重新加载
    if ((result as any).list) {
      contacts.value = (result as any).list
    } else {
      loadContacts()
    }
  } catch (e: any) { ElMessage.error(e.message || '同步失败') }
  finally { syncing.value = false }
}

// 推送
const deployVisible = ref(false)
const deployPhones = ref<string[]>([])
const deployMode = ref('remote')
const deploying = ref(false)
const selectAll = ref(false)
const phones = ref<any[]>([])
const phoneSearch = ref('')
const filteredPhones = computed(() => {
  if (!phoneSearch.value) return phones.value
  const q = phoneSearch.value.toLowerCase()
  return phones.value.filter((p: any) =>
    p.extension?.toLowerCase().includes(q) || (p.ip || '').toLowerCase().includes(q)
  )
})

async function openDeploy() {
  deployPhones.value = []
  selectAll.value = false
  try {
    phones.value = await phonebookApi.fetchOnlinePhones()
  } catch { phones.value = [] }
  deployVisible.value = true
}
function toggleSelectAll(v: boolean) { deployPhones.value = v ? phones.value.map((p: any) => p.id) : [] }

async function doDeploy() {
  deploying.value = true
  try {
    const result = await phonebookApi.deployPhonebook(deployPhones.value, deployMode.value)
    ElMessage.success(`推送完成：成功 ${result.success}，失败 ${result.failed}`)
    deployVisible.value = false
  } catch (e: any) { ElMessage.error(e.message || '推送失败') }
  finally { deploying.value = false }
}

// 导入
async function handleImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][]
    if (data.length < 2) { ElMessage.warning('文件无数据'); return }
    // 通过表头匹配列顺序
    const headerRow = data[0].map((h: any) => String(h).trim())
    const colMap: Record<string, number> = {}
    const expectedHeaders = ['姓名', '号码', '部门', '职位', '备注']
    expectedHeaders.forEach(name => {
      const idx = headerRow.findIndex((h: string) => h.includes(name))
      if (idx >= 0) colMap[name] = idx
    })
    if (colMap['姓名'] === undefined || colMap['号码'] === undefined) {
      ElMessage.warning('未找到"姓名"和"号码"列，请检查表头')
      ;(e.target as HTMLInputElement).value = ''
      return
    }
    const rows = data.slice(1).filter((r: any[]) => r[colMap['姓名']!] && r[colMap['号码']!]).map((r: any[]) => ({
      name: String(r[colMap['姓名']!]).trim(), number: String(r[colMap['号码']!]).trim(),
      department: String(r[colMap['部门']] || '').trim(), position: String(r[colMap['职位']] || '').trim(),
      type: 'external' as const, notes: String(r[colMap['备注']] || '').trim(),
    }))
    if (!rows.length) { ElMessage.warning('无有效数据'); return }
    const result = await phonebookApi.importContacts(rows)
    ElMessage.success(`导入 ${result.imported} 条`)
    loadContacts()
  } catch (e: any) {
    ElMessage.error(e.message || '导入失败')
  }
  ;(e.target as HTMLInputElement).value = ''
}
</script>

<style scoped>
.phonebook-page { padding: 16px 20px; min-height: 100vh; background: var(--ops-bg-page); }
.top-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.top-bar h3 { margin: 0; flex: 1; font-size: 16px; font-weight: 600; }
.top-count { font-size: 12px; color: var(--ops-text-tertiary); font-weight: 400; }
.top-actions { display: flex; gap: 8px; align-items: center; }
.back-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px 6px 10px; background: var(--ops-bg-card-hover); border: 1px solid var(--ops-border-card); border-radius: 20px; color: var(--ops-text-secondary); cursor: pointer; font-size: 12px; font-family: inherit; transition: all 0.2s ease; }
.back-btn:hover { color: var(--ops-accent-blue); border-color: rgba(88,166,255,0.3); }
.pagination { display: flex; justify-content: center; margin-top: 12px; }
</style>
