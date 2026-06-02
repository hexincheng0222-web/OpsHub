<template>
  <div class="printers-page">
    <!-- Header -->
    <div class="page-header">
      <button class="back-btn" @click="$router.push('/')">← 返回</button>
      <span class="header-divider" />
      <h1 class="page-title">打印机管理</h1>
      <div style="flex:1" />
      <div class="header-actions">
        <button class="act-btn" @click="downloadTemplate">📋 下载模板</button>
        <button class="act-btn" @click="triggerImport">📥 批量导入</button>
        <button class="act-btn" @click="exportCSV">📤 导出 CSV</button>
        <button class="act-btn act-btn-primary" @click="openAddDialog">＋ 添加打印机</button>
      </div>
      <input ref="fileInput" type="file" accept=".csv" style="display:none" @change="handleImport" />
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <span v-if="selectedIds.size > 0" class="sel-info">
        已选 <strong>{{ selectedIds.size }}</strong> 项
        <button class="sel-del-btn" @click="batchDelete">批量删除</button>
        <button class="sel-clr-btn" @click="selectedIds = new Set()">取消选择</button>
      </span>
      <span v-else class="sel-info dim">共 <strong>{{ store.total }}</strong> 台打印机</span>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table class="printers-table">
        <thead>
          <tr>
            <th class="col-cb"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></th>
            <th class="col-floor">楼层</th>
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
          <tr v-if="groupedPrinters.length === 0">
            <td colspan="9" class="empty-row">
              <span class="empty-icon">🖨️</span>
              <span>暂无打印机数据</span>
            </td>
          </tr>
          <tr v-for="p in groupedPrinters" :key="p.id" :class="[selectedIds.has(p.id) ? 'selected' : '', 'fg-' + (p.floorIndex % 2)]">
            <td class="col-cb"><input type="checkbox" :checked="selectedIds.has(p.id)" @change="toggleOne(p.id)" /></td>
            <td v-if="p.isFirst" :rowspan="p.floorSpan" class="col-floor">{{ p.floor }}</td>
            <td>{{ p.location }}</td>
            <td><span class="brand-tag">{{ p.manufacturer }}</span></td>
            <td class="col-model" :title="p.model">{{ p.model }}</td>
            <td class="col-toner" :title="p.tonerModel">{{ p.tonerModel || '—' }}</td>
            <td class="col-notes" :title="p.notes">{{ p.notes || '—' }}</td>
            <td>
              <span class="status-dot" :class="'st-' + p.status" />
              <span v-if="p.status !== '正常'" class="status-text">{{ p.status }}</span>
            </td>
            <td class="col-act">
              <button class="row-btn" @click="openEditDialog(p)">编辑</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Dialog -->
    <Teleport to="body">
      <div v-if="dialogVisible" class="df-overlay" @click.self="dialogVisible = false">
        <div class="df-dialog">
          <div class="df-header">{{ editingPrinter ? '编辑打印机' : '添加打印机' }}</div>
          <div class="df-body">
            <div class="df-row">
              <label class="df-field"><span class="df-label">名称</span><input v-model="form.name" class="df-input" placeholder="如 3楼-东区-HP" /></label>
              <label class="df-field"><span class="df-label">楼层</span><input v-model="form.floor" class="df-input" placeholder="如 3F" /></label>
            </div>
            <div class="df-row">
              <label class="df-field"><span class="df-label">位置</span><input v-model="form.location" class="df-input" placeholder="如 东区茶水间旁" /></label>
            </div>
            <div class="df-row">
              <label class="df-field"><span class="df-label">厂商</span><input v-model="form.manufacturer" class="df-input" placeholder="如 HP" /></label>
              <label class="df-field"><span class="df-label">型号</span><input v-model="form.model" class="df-input" placeholder="如 LaserJet Pro M404dn" /></label>
            </div>
            <label class="df-field"><span class="df-label">硒鼓型号</span><input v-model="form.tonerModel" class="df-input" placeholder="如 HP 58A (CF258A)" /></label>
            <label class="df-field"><span class="df-label">备注</span><input v-model="form.notes" class="df-input" placeholder="备注信息" /></label>
            <div class="df-row">
              <label class="df-field" style="flex:1">
                <span class="df-label">状态</span>
                <select v-model="form.status" class="df-input">
                  <option value="正常">正常</option>
                  <option value="缺墨">缺墨</option>
                  <option value="故障">故障</option>
                </select>
              </label>
              <div style="flex:1" />
            </div>
          </div>
          <div class="df-footer">
            <button class="df-btn df-btn-cancel" @click="dialogVisible = false">取消</button>
            <button class="df-btn df-btn-confirm" @click="savePrinter">保存</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { usePrintersStore } from '../stores/printers'
import type { Printer } from '../mock/printers'
import { exportPrintersCSV, downloadPrinterTemplate, parsePrintersCSV } from '../utils/printer-csv'

const store = usePrintersStore()

