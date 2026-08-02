<template>
  <div class="admin-services">
    <div class="page-header">
      <div class="header-left">
        <span class="page-title">服务管理</span>
        <span class="total-text">{{ services.length }} 个服务</span>
      </div>
      <div class="header-actions">
        <el-input v-model="searchText" placeholder="搜索服务..." clearable size="small" :prefix-icon="Search" style="width: 200px" />
        <el-button type="warning" size="small" :loading="servicesStore.checking" @click="servicesStore.checkAllServices()">
          <el-icon><Refresh /></el-icon> 批量检测
        </el-button>
        <el-button type="success" size="small" @click="handleExport">
          <el-icon><Download /></el-icon> 导出 Excel
        </el-button>
        <el-upload :show-file-list="false" :before-upload="handleImport" accept=".xlsx,.csv">
          <el-button type="warning" size="small"><el-icon><Upload /></el-icon> 导入</el-button>
        </el-upload>
        <el-button type="primary" size="small" @click="handleAdd">
          <el-icon><Plus /></el-icon> 添加服务
        </el-button>
      </div>
    </div>

    <el-table :data="filteredServices" v-loading="loading" size="small" style="width: 100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="服务名称" min-width="140" />
      <el-table-column prop="category" label="分类" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ row.category }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="url" label="服务地址" min-width="200" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
      <el-table-column label="部署主机" width="140">
        <template #default="{ row }">
          <span>{{ getHostName(row.hostId) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" text size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button type="success" text size="small" :loading="checkingId === row.id" @click="handleCheck(row)">检测</el-button>
          <el-button type="danger" text size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑服务' : '添加服务'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="90px">
        <div style="display: flex; gap: 16px;">
          <el-form-item label="服务名称" prop="name" style="flex: 1;">
            <el-input v-model="formData.name" placeholder="如：Zabbix 监控" />
          </el-form-item>
          <el-form-item label="分类" prop="category" style="flex: 1;">
            <el-select v-model="formData.category" filterable allow-create placeholder="选择分类" style="width: 100%">
              <el-option v-for="cat in categories" :key="cat.name" :label="cat.name" :value="cat.name" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="服务地址" prop="url">
          <el-input v-model="formData.url" placeholder="如：http://192.168.1.100:8080" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="formData.description" type="textarea" :rows="2" placeholder="简要描述服务功能" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="formData.notes" type="textarea" :rows="3" placeholder="如账号密码、使用说明等" />
        </el-form-item>
        <div style="display: flex; gap: 16px;">
          <el-form-item label="图标" style="flex: 1;">
            <el-select v-model="formData.icon" placeholder="选择图标" style="width: 100%">
              <el-option v-for="icon in iconOptions" :key="icon" :label="icon" :value="icon">
                <el-icon style="margin-right: 8px;"><component :is="resolveIcon(icon)" /></el-icon>
                <span>{{ icon }}</span>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="状态" style="flex: 1;">
            <el-select v-model="formData.status" style="width: 100%">
              <el-option label="在线" value="online" />
              <el-option label="离线" value="offline" />
              <el-option label="维护中" value="maintenance" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="部署主机">
          <el-select v-model="formData.hostId" placeholder="选择主机" clearable style="width: 100%">
            <el-option v-for="h in hosts" :key="h.id" :label="h.name + ' (' + h.ip + ')'" :value="h.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">{{ isEdit ? '保存' : '添加' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Refresh, Download, Upload } from '@element-plus/icons-vue'
import { downloadXlsx, parseXlsx } from '../../utils/excel'
import * as XLSX from 'xlsx'
import { fetchDict } from '../../api/admin'
import { resolveIcon, iconKeys } from '../../utils/icons'
import { useServicesStore } from '../../stores/services'

const servicesStore = useServicesStore()
const services = computed(() => servicesStore.services)
const hosts = ref<any[]>([])
const categories = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const searchText = ref('')
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const editingId = ref<number | null>(null)
const checkingId = ref<number | null>(null)

const iconOptions = iconKeys

const formData = ref({
  name: '',
  url: '',
  description: '',
  notes: '',
  icon: 'Setting',
  category: '',
  status: 'online' as 'online' | 'offline' | 'maintenance',
  hostId: null as number | null,
})

const formRules = {
  name: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
  url: [{ required: true, message: '请输入服务地址', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
}

const filteredServices = computed(() => {
  if (!searchText.value) return services.value
  const q = searchText.value.toLowerCase()
  return services.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.url.toLowerCase().includes(q) ||
    s.description?.toLowerCase().includes(q)
  )
})

function statusType(status: string) {
  return status === 'online' ? 'success' : status === 'offline' ? 'danger' : 'warning'
}

function statusLabel(status: string) {
  return status === 'online' ? '在线' : status === 'offline' ? '离线' : '维护中'
}

function getHostName(hostId: number | null | undefined) {
  if (!hostId) return '-'
  const h = hosts.value.find((h: any) => h.id === hostId)
  return h ? h.name : '-'
}

async function loadData() {
  loading.value = true
  try {
    const [hostData, catData] = await Promise.all([
      fetchDict('service-hosts').catch(() => []),
      fetchDict('service-categories').catch(() => []),
    ])
    await servicesStore.loadServices()
    hosts.value = hostData || []
    categories.value = catData || []
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  isEdit.value = false
  editingId.value = null
  formData.value = { name: '', url: '', description: '', notes: '', icon: 'Setting', category: '', status: 'online' as 'online' | 'offline' | 'maintenance', hostId: null }
  dialogVisible.value = true
}

async function handleCheck(row: any) {
  checkingId.value = row.id
  try {
    const r = await servicesStore.checkService(row.id)
    ElMessage.success(`${row.name} 当前 ${r.status === 'online' ? '在线' : '离线'}（${r.latencyMs ?? '--'}ms）`)
  } catch (e: any) { ElMessage.error(e.message || '检测失败') } finally { checkingId.value = null }
}

function handleEdit(row: any) {
  isEdit.value = true
  editingId.value = row.id
  formData.value = {
    name: row.name,
    url: row.url,
    description: row.description || '',
    notes: row.notes || '',
    icon: row.icon || 'Setting',
    category: row.category || '',
    status: row.status || 'online',
    hostId: row.hostId || null,
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    if (isEdit.value && editingId.value) {
      await servicesStore.updateService(editingId.value, formData.value)
      ElMessage.success('修改成功')
    } else {
      await servicesStore.addService(formData.value)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    await loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除服务「${row.name}」？此操作不可恢复。`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch { return }
  try {
    await servicesStore.deleteService(row.id)
    ElMessage.success('删除成功')
    await loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

/**
 * 解析 .csv 文件为首行表头 + 数据行（结构与 parseXlsx 一致）
 * csv.ts 未提供解析函数，这里用 SheetJS string 模式读取 CSV。
 */
async function parseCsvFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const text = await file.text()
  const wb = XLSX.read(text, { type: 'string' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  if (aoa.length === 0) return { headers: [], rows: [] }
  const headers = (aoa[0] as unknown[]).map(c => String(c ?? '').trim())
  const rows = aoa.slice(1).map(r => (r as unknown[]).map(c => String(c ?? '').trim()))
  return { headers, rows }
}

/**
 * 导出当前服务列表为 Excel
 * downloadXlsx 签名：(headers, rows, filename, sheetName?)，filename 不含扩展名
 */
async function handleExport() {
  const headers = ['名称', '地址', '分类', '主机', '状态', '描述', '备注', '图标']
  const rows = services.value.map(s => [
    s.name, s.url, s.category, getHostName(s.hostId),
    s.status, s.description ?? '', s.notes ?? '', s.icon ?? '',
  ])
  downloadXlsx(headers, rows, '内网服务列表', '服务')
  ElMessage.success('已导出')
}

/**
 * 导入 Excel/CSV 文件，逐行创建服务
 * parseXlsx/parseCsvFile 返回 {headers, rows}，rows 为 string[][]，需转成对象数组再按字段读取
 */
async function handleImport(file: File): Promise<boolean> {
  try {
    const { headers, rows } = file.name.toLowerCase().endsWith('.csv')
      ? await parseCsvFile(file)
      : await parseXlsx(file)
    // 将 [["名称","地址",...], ["a","b",...]] 转成 [{名称:"a",地址:"b"}]
    const records = rows.map(r => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
      return obj
    }).filter(o => o['名称'] && o['名称'].trim()) // 跳过空行

    // 主机名 → id 映射，导入时按"主机"列解析部署主机
    const hostMap = new Map(hosts.value.map((h: any) => [h.name, h.id]))

    let ok = 0, fail = 0
    const failNames: string[] = []
    for (const r of records) {
      try {
        const hostName = (r['主机'] || '').trim()
        const hostId = hostName ? (hostMap.get(hostName) ?? null) : null
        await servicesStore.addService({
          name: r['名称'].trim(),
          url: r['地址'] ?? '',
          category: r['分类'] ?? '',
          status: (r['状态'] || 'online') as 'online' | 'offline' | 'maintenance',
          description: r['描述'] ?? '',
          notes: r['备注'] ?? '',
          icon: r['图标'] || 'Setting',
          hostId, // 按主机名解析；未匹配到则置 null，可后续手动编辑
        })
        ok++
      } catch (e: any) {
        fail++
        failNames.push(`${r['名称']}: ${e.message || '失败'}`)
      }
    }
    ElMessage.success(`导入完成：成功 ${ok} 条，失败 ${fail} 条`)
    if (fail) ElMessage.warning('失败：' + failNames.slice(0, 5).join('；'))
    await loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '文件解析失败')
  }
  return false // 阻止 el-upload 自动上传
}

onMounted(loadData)
</script>

<style scoped>
.admin-services {
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
</style>
