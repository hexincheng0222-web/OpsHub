<template>
  <div class="printers-page">
    <!-- Header — same as PhoneProcurementView -->
    <div class="top-bar">
      <button class="back-btn" @click="$router.push('/')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回</span>
      </button>
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
          <span class="fc-badge">{{ group.printers.length }} 台</span>
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
            <tr v-for="p in group.printers" :key="p.id" :class="{ selected: selectedIds.has(p.id) }">
              <td class="col-cb"><input type="checkbox" :checked="selectedIds.has(p.id)" @change="toggleOne(p.id)" /></td>
              <td>{{ p.location }}</td>
              <td><span class="brand-tag">{{ p.manufacturer }}</span></td>
              <td class="col-model" :title="p.model">{{ p.model }}</td>
              <td class="col-toner" :title="p.tonerModel">{{ p.tonerModel || '—' }}</td>
              <td class="col-notes" :title="p.notes">{{ p.notes || '—' }}</td>
              <td>
                <span class="status-dot" :class="'st-' + p.status" />
                <span v-if="p.status !== '正常'" class="status-text">{{ p.status }}</span>
              </td>
              <td class="col-act"><button class="row-btn" @click="openEditDialog(p)">编辑</button></td>
            </tr>
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
            <div class="df-row">
              <label class="df-field"><span class="df-label">楼层</span><input v-model="form.floor" class="df-input" placeholder="如 3F" /></label>
            </div>
            <div class="df-row"><label class="df-field"><span class="df-label">位置</span><input v-model="form.location" class="df-input" placeholder="如 东区茶水间旁" /></label></div>
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
                  <option value="正常">正常</option><option value="缺墨">缺墨</option><option value="故障">故障</option>
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
import { Plus, ArrowDown, Download, Upload, Document } from '@element-plus/icons-vue'

const store = usePrintersStore()

function handleTopAction(command: string) {
  if (command === 'template') downloadTemplate()
  else if (command === 'import') triggerImport()
  else if (command === 'export') exportCSV()
}

interface FloorGroup { floor: string; printers: Printer[] }
const floorGroups = computed(() => {
  const map = new Map<string, Printer[]>()
  for (const p of store.printers) {
    const list = map.get(p.floor) || []; list.push(p); map.set(p.floor, list)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([floor, printers]) => ({ floor, printers }))
})

const selectedIds = ref(new Set<number>())
function toggleOne(id: number) { const n = new Set(selectedIds.value); n.has(id) ? n.delete(id) : n.add(id); selectedIds.value = n }
function toggleGroupAll(g: FloorGroup) { const ids = g.printers.map(p => p.id); const all = ids.every(id => selectedIds.value.has(id)); const n = new Set(selectedIds.value); if (all) ids.forEach(id => n.delete(id)); else ids.forEach(id => n.add(id)); selectedIds.value = n }
function groupAllSelected(g: FloorGroup) { return g.printers.every(p => selectedIds.value.has(p.id)) }
function batchDelete() { store.deletePrinters([...selectedIds.value]); selectedIds.value = new Set() }

const fileInput = ref<HTMLInputElement>()
function triggerImport() { fileInput.value?.click() }
function exportCSV() { exportPrintersCSV(store.printers) }
function downloadTemplate() { downloadPrinterTemplate() }
function handleImport(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const d = parsePrintersCSV(r.result as string); if (d.length) store.batchImport(d as Printer[]); if (fileInput.value) fileInput.value.value = '' }; r.readAsText(f) }

const dialogVisible = ref(false); const editingPrinter = ref<Printer | null>(null)
const form = reactive<Omit<Printer, 'id'>>({ floor: '', location: '', manufacturer: '', model: '', tonerModel: '', notes: '', status: '正常' })
function openAddDialog() { editingPrinter.value = null; Object.assign(form, { floor: '', location: '', manufacturer: '', model: '', tonerModel: '', notes: '', status: '正常' as const }); dialogVisible.value = true }
function openEditDialog(r: Printer) { editingPrinter.value = r; Object.assign(form, { ...r }); dialogVisible.value = true }
function savePrinter() {
  if (editingPrinter.value) store.updatePrinter(editingPrinter.value.id, { ...form })
  else { const maxId = store.printers.reduce((max, p) => Math.max(max, p.id), 0); store.addPrinter({ id: maxId + 1, ...form } as Printer) }
  dialogVisible.value = false
}
</script>

<style scoped>
.printers-page { max-width: 1100px; margin: 0 auto; padding: 24px; min-height: 100vh; background: var(--dv-page-bg); }