// --- Batch select ---
const selectedIds = ref(new Set<number>())
const allSelected = computed(() => groupedPrinters.value.length > 0 && selectedIds.value.size === groupedPrinters.value.length)

const toggleAll = () => {
  if (allSelected.value) { selectedIds.value = new Set() }
  else { selectedIds.value = new Set(groupedPrinters.value.map(p => p.id)) }
}
function toggleOne(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  selectedIds.value = next
}
function batchDelete() {
  store.deletePrinters([...selectedIds.value])
  selectedIds.value = new Set()
}

// --- Floor grouping ---
const groupedPrinters = computed(() => {
  const sorted = [...store.printers].sort((a, b) => a.floor.localeCompare(b.floor))
  const result: (Printer & { isFirst: boolean; floorSpan: number; floorIndex: number })[] = []
  let i = 0, fi = 0
  while (i < sorted.length) {
    const floor = sorted[i].floor
    let j = i
    while (j < sorted.length && sorted[j].floor === floor) j++
    const span = j - i
    for (let k = i; k < j; k++) {
      result.push({ ...sorted[k], isFirst: k === i, floorSpan: span, floorIndex: fi })
    }
    i = j; fi++
  }
  return result
})

// --- Import/Export ---
const fileInput = ref<HTMLInputElement>()
function triggerImport() { fileInput.value?.click() }
function exportCSV() { exportPrintersCSV(store.printers) }
function downloadTemplate() { downloadPrinterTemplate() }

function handleImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const imported = parsePrintersCSV(reader.result as string)
    if (imported.length > 0) store.batchImport(imported as Printer[])
    if (fileInput.value) fileInput.value.value = ''
  }
  reader.readAsText(file)
}

// --- CRUD ---
const dialogVisible = ref(false)
const editingPrinter = ref<Printer | null>(null)
const form = reactive<Omit<Printer, 'id'>>({
  name: '', floor: '', location: '', manufacturer: '', model: '',
  tonerModel: '', notes: '', ip: '', inkLevel: 100, status: '正常',
})

function openAddDialog() {
  editingPrinter.value = null
  Object.assign(form, { name: '', floor: '', location: '', manufacturer: '', model: '', tonerModel: '', notes: '', ip: '', inkLevel: 100, status: '正常' as const })
  dialogVisible.value = true
}
function openEditDialog(row: Printer) {
  editingPrinter.value = row
  Object.assign(form, { ...row })
  dialogVisible.value = true
}
function savePrinter() {
  if (editingPrinter.value) {
    store.updatePrinter(editingPrinter.value.id, { ...form })
  } else {
    const maxId = store.printers.reduce((max, p) => Math.max(max, p.id), 0)
    store.addPrinter({ id: maxId + 1, ...form } as Printer)
  }
  dialogVisible.value = false
}
</script>

<style scoped>
.printers-page { max-width: 1400px; margin: 0 auto; padding: 24px; min-height: 100vh; background: var(--dv-page-bg); }

/* Header */
.page-header { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; padding: 12px 0; border-bottom: 1px solid var(--dv-header-border); }
.back-btn { background: none; border: 1px solid transparent; color: var(--dv-light-muted); cursor: pointer; font-size: 12px; padding: 4px 10px; border-radius: 6px; transition: all 0.15s; font-family: inherit; }
.back-btn:hover { color: var(--dv-accent-blue-glow); background: rgba(88,166,255,0.06); border-color: rgba(88,166,255,0.15); }
.header-divider { width: 1px; height: 18px; background: var(--dv-header-divider); }
.page-title { font-size: 18px; color: var(--dv-light-text); margin: 0; font-weight: 700; }
.header-actions { display: flex; gap: 8px; }
.act-btn { background: var(--dv-kpi-bg); color: var(--dv-light-muted); border: 1px solid var(--dv-kpi-border); padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s; font-family: inherit; white-space: nowrap; }
.act-btn:hover { border-color: var(--dv-accent-blue); color: var(--dv-accent-blue-glow); }
.act-btn-primary { background: rgba(88,166,255,0.08); color: var(--dv-accent-blue-glow); border-color: rgba(88,166,255,0.2); font-weight: 600; }
.act-btn-primary:hover { background: rgba(88,166,255,0.15); }

/* Toolbar */
.toolbar { display: flex; align-items: center; margin-bottom: 12px; padding: 4px 0; }
.sel-info { font-size: 12px; color: var(--dv-light-dim); display: flex; align-items: center; gap: 8px; }
.sel-info.dim { color: var(--dv-light-faint); }
.sel-info strong { font-weight: 700; color: var(--dv-light-text); }
.sel-del-btn { background: rgba(220,50,50,0.1); color: #f87171; border: 1px solid rgba(220,50,50,0.2); padding: 3px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; }
.sel-del-btn:hover { background: rgba(220,50,50,0.2); }
.sel-clr-btn { background: none; color: var(--dv-light-dim); border: 1px solid var(--dv-kpi-border); padding: 3px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; }
.sel-clr-btn:hover { color: var(--dv-light-text); }

/* Table */
.table-wrap { overflow-x: auto; border: 1px solid var(--dv-kpi-border); border-radius: 10px; overflow: hidden; }
.printers-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }

