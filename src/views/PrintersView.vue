<template>
  <div class="printers-page">
    <!-- Header — same as PhoneProcurementView -->
    <div class="top-bar">
      <BackButton to="/" />
      <h3>打印机管理 <span class="top-count">{{ store.total }} 台</span></h3>
      <div class="top-actions">
        <el-dropdown @command="handleTopAction" trigger="click">
          <el-button size="small">
            操作 <el-icon><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="template">
                <el-icon><document /></el-icon> 下载模板
              </el-dropdown-item>
              <el-dropdown-item command="import">
                <el-icon><upload /></el-icon> 批量导入
              </el-dropdown-item>
              <el-dropdown-item command="export" divided>
                <el-icon><download /></el-icon> 导出 CSV
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" size="small" @click="openAddDialog">
          <el-icon><Plus /></el-icon> 添加打印机
        </el-button>
      </div>
      <label class="import-auto-check">
        <input type="checkbox" v-model="importAutoCreateDict" /> 自动补录字典缺失项
      </label>
      <input ref="fileInput" type="file" accept=".csv" style="display:none" @change="handleImport" />
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <el-input v-model="searchInput" placeholder="搜索厂商/型号/位置..." clearable size="small" style="width:220px">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <span v-if="selectedIds.size > 0" class="sel-info">
        已选 <strong>{{ selectedIds.size }}</strong> 项
        <button class="sel-del-btn" @click="batchDelete">批量删除</button>
        <button class="sel-clr-btn" @click="selectedIds = new Set()">取消选择</button>
      </span>
      <span v-else class="sel-info dim">共 <strong>{{ store.total }}</strong> 台打印机</span>
    </div>

    <!-- 楼层标签栏 -->
    <div class="floor-tabs">
      <button
        v-for="floor in allFloors"
        :key="floor"
        class="floor-tab"
        :class="{ active: selectedFloor === floor }"
        @click="selectedFloor = floor"
      >
        {{ floor }}
        <span class="floor-tab-count">{{ store.printers.filter(p => p.floor === floor).length }}</span>
      </button>
    </div>

    <!-- 空状态 -->
    <div v-if="floorGroups.length === 0" class="empty-state">
      <span class="empty-icon">🖨️</span><span>暂无打印机数据</span>
    </div>

    <!-- 楼层区块卡片 -->
    <div v-for="group in floorGroups" :key="group.floor" class="floor-card">
      <div class="fc-header">
        <div class="fc-header-left">
          <span class="fc-dot" />
          <span class="fc-floor">{{ group.floor }}</span>
          <span class="fc-badge">{{ group.totalCount }} 台</span>
        </div>
        <label class="fc-check">
          <input type="checkbox" :checked="groupAllSelected(group)" @change="toggleGroupAll(group)" />
          <span>全选</span>
        </label>
      </div>
      <div class="fc-table-wrap">
        <table class="fc-table">
          <thead>
            <tr>
              <th class="col-cb"><input type="checkbox" :checked="groupAllSelected(group)" @change="toggleGroupAll(group)" /></th>
              <th>位置</th>
              <th>厂商</th>
              <th class="col-model">型号</th>
              <th class="col-toner">硒鼓型号</th>
              <th class="col-notes">备注</th>
              <th>状态</th>
              <th class="col-act">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in group.rows" :key="row.printer.id">
              <tr :class="{ selected: row.ids.some(id => selectedIds.has(id)), 'loc-odd': row.locationOdd, 'loc-even': !row.locationOdd }">
                <td class="col-cb">
                  <input type="checkbox" :checked="row.ids.every(id => selectedIds.has(id))" @change="toggleRow(row)" />
                </td>
                <td v-if="row.isFirstInLocation" :rowspan="row.locationSpan" class="cell-location">
                  {{ row.printer.location }}
                </td>
                <td><span class="brand-tag">{{ row.printer.manufacturer }}</span></td>
                <td class="col-model" :title="row.printer.model">
                  {{ row.printer.model }}<span v-if="row.count > 1" class="model-count"> ×{{ row.count }}</span>
                </td>
                <td class="col-toner" :title="row.printer.tonerModel">{{ row.printer.tonerModel || '—' }}</td>
                <td class="col-notes" :title="row.printer.notes">{{ row.printer.notes || '—' }}</td>
                <td>
                  <span class="status-dot" :class="'st-' + row.printer.status" />
                  <span v-if="row.printer.status !== '正常'" class="status-text">{{ row.printer.status }}</span>
                </td>
                <td class="col-act">
                  <button class="row-btn" @click="openEditDialog(row.printer as Printer)">编辑</button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Dialog -->
    <Teleport to="body">
      <div v-if="dialogVisible" class="df-overlay" @click.self="dialogVisible = false">
        <div class="df-dialog">
          <div class="df-header">{{ editingPrinter ? '编辑打印机' : '添加打印机' }}</div>
          <div class="df-body">
            <label class="df-field"><span class="df-label">楼层</span>
              <el-select v-model="form.floor" filterable allow-create placeholder="请选择楼层" style="width:100%">
                <el-option v-for="f in floors" :key="f" :label="f" :value="f" />
              </el-select>
            </label>
            <div class="df-row"><label class="df-field"><span class="df-label">位置</span><input v-model="form.location" class="df-input" placeholder="如 东区茶水间旁" /></label></div>
            <div class="df-row">
              <label class="df-field" style="flex:1"><span class="df-label">厂商</span>
                <el-select v-model="form.manufacturer" filterable allow-create placeholder="请选择厂商" style="width:100%" @change="form.model = ''">
                  <el-option v-for="m in manufacturers" :key="m" :label="m" :value="m" />
                </el-select>
              </label>
            </div>
            <div class="df-row">
              <label class="df-field" style="flex:1"><span class="df-label">型号</span>
                <el-select v-model="form.model" filterable allow-create placeholder="请先选择厂商" :disabled="!form.manufacturer" style="width:100%">
                  <el-option v-for="m in modelOptions" :key="m" :label="m" :value="m" />
                </el-select>
              </label>
            </div>
            <label class="df-field"><span class="df-label">硒鼓型号</span>
              <el-select v-model="form.tonerModel" filterable allow-create placeholder="请选择硒鼓型号" style="width:100%">
                <el-option v-for="t in allTonerModels" :key="t" :label="t" :value="t" />
              </el-select>
            </label>
            <label class="df-field"><span class="df-label">备注</span><input v-model="form.notes" class="df-input" placeholder="备注信息" /></label>
            <div class="df-row">
              <label class="df-field" style="flex:1">
                <span class="df-label">状态</span>
                <el-select v-model="form.status" style="width:100%">
                  <el-option value="正常" /><el-option value="缺墨" /><el-option value="故障" />
                </el-select>
              </label>
              <div style="flex:1" />
            </div>
          </div>
          <div class="df-footer">
            <button class="df-btn df-btn-cancel" @click="dialogVisible = false">取消</button>
            <button class="df-btn df-btn-confirm" :disabled="saving" @click="savePrinter">{{ saving ? '保存中...' : '保存' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePrintersStore } from '../stores/printers'
import type { Printer } from '../mock/printers'
import { exportPrintersCSV, downloadPrinterTemplate, parsePrintersCSV } from '../utils/printer-csv'
import { Plus, ArrowDown, Download, Upload, Document, Search } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { fetchDict } from '../api/admin'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'
import { buildFloorGroups, floorWeight } from '../utils/printer-table-helper'
import type { PrinterTableRow, FloorGroup } from '../utils/printer-table-helper'
import BackButton from '../components/BackButton.vue'

const route = useRoute()
const router = useRouter()
const store = usePrintersStore()

// 导入相关状态
const importAutoCreateDict = ref(false)

// 加载打印机型号字典
onMounted(async () => {
  store.loadPrinters()
  try {
    const [brands, models] = await Promise.all([
      fetchDict('printer-brands'),
      fetchDict('printer-models'),
    ])
    const map: Record<string, string[]> = {}
    for (const brand of brands) {
      const ms = models.filter((m: any) => m.brand_id === brand.id).map((m: any) => m.name)
      if (ms.length) map[brand.name] = ms
    }
    dictModelMap.value = map
  } catch (e) {
    console.error('加载打印机型号字典失败:', e)
  }
})

// 字典数据：从已有打印机提取
const floors = computed(() => [...new Set(store.printers.map(p => p.floor))].sort())
const manufacturers = computed(() => [...new Set(store.printers.map(p => p.manufacturer))].sort())
const allTonerModels = computed(() => [...new Set(store.printers.map(p => p.tonerModel).filter(Boolean))].sort())

// 厂商 → 型号映射（从字典加载 + 已有数据补充）
const dictModelMap = ref<Record<string, string[]>>({})
const manufacturerModels = computed(() => {
  const map = { ...dictModelMap.value }
  for (const p of store.printers) {
    if (p.manufacturer && p.model) {
      if (!map[p.manufacturer]) map[p.manufacturer] = []
      if (!map[p.manufacturer].includes(p.model)) map[p.manufacturer].push(p.model)
    }
  }
  return map
})
const modelOptions = computed(() => {
  if (!form.manufacturer) return []
  return (manufacturerModels.value[form.manufacturer] || []).sort()
})

function handleTopAction(command: string) {
  if (command === 'template') downloadTemplate()
  else if (command === 'import') triggerImport()
  else if (command === 'export') exportCSV()
}

// 搜索
const { searchInput, search: searchQuery } = useDebouncedSearch()
searchInput.value = (route.query.search as string) || ''
watch(searchQuery, (v) => {
  router.replace({ query: { ...route.query, search: v || undefined } })
})

// 楼层排序权重 — 在 helper 中

const allFloors = computed(() => {
  const floors = [...new Set(store.printers.map(p => p.floor))]
  return floors.sort((a, b) => floorWeight(a) - floorWeight(b))
})

const selectedFloor = ref('')
watch(allFloors, (floors) => {
  if (floors.length && !floors.includes(selectedFloor.value)) {
    selectedFloor.value = floors[0]
  }
}, { immediate: true })

const floorGroups = computed(() =>
  buildFloorGroups(store.printers as any, selectedFloor.value, searchQuery.value)
)

const selectedIds = ref(new Set<number>())
function toggleRow(row: PrinterTableRow) { const all = row.ids.every(id => selectedIds.value.has(id)); const n = new Set(selectedIds.value); if (all) row.ids.forEach(id => n.delete(id)); else row.ids.forEach(id => n.add(id)); selectedIds.value = n }
function toggleGroupAll(g: FloorGroup) { const ids = g.rows.flatMap(r => r.ids); const all = ids.every(id => selectedIds.value.has(id)); const n = new Set(selectedIds.value); if (all) ids.forEach(id => n.delete(id)); else ids.forEach(id => n.add(id)); selectedIds.value = n }
function groupAllSelected(g: FloorGroup) { const ids = g.rows.flatMap(r => r.ids); return ids.length > 0 && ids.every(id => selectedIds.value.has(id)) }
async function batchDelete() {
  const count = selectedIds.value.size
  const ids = [...selectedIds.value]
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${count} 台打印机？`, '批量删除', { type: 'warning', confirmButtonText: '删除' })
  } catch { return }
  // 保存被删数据供撤销（剔除 id + 时间戳，避免恢复时主键冲突）
  const deletedData = store.printers
    .filter(p => ids.includes(p.id))
    .map(({ id, createdAt, updatedAt, ...rest }) => rest)
  await store.deletePrinters(ids)
  selectedIds.value = new Set()
  ElMessage({
    message: h('span', null, [
      h('span', null, `已删除 ${count} 台打印机`),
      h('span', {
        style: 'color:var(--ops-accent-blue);cursor:pointer;margin-left:12px;font-weight:600',
        onClick: async () => {
          try {
            await store.restorePrinters(deletedData)
            ElMessage.success('已撤销删除')
          } catch (e: any) {
            ElMessage.error('撤销失败：' + (e.message || ''))
          }
        }
      }, '撤销')
    ]),
    duration: 5000,
  })
}

const fileInput = ref<HTMLInputElement>()
function triggerImport() { fileInput.value?.click() }
function exportCSV() { exportPrintersCSV(store.printers) }
function downloadTemplate() { downloadPrinterTemplate() }
async function handleImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = parsePrintersCSV(text)
    if (data.length) {
      await store.batchImport(data as Printer[], importAutoCreateDict.value)
      ElMessage.success(`导入 ${data.length} 台打印机`)
    }
  } catch (err: any) {
    ElMessage.error(err.message || '导入失败')
  }
  if (fileInput.value) fileInput.value.value = ''
}

const dialogVisible = ref(false); const editingPrinter = ref<Printer | null>(null)
const saving = ref(false)
const form = reactive<Omit<Printer, 'id'>>({ floor: '', location: '', manufacturer: '', model: '', tonerModel: '', notes: '', status: '正常' })
function openAddDialog() { editingPrinter.value = null; Object.assign(form, { floor: '', location: '', manufacturer: '', model: '', tonerModel: '', notes: '', status: '正常' as const }); dialogVisible.value = true }
function openEditDialog(r: Printer) { editingPrinter.value = r; Object.assign(form, { ...r }); dialogVisible.value = true }
async function savePrinter() {
  if (saving.value) return
  if (!form.floor) { ElMessage.warning('请选择楼层'); return }
  if (!form.location.trim()) { ElMessage.warning('请输入位置'); return }
  if (!form.manufacturer) { ElMessage.warning('请选择厂商'); return }
  if (!form.model) { ElMessage.warning('请选择型号'); return }
  saving.value = true
  try {
    if (editingPrinter.value) {
      await store.updatePrinter(editingPrinter.value.id, { ...form, status: form.status as "正常" | "缺墨" | "故障" })
      ElMessage.success('修改成功')
    } else {
      await store.addPrinter({ ...form, status: form.status as "正常" | "缺墨" | "故障" } as Omit<Printer, 'id'>)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.printers-page { padding: 16px 20px; min-height: 100vh; background: var(--ops-bg-page); }

/* Header — same as PhoneProcurementView */
.top-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px 0; border-bottom: 1px solid var(--ops-border-card); }
.top-bar h3 { flex: 1; font-size: 16px; font-weight: 600; color: var(--ops-text-primary); margin: 0; }
.top-actions { display: flex; gap: 8px; align-items: center; }
.import-auto-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ops-text-secondary); margin-left: 8px; white-space: nowrap; cursor: pointer; }
.import-auto-check input { cursor: pointer; accent-color: var(--ops-accent-blue); }
.top-count { font-size: 12px; font-weight: 400; color: var(--ops-text-tertiary); margin-left: 6px; }

/* Toolbar */
.toolbar { display: flex; align-items: center; margin-bottom: 12px; padding: 4px 0; }
.sel-info { font-size: 12px; color: var(--ops-text-tertiary); display: flex; align-items: center; gap: 8px; }
.sel-info.dim { color: var(--ops-text-tertiary); }
.sel-info strong { font-weight: 700; color: var(--ops-text-primary); }

/* 楼层标签栏 */
.floor-tabs { display: flex; gap: 6px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; flex-wrap: wrap; }
.floor-tab { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 12px; cursor: pointer; background: var(--ops-bg-card); border: 1px solid var(--ops-border-card); color: var(--ops-text-secondary); transition: all 0.2s; font-family: inherit; white-space: nowrap; }
.floor-tab:hover { border-color: var(--ops-accent-blue); color: var(--ops-text-primary); }
.floor-tab.active { background: rgba(88,166,255,0.12); border-color: var(--ops-accent-blue); color: var(--ops-accent-blue); font-weight: 600; }
.floor-tab-count { font-size: 10px; background: rgba(88,166,255,0.1); color: var(--ops-accent-blue); padding: 1px 6px; border-radius: 10px; font-weight: 600; }
.sel-del-btn { background: rgba(220,50,50,0.1); color: var(--ops-accent-red); border: 1px solid rgba(220,50,50,0.2); padding: 3px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; }
.sel-del-btn:hover { background: rgba(220,50,50,0.2); }
.sel-clr-btn { background: none; color: var(--ops-text-tertiary); border: 1px solid var(--ops-border-card); padding: 3px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; }
.sel-clr-btn:hover { color: var(--ops-text-primary); }

.empty-state { text-align: center; padding: 80px 20px; color: var(--ops-text-tertiary); }
.empty-icon { font-size: 36px; display: block; margin-bottom: 12px; opacity: 0.35; }

/* ===== 楼层卡片 ===== */
.floor-card {
  margin-bottom: 16px;
  border: 1px solid var(--ops-border-card);
  border-radius: 10px;
  overflow: hidden;
  background: var(--ops-bg-card);
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  transition: box-shadow 0.2s;
}
.floor-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.12); }

.fc-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(135deg, rgba(88,166,255,0.08), rgba(88,166,255,0.02));
  border-bottom: 1px solid var(--ops-border-card);
}
.fc-header-left { display: flex; align-items: center; gap: 8px; }
.fc-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ops-accent-blue); box-shadow: 0 0 8px rgba(88,166,255,0.4); }
.fc-floor { font-size: 14px; font-weight: 700; color: var(--ops-accent-blue); letter-spacing: 0.5px; }
.fc-badge { font-size: 10px; color: var(--ops-text-tertiary); background: var(--ops-bg-card-hover); padding: 2px 8px; border-radius: 10px; border: 1px solid var(--ops-border-card); }
.fc-check { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ops-text-tertiary); cursor: pointer; }
.fc-check input { cursor: pointer; accent-color: var(--ops-accent-blue); }

.fc-table-wrap { overflow-x: auto; }
.fc-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
.fc-table thead th {
  background: var(--ops-bg-card-hover);
  color: var(--ops-text-tertiary);
  font-weight: 600; font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.3px;
  padding: 7px 12px; text-align: center;
  border-bottom: 1px solid var(--ops-border-card);
  white-space: nowrap;
}
.fc-table thead th.col-cb { text-align: center; }
.fc-table thead th.col-act { text-align: center; }
.fc-table tbody td {
  padding: 6px 12px;
  color: var(--ops-text-secondary);
  border-bottom: 1px solid var(--ops-border-card);
  white-space: nowrap; vertical-align: middle; text-align: center;
}
.fc-table tbody tr:last-child td { border-bottom: none; }
.fc-table tbody tr:hover td { background: rgba(88,166,255,0.04); }
.fc-table tbody tr.selected td { background: rgba(88,166,255,0.1) !important; }

/* Columns */
.col-cb { width: 36px; text-align: center !important; }
.col-cb input { cursor: pointer; accent-color: var(--ops-accent-blue); width: 14px; height: 14px; }
.col-model { max-width: 200px; overflow: hidden; text-overflow: ellipsis; font-family: 'SF Mono','Consolas',monospace; font-size: 12px; }
.col-toner { max-width: 180px; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--ops-text-tertiary); }
.cell-location { font-weight: 600; color: var(--ops-text-primary); vertical-align: middle; background: var(--ops-bg-card-hover); border-right: 2px solid var(--ops-accent-blue); padding: 6px 10px; }
.loc-odd { background: rgba(88,166,255,0.04); }
.loc-even { background: transparent; }
.loc-odd .cell-location { background: rgba(88,166,255,0.08); }
.loc-even .cell-location { background: var(--ops-bg-card-hover); }
.model-count { font-size: 11px; color: var(--ops-accent-blue); font-weight: 700; margin-left: 4px; }
.col-notes { max-width: 100px; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--ops-text-tertiary); }
.col-act { width: 60px; }

.brand-tag { font-weight: 600; font-size: 12px; }

.status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.st-正常 { background: var(--ops-accent-green); box-shadow: 0 0 6px rgba(74,222,128,0.5); }
.st-缺墨 { background: var(--ops-accent-yellow); box-shadow: 0 0 6px rgba(251,191,36,0.5); }
.st-故障 { background: var(--ops-accent-red); box-shadow: 0 0 6px rgba(248,113,113,0.5); }
.status-text { font-size: 11px; color: var(--ops-text-tertiary); margin-left: 2px; vertical-align: middle; }

.row-btn { background: none; border: 1px solid transparent; color: var(--ops-text-tertiary); cursor: pointer; font-size: 11px; padding: 3px 8px; border-radius: 4px; transition: all 0.15s; font-family: inherit; }
.row-btn:hover { background: var(--ops-bg-card-hover); color: var(--ops-accent-blue); }

/* Dialog */
.df-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.df-dialog { background: var(--ops-bg-card); border: 1px solid var(--ops-border-card); border-radius: 10px; padding: 20px; width: 600px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
.df-header { font-size: 16px; font-weight: 600; color: var(--ops-text-primary); margin-bottom: 16px; }
.df-body { display: flex; flex-direction: column; gap: 10px; }
.df-field { display: flex; flex-direction: column; gap: 3px; }
.df-label { font-size: 12px; color: var(--ops-text-tertiary); }
.df-input { background: var(--ops-bg-card-hover); border: 1px solid var(--ops-border-card); color: var(--ops-text-primary); border-radius: 6px; padding: 6px 10px; font-size: 13px; outline: none; }
.df-input:focus { border-color: var(--ops-accent-blue); }
.df-row { display: flex; gap: 12px; }
.df-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.df-btn { padding: 6px 16px; border-radius: 6px; border: none; font-size: 13px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.df-btn-cancel { background: var(--ops-bg-card-hover); color: var(--ops-text-secondary); }
.df-btn-confirm { background: rgba(88,166,255,0.12); color: var(--ops-accent-blue); border: 1px solid rgba(88,166,255,0.25); font-weight: 600; }
.df-btn-confirm:hover { background: rgba(88,166,255,0.2); }
</style>