/* Header — same as PhoneProcurementView */
.top-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px 0; border-bottom: 1px solid var(--ops-border-card); }
.top-bar h3 { flex: 1; font-size: 16px; font-weight: 600; color: var(--ops-text-primary); margin: 0; }
.top-actions { display: flex; gap: 8px; align-items: center; }
.back-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px 6px 10px; background: var(--ops-bg-card-hover); border: 1px solid var(--ops-border-card); border-radius: 20px; color: var(--ops-text-secondary); cursor: pointer; font-size: 12px; font-family: inherit; transition: all 0.2s ease; }
.back-btn svg { transition: transform 0.2s ease; }
.back-btn:hover { color: var(--ops-accent-blue); border-color: rgba(88,166,255,0.3); }
.back-btn:hover svg { transform: translateX(-2px); }
.top-count { font-size: 12px; font-weight: 400; color: var(--ops-text-tertiary); margin-left: 6px; }

/* Toolbar */
.toolbar { display: flex; align-items: center; margin-bottom: 16px; padding: 4px 0; }
.sel-info { font-size: 12px; color: var(--dv-light-dim); display: flex; align-items: center; gap: 8px; }
.sel-info.dim { color: var(--dv-light-faint); }
.sel-info strong { font-weight: 700; color: var(--dv-light-text); }
.sel-del-btn { background: rgba(220,50,50,0.1); color: #f87171; border: 1px solid rgba(220,50,50,0.2); padding: 3px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; }
.sel-del-btn:hover { background: rgba(220,50,50,0.2); }
.sel-clr-btn { background: none; color: var(--dv-light-dim); border: 1px solid var(--dv-kpi-border); padding: 3px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; }
.sel-clr-btn:hover { color: var(--dv-light-text); }

.empty-state { text-align: center; padding: 80px 20px; color: var(--dv-light-faint); }
.empty-icon { font-size: 36px; display: block; margin-bottom: 12px; opacity: 0.35; }

/* ===== 楼层卡片 ===== */
.floor-card {
  margin-bottom: 16px;
  border: 1px solid var(--dv-kpi-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--dv-kpi-bg);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  transition: box-shadow 0.2s;
}
.floor-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.12); }

.fc-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(135deg, rgba(88,166,255,0.08), rgba(88,166,255,0.02));
  border-bottom: 1px solid var(--dv-kpi-border);
}
.fc-header-left { display: flex; align-items: center; gap: 8px; }
.fc-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dv-accent-blue); box-shadow: 0 0 8px rgba(88,166,255,0.4); }
.fc-floor { font-size: 14px; font-weight: 700; color: var(--dv-accent-blue-glow); letter-spacing: 0.5px; }
.fc-badge { font-size: 10px; color: var(--dv-light-faint); background: rgba(255,255,255,0.04); padding: 2px 8px; border-radius: 10px; border: 1px solid var(--dv-kpi-border); }
.fc-check { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--dv-light-dim); cursor: pointer; }
.fc-check input { cursor: pointer; accent-color: var(--dv-accent-blue); }

.fc-table-wrap { overflow-x: auto; }
.fc-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
.fc-table thead th {
  background: rgba(0,0,0,0.06);
  color: var(--dv-light-faint);
  font-weight: 600; font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.3px;
  padding: 7px 12px; text-align: left;
  border-bottom: 1px solid var(--dv-kpi-border);
  white-space: nowrap;
}
.fc-table thead th.col-cb { text-align: center; }
.fc-table thead th.col-act { text-align: center; }
.fc-table tbody td {
  padding: 6px 12px;
  color: var(--dv-light-sub);
  border-bottom: 1px solid var(--dv-header-border);
  white-space: nowrap; vertical-align: middle;
}
.fc-table tbody tr:last-child td { border-bottom: none; }
.fc-table tbody tr:hover td { background: rgba(255,255,255,0.03); }
.fc-table tbody tr.selected td { background: rgba(88,166,255,0.1) !important; }

/* Columns */
.col-cb { width: 36px; text-align: center !important; }
.col-cb input { cursor: pointer; accent-color: var(--dv-accent-blue); width: 14px; height: 14px; }
.col-model { max-width: 200px; overflow: hidden; text-overflow: ellipsis; font-family: 'SF Mono','Consolas',monospace; font-size: 12px; }
.col-toner { max-width: 180px; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--dv-light-faint); }
.col-notes { max-width: 100px; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--dv-light-faint); }
.col-act { width: 60px; }

.brand-tag { font-weight: 600; font-size: 12px; }

.status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.st-正常 { background: #4ade80; box-shadow: 0 0 6px rgba(74,222,128,0.5); }
.st-缺墨 { background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,0.5); }
.st-故障 { background: #f87171; box-shadow: 0 0 6px rgba(248,113,113,0.5); }
.status-text { font-size: 11px; color: var(--dv-light-faint); margin-left: 2px; vertical-align: middle; }

.row-btn { background: none; border: 1px solid transparent; color: var(--dv-light-muted); cursor: pointer; font-size: 11px; padding: 3px 8px; border-radius: 4px; transition: all 0.15s; font-family: inherit; }
.row-btn:hover { background: rgba(255,255,255,0.05); color: var(--dv-accent-blue-glow); }

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