/* Header row */
.printers-table thead th {
  background: var(--dv-kpi-bg);
  color: var(--dv-light-faint);
  font-weight: 600; font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.6px;
  padding: 12px 12px; text-align: left;
  border-bottom: 2px solid var(--dv-kpi-border);
  white-space: nowrap;
  position: sticky; top: 0; z-index: 1;
}
.printers-table thead th.col-cb { text-align: center; }
.printers-table thead th.col-floor { text-align: center; }
.printers-table thead th.col-act { text-align: center; }

/* Data rows */
.printers-table tbody td {
  padding: 8px 12px;
  color: var(--dv-light-sub);
  border-bottom: 1px solid var(--dv-header-border);
  white-space: nowrap;
  vertical-align: middle;
}
.printers-table tbody tr.selected td { background: rgba(88,166,255,0.12) !important; }
.printers-table tbody tr:hover td { background: rgba(255,255,255,0.04) !important; color: var(--dv-light-text); }
/* 楼层组交替底色 */
.printers-table tbody tr.fg-0 td { background: transparent; }
.printers-table tbody tr.fg-1 td { background: rgba(255,255,255,0.02); }

/* Columns */
.col-cb { width: 36px; text-align: center !important; padding: 8px 12px !important; }
.col-cb input { cursor: pointer; accent-color: var(--dv-accent-blue); width: 14px; height: 14px; }
.col-floor {
  font-weight: 800; font-size: 13px;
  color: var(--dv-accent-blue-glow);
  vertical-align: middle; text-align: center;
  width: 52px;
  background: rgba(88,166,255,0.08) !important;
  border-right: 2px solid var(--dv-accent-blue);
  letter-spacing: 0.5px;
}
.col-model { max-width: 220px; overflow: hidden; text-overflow: ellipsis; font-family: 'SF Mono', 'Consolas', monospace; font-size: 12px; }
.col-toner { max-width: 200px; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--dv-light-faint); }
.col-notes { max-width: 120px; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--dv-light-faint); }
.col-act { width: 110px; }

/* Brand tag */
.brand-tag { font-weight: 600; font-size: 12px; }

/* Status dot + text */
.status-dot {
  display: inline-block; width: 6px; height: 6px;
  border-radius: 50%; margin-right: 6px; vertical-align: middle;
}
.st-正常 { background: #4ade80; box-shadow: 0 0 6px rgba(74,222,128,0.5); }
.st-缺墨 { background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,0.5); }
.st-故障 { background: #f87171; box-shadow: 0 0 6px rgba(248,113,113,0.5); }
.status-text { font-size: 11px; color: var(--dv-light-faint); margin-left: 2px; vertical-align: middle; }

/* Empty state */
.empty-row { text-align: center; padding: 60px 16px !important; }
.empty-icon { font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.4; }

/* Row buttons */
.row-btn { background: none; border: 1px solid transparent; color: var(--dv-light-muted); cursor: pointer; font-size: 11px; padding: 3px 8px; border-radius: 4px; transition: all 0.15s; font-family: inherit; }
.row-btn:hover { background: rgba(255,255,255,0.05); color: var(--dv-accent-blue-glow); }
.row-btn + .row-btn { margin-left: 4px; }
.row-btn-danger:hover { color: #f87171; background: rgba(220,50,50,0.1); }

/* Dialog */
.df-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.df-dialog { background: var(--dv-stat-card-bg); border: 1px solid var(--dv-stat-card-border); border-radius: 10px; padding: 20px; width: 520px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.df-header { font-size: 16px; font-weight: 600; color: var(--dv-light-text); margin-bottom: 16px; }
.df-body { display: flex; flex-direction: column; gap: 10px; }
.df-field { display: flex; flex-direction: column; gap: 3px; }
.df-label { font-size: 12px; color: var(--dv-light-dim); }
.df-input { background: var(--dv-bar-track); border: 1px solid var(--dv-kpi-border); color: var(--dv-light-muted); border-radius: 6px; padding: 6px 10px; font-size: 13px; outline: none; }
.df-input:focus { border-color: var(--dv-accent-blue); }
.df-row { display: flex; gap: 12px; }
.df-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.df-btn { padding: 6px 16px; border-radius: 6px; border: none; font-size: 13px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.df-btn-cancel { background: var(--dv-bar-track); color: var(--dv-light-muted); }
.df-btn-confirm { background: rgba(88,166,255,0.12); color: var(--dv-accent-blue-glow); border: 1px solid rgba(88,166,255,0.25); font-weight: 600; }
.df-btn-confirm:hover { background: rgba(88,166,255,0.2); }
</style>
