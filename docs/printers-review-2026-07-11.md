# 打印机管理页面 — 评审与实现细则

> 评审时间：2026-07-11
> 评审范围：`src/views/PrintersView.vue`（前台）、`src/api/printers.ts`、`src/stores/printers.ts`、`server/routes/printers.ts`、`server/db.ts`（printers / printer_brands / printer_models / toner_models / printer_floors 表）、`src/utils/printer-csv.ts`、`src/utils/printer-table-helper.ts`、`src/types/index.ts`（Printer interface L55-64）、`server/routes/admin.ts`（字典）、`src/router/index.ts`（L66-70 前台、L83-86 后台字典）
> 评审人：AtomCode
> 文档定位：v1（总览 + 优先级）与 v2（每项实现逻辑 + 代码片段）合并版，一份文档自洽可执行。

---

## 目录

- [一、现状速览](#一现状速览)
- [二、问题与优化意见](#二问题与优化意见)
  - [2.1 P0 必须修复（3 项）](#21-p0-必须修复3-项)
  - [2.2 P1 健壮性 + UX（7 项）](#22-p1-健壮性--ux7-项)
  - [2.3 P2 代码质量（4 项）](#23-p2-代码质量4-项)
- [三、新增功能实现逻辑（2 项）](#三新增功能实现逻辑2-项)
- [四、优先级路线图 + 工作量预估](#四优先级路线图--工作量预估)
- [五、验证清单](#五验证清单)
- [六、关键文件清单](#六关键文件清单)

---

## 一、现状速览

### 1.1 文件与职责

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| 前台视图 | `src/views/PrintersView.vue` | 楼层卡片网格 + 搜索 + 楼层切换 + 批量勾选删除 + 撤销 + 增改弹窗 + CSV 导入导出 |
| API 层 | `src/api/printers.ts` | 6 个接口：list/create/update/delete/batchDelete/import，`fromApi` 字段映射 |
| Store | `src/stores/printers.ts` | 简易 store，无缓存（每次 loadPrinters 拉全量）|
| 后端路由 | `server/routes/printers.ts` | CRUD + stats + CSV export + batch-delete + import，`validateRequired` 入参校验 |
| DB | `server/db.ts` | `printers` 表（无外键）+ `printer_brands` / `printer_models` / `toner_models` / `printer_floors` 字典表 |
| CSV 工具 | `src/utils/printer-csv.ts` | BOM + 双引号转义 + CSV 解析，前端纯字符串处理 |
| 表格 helper | `src/utils/printer-table-helper.ts` | 楼层权重排序 + 楼层→位置→型号三层分组，`rowspan` 合并位置列 |
| 类型 | `src/types/index.ts` L55-64 | `Printer` interface，status 枚举 `'正常' | '缺墨' | '故障'` |
| 后台字典 | `server/routes/admin.ts` L37-59 | printer-brands / printer-models / toner-models / printer-floors 通用 AdminDictTable |
| 路由 | `src/router/index.ts` L66-70 | 前台 `/printers`；后台 `/admin/printers/{floors,brands,models,toners}` |

### 1.2 数据模型

```sql
-- printers 表（无外键约束到字典）
CREATE TABLE printers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  floor         VARCHAR(16)  NOT NULL DEFAULT '',    -- 楼层，字符串字面值
  location      VARCHAR(255) NOT NULL DEFAULT '',    -- 位置描述
  manufacturer  VARCHAR(64)  NOT NULL DEFAULT '',    -- 厂商，冗余存（非外键）
  model         VARCHAR(128) NOT NULL DEFAULT '',    -- 型号
  toner_model   VARCHAR(128) NOT NULL DEFAULT '',    -- 硒鼓型号
  notes         TEXT         NOT NULL DEFAULT '',
  status        VARCHAR(16)  NOT NULL DEFAULT '正常',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
-- 字典表：printer_brands / printer_models（brand_id 外键）/ toner_models（brand_id 外键）/ printer_floors
```

**关键现状**：`printers.manufacturer` / `model` / `toner_model` / `floor` 均为**字符串字面值冗余存**，非外键引用字典表 → 字典改名/删除后 printers 表不会联动，孤儿数据风险。

### 1.3 前台渲染链路现状

```
onMounted
  → store.loadPrinters() （无缓存，每次全量拉）
  → fetchDict('printer-brands') + fetchDict('printer-models')
       → 构 dictModelMap: { 厂商名: [型号名...] }
  → floors / manufacturers / allTonerModels 用 computed 从 store.printers 提取
       ← 字典加载失败时回退到「已有数据提取」兜底

楼层卡片分组
  → buildFloorGroups(printers, selectedFloor, searchQuery)
  → 楼层权重排序（floorWeight: '一楼'=1, '负二楼'=-20, 数字F 匹配兜底）
  → 楼层 → 位置 Map → 位置内按 厂商|型号 再分组
  → 输出 FloorGroup[] { floor, rows: PrinterTableRow[], totalCount }
  → 表格用 rowspan="locationSpan" 合并同位置的多个型号行

批量删除
  → ElMessageBox.confirm → store.deletePrinters(ids) → 后端 batch-delete
  → ElMessage 自定义渲染带「撤销」按钮
  → 撤销：循环 store.addPrinter(deletedData) ← 一台一台 POST，N 台发 N 次请求
```

---

## 二、问题与优化意见

分级标识：🔴 必须修复 · 🟠 建议修复 · 🟡 仅供参考。

### 2.1 P0 必须修复（3 项）

#### 2.1.1 🔴 撤销批量删除发 N 次请求，且事务不原子

**现状**：`src/views/PrintersView.vue` L282-288，撤销时循环 `store.addPrinter`，每台一次 POST → N 台发 N 次请求，中途网络失败会留下半恢复状态；且后端无批量新增接口。

**现状代码**：

```ts
// PrintersView.vue batchDelete 的撤销 onClick
onClick: async () => {
  for (const p of deletedData) {
    await store.addPrinter(p as any)  // ← N 台 N 次请求
  }
  ElMessage.success('已撤销删除')
}
```

**修复逻辑**：后端新增「批量新增」接口，前端一次调用。

```ts
// server/routes/printers.ts 新增
router.post('/batch-create', (req: Request, res: Response) => {
  const { rows } = req.body
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ code: 400, message: 'rows 必填' })
  const insert = db.prepare(
    'INSERT INTO printers (floor, location, manufacturer, model, toner_model, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  let imported = 0
  const errors: string[] = []
  const tx = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      try {
        insert.run(rows[i].floor || '', rows[i].location || '', rows[i].manufacturer || '',
                  rows[i].model || '', rows[i].tonerModel || '', rows[i].notes || '', rows[i].status || '正常')
        imported++
      } catch (e: any) { errors.push(`第 ${i+1} 行: ${e.message}`) }
    }
  })
  tx()
  res.json({ code: 200, data: { imported, errors } })
})
```

```ts
// src/api/printers.ts
export async function batchCreatePrinters(rows: Partial<Printer>[]): Promise<{ imported: number; errors: string[] }> {
  return request(`${BASE}/batch-create`, { method: 'POST', body: JSON.stringify({ rows }) })
}

// src/stores/printers.ts
async function restorePrinters(rows: Printer[]) {
  await api.batchCreatePrinters(rows)
  await loadPrinters()
}
```

前台撤销改用：

```ts
onClick: async () => {
  try {
    await store.restorePrinters(deletedData)
    ElMessage.success('已撤销删除')
  } catch (e: any) {
    ElMessage.error('撤销失败：' + e.message)
  }
}
```

**验证点**：删除 50 台后点撤销，网络面板应只看到 1 次 POST `/batch-create`，且数据库恢复 50 条。

---

#### 2.1.2 🔴 CSV 导入绕过字典校验，可写入孤儿厂商/型号

**现状**：`server/routes/printers.ts` L161-184 的 `/import` 直接 `INSERT`，不校验 `manufacturer` 是否在 `printer_brands`、`model` 是否在 `printer_models`、`tonerModel` 是否在 `toner_models` → 导入任意 CSV 会污染字典体系，且后续字典改名后这些数据不联动。

**现状代码**：

```ts
// /import 路由，直接插入不校验字典
insert.run(r.floor || '', r.location || '', r.manufacturer || '', r.model || '', r.tonerModel || '', r.notes || '', '正常')
```

**修复逻辑**：导入时校验字典存在性，缺失的字典项可「自动补录」（配置项控制）或「拒绝并报告」。

```ts
// server/routes/printers.ts /import 改写
router.post('/import', (req: Request, res: Response) => {
  const { rows, autoCreateDict = false } = req.body
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ code: 400, message: 'rows 必填' })

  const insert = db.prepare(
    'INSERT INTO printers (floor, location, manufacturer, model, toner_model, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const brandCache = new Map<string, number>()
  const modelCache = new Map<string, number>()  // key: brandId|modelName
  const tonerCache = new Set<string>()

  let imported = 0
  const errors: string[] = []
  const tx = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      // 校验字典
      if (r.manufacturer) {
        if (!brandCache.has(r.manufacturer)) {
          const b = db.prepare('SELECT id FROM printer_brands WHERE name=?').get(r.manufacturer) as any
          if (b) brandCache.set(r.manufacturer, b.id)
          else if (autoCreateDict) {
            const nb = db.prepare('INSERT INTO printer_brands (name) VALUES (?)').run(r.manufacturer)
            brandCache.set(r.manufacturer, nb.lastInsertRowid as number)
          } else {
            errors.push(`第 ${i+1} 行: 厂商「${r.manufacturer}」不在字典，请先在后台添加`)
            continue
          }
        }
      }
      // model 校验略（同模式）
      try {
        insert.run(r.floor || '', r.location || '', r.manufacturer || '', r.model || '',
                   r.tonerModel || '', r.notes || '', r.status || '正常')
        imported++
      } catch (e: any) { errors.push(`第 ${i+1} 行: ${e.message}`) }
    }
  })
  tx()
  res.json({ code: 200, data: { imported, errors } })
})
```

前台导入弹窗加复选框「自动补录字典缺失项」：

```vue
<el-checkbox v-model="importAutoCreateDict">自动补录字典缺失项（厂商/型号/硒鼓）</el-checkbox>
```

```ts
await store.batchImport(data as Printer[], importAutoCreateDict.value)
// store 改造 batchImport(rows, autoCreateDict) → api.importPrinters(rows, autoCreateDict)
```

**验证点**：导入含未知厂商「FakeBrand」的 CSV，默认应返回 errors 提示；勾选「自动补录」后应成功并在 `printer_brands` 表新增记录。

---

#### 2.1.3 🔴 撤销删除丢字段：deletedData 浅拷贝带 id，恢复时 id 冲突

**现状**：`batchDelete` 保存 `deletedData = store.printers.filter(p => ids.includes(p.id))`，撤销时 `store.addPrinter(p as any)` 把 `p` 整对象传入，包含原 `id`。后端 POST 用 `INSERT` 忽略 id（自增），但前端 `addPrinter` 的 `Omit<Printer, 'id'>` 类型断言失败，运行时虽不出错但类型不安全。

**修复逻辑**：撤销前剔除 `id`、`createdAt`、`updatedAt`。

```ts
// PrintersView.vue batchDelete 的撤销
const deletedData = store.printers
  .filter(p => ids.includes(p.id))
  .map(({ id, ...rest }) => rest)  // 剔除 id
// 撤销
onClick: async () => {
  await store.restorePrinters(deletedData)  // batchCreate 接口已 omit id
  ElMessage.success('已撤销删除')
}
```

**验证点**：撤销后新记录的 id 应为自增新值，而非被删前的旧 id。

---

### 2.2 P1 健壮性 + UX（7 项）

#### 2.2.1 🟠 PUT 更新缺字段校验，可写超长值

**现状**：`server/routes/printers.ts` L100-130 的 PUT 只判 `existing`，遍历 mapping 直接写入，未校验 `floor` 长度（VARCHAR(16)）、`manufacturer` 长度（VARCHAR(64))，超长会触发 SQLite 截断或报错。

**修复逻辑**：

```ts
// PUT 路由内，遍历 mapping 前补
const lengthLimits: Record<string, number> = {
  floor: 16, location: 255, manufacturer: 64, model: 128, toner_model: 128, notes: 10000, status: 16,
}
for (const [key, col] of Object.entries(mapping)) {
  if (req.body[key] !== undefined) {
    const val = req.body[key]
    if (typeof val === 'string' && val.length > (lengthLimits[col] || 255)) {
      return res.status(400).json({ code: 400, message: `${key} 不能超过 ${lengthLimits[col]} 字符` })
    }
    if (key === 'status' && !['正常', '缺墨', '故障'].includes(val)) {
      return res.status(400).json({ code: 400, message: 'status 必须为 正常/缺墨/故障' })
    }
    fields.push(col + ' = ?')
    values.push(val)
  }
}
```

**验证点**：`PUT { floor: "x".repeat(20) }` 应返回 400。

---

#### 2.2.2 🟠 前台搜索筛选缺状态筛选，toolbar 只有搜索

**现状**：`PrintersView.vue` L34-44 toolbar 只有搜索输入 + 选择计数，无状态筛选下拉（正常/缺墨/故障）→ 要看「所有缺墨」的打印机只能楼层逐个翻找。

**修复逻辑**：toolbar 加状态筛选，复用 store 的 `lowInkCount` computed。

```vue
<el-select v-model="filterStatus" placeholder="全部状态" clearable size="small" style="width:120px">
  <el-option label="正常" value="正常" />
  <el-option label="缺墨" value="缺墨" />
  <el-option label="故障" value="故障" />
</el-select>
```

```ts
const filterStatus = ref('')
// floorGroups computed 改造，传入 filterStatus
const floorGroups = computed(() =>
  buildFloorGroups(store.printers as any, selectedFloor.value, searchQuery.value, filterStatus.value)
)
// printer-table-helper.ts buildFloorGroups 新增 statusFilter 参数
export function buildFloorGroups(printers, selectedFloor, searchQuery, statusFilter = '') {
  let filtered = printers
  if (statusFilter) filtered = filtered.filter(p => p.status === statusFilter)
  // ... 原逻辑
}
```

**验证点**：选「缺墨」后只显示缺墨打印机，楼层卡片计数同步。

---

#### 2.2.3 🟠 楼层筛选不可多选，跨楼层对比不便

**现状**：`selectedFloor` 单值，要对比 2 楼和 3 楼的缺墨情况需来回切换。

**修复逻辑**：楼层标签支持多选（Ctrl+ 点）。

```ts
const selectedFloors = ref<Set<string>>(new Set())
// floor-tabs 改为：
@click="toggleFloor(floor)"
function toggleFloor(f: string) {
  const n = new Set(selectedFloors.value)
  if (n.has(f)) n.delete(f); else n.add(f)
  selectedFloors.value = n
}
// buildFloorGroups 改为接收 Set
if (selectedFloors.size > 0) filtered = filtered.filter(p => selectedFloors.has(p.floor))
```

保留「全选/取消全选」按钮兜底。

**验证点**：点 2 楼后 Ctrl 点 3 楼，应同时显示两楼层卡片。

---

#### 2.2.4 🟠 楼层标签横向溢出无滚动提示

**现状**：`.floor-tabs { overflow-x: auto; flex-wrap: wrap }` —— 设了 `wrap` 就不会横向溢出而是换行，但 `overflow-x: auto` 失效。楼层多时换行后高度增长，挤压表格空间。

**修复逻辑**：二选一 —— 要么去掉 `flex-wrap` 让它真横滑并加滚动条样式，要么保留换行去掉 `overflow-x`。

```css
/* 选方案A：单行横滑 */
.floor-tabs { flex-wrap: nowrap; overflow-x: auto; }
.floor-tabs::-webkit-scrollbar { height: 4px; }
.floor-tabs::-webkit-scrollbar-thumb { background: var(--ops-border-card); border-radius: 2px; }
```

**验证点**：10 个楼层时标签栏单行，可横滑，表格区高度不被挤压。

---

#### 2.2.5 🟠 编辑弹窗用 Teleport + 自定义样式，未复用 el-dialog，体验不一致

**现状**：`PrintersView.vue` L122-169 用 `<Teleport to="body">` + 自定义 `.df-overlay` 模拟弹窗，无 ESC 关闭、无遮罩点击关闭（仅 `@click.self`）、无拖拽、无焦点陷阱。其他页面（AdminServices）用 `el-dialog` 标准组件。

**修复逻辑**：改为 `el-dialog`，复用项目已有的 `:deep(.el-dialog)` 样式。

```vue
<el-dialog v-model="dialogVisible" :title="editingPrinter ? '编辑打印机' : '添加打印机'" width="560px" destroy-on-close>
  <el-form :model="form" label-width="80px">
    <!-- 同原表单内容，df-field 改 el-form-item -->
  </el-form>
  <template #footer>
    <el-button @click="dialogVisible = false">取消</el-button>
    <el-button type="primary" :loading="saving" @click="savePrinter">保存</el-button>
  </template>
</el-dialog>
```

**收益**：ESC 关闭、遮罩点击关闭、焦点陷阱、aria 属性全套自动来；删除约 80 行自定义 CSS。

**验证点**：弹窗打开后按 ESC 应关闭；Tab 键焦点应在表单内循环。

---

#### 2.2.6 🟠 导入 CSV 只能 .csv，不支持 .xlsx，且无导入预览

**现状**：`<input accept=".csv">` 仅 CSV，且 `handleImport` 直接 parse 后批量入库，无预览确认环节 → 错误数据已入库。

**修复逻辑**：支持 xlsx（复用项目已有 `src/utils/excel.ts`），加预览表格。

```ts
import { parseExcel } from '../utils/excel'  // 假定已有，或新增

async function handleImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const data = file.name.endsWith('.csv')
      ? parsePrintersCSV(await file.text())
      : await parseExcel(file, ['楼层','位置','厂商','型号','硒鼓型号','备注'])
    // 显示预览弹窗
    previewRows.value = data
    previewVisible.value = true
  } catch (err: any) { ElMessage.error(err.message || '解析失败') }
}

// 预览弹窗确认后调 store.batchImport
async function confirmImport() {
  await store.batchImport(previewRows.value, importAutoCreateDict.value)
  ElMessage.success(`导入 ${previewRows.value.length} 条`)
  previewVisible.value = false
}
```

```vue
<el-dialog v-model="previewVisible" title="导入预览" width="800px">
  <el-table :data="previewRows" max-height="400" size="small">
    <el-table-column prop="floor" label="楼层" />
    <el-table-column prop="location" label="位置" />
    <el-table-column prop="manufacturer" label="厂商" />
    <el-table-column prop="model" label="型号" />
    <el-table-column prop="tonerModel" label="硒鼓" />
  </el-table>
  <template #footer>
    <el-checkbox v-model="importAutoCreateDict" style="margin-right:12px">自动补录字典</el-checkbox>
    <el-button @click="previewVisible = false">取消</el-button>
    <el-button type="primary" @click="confirmImport">确认导入 {{ previewRows.length }} 条</el-button>
  </template>
</el-dialog>
```

**验证点**：选 xlsx 文件能解析；预览表格显示后才真正入库；取消时不写库。

---

#### 2.2.7 🟠 字典与 printers 表数据冗余存，改名不联动

**现状**：`printers.manufacturer` 字符串存「HP」，字典 `printer_brands.name` 改为「HP Inc」后，printers 表仍显示「HP」。

**修复逻辑**：两个方案，按改动量选。

**方案A（推荐，小改）**：字典改名时同步刷 printers 表。

```ts
// server/routes/admin.ts 字典更新路由（通用 AdminDictTable 的 update 后）
// 针对 printer_brands 专门 hook：
if (dict === 'printer-brands' && updatedColumn === 'name') {
  db.prepare('UPDATE printers SET manufacturer = ? WHERE manufacturer = ?').run(newValue, oldValue)
}
// 同理 printer_models 改名刷 printers.model，toner_models 改名刷 printers.toner_model，printer_floors 改名刷 printers.floor
```

**方案B（大改，治本）**：printers 表加 `brand_id` / `model_id` / `toner_id` / `floor_id` 外键，查询时 JOIN 字典取 name。

```sql
ALTER TABLE printers ADD COLUMN brand_id INTEGER REFERENCES printer_brands(id) ON DELETE SET NULL;
-- 同理 model_id, toner_id, floor_id
-- 迁移：UPDATE printers SET brand_id = (SELECT id FROM printer_brands WHERE name = printers.manufacturer)
-- 前端 toApi 改为 JOIN 查询返回 brand.name
```

建议先做方案A 兜底，方案B 列入 P2 重构。

**验证点**：后台改 `printer_brands` 的「HP」为「HP Inc」后，前台所有 HP 打印机应显示「HP Inc」。

---

### 2.3 P2 代码质量（4 项）

| # | 级别 | 问题 | 建议 |
| --- | --- | --- | --- |
| 1 | 🟡 | **store 无缓存**：每次 `loadPrinters` 全量拉，`batchImport` 后又 `loadPrinters` 一次，500 台时网络抖动会明显 | 加 localStorage 缓存（同 services store 模式），写操作后清缓存 |
| 2 | 🟡 | **`buildFloorGroups` 每次 computed 重算**：100 台时楼层分组 + 位置分组 + 型号分组三层 Map 重建，搜索 debounce 仍有卡顿 | 用 `watchEffect` + 手动 memo，按 `printers + selectedFloor + searchQuery` 三参 hash 缓存结果 |
| 3 | 🟡 | **`Manufacturer` / `model` 中英混用**：CSV 模板含中文「东区茶水间旁」但厂商「HP」是英文，搜索时大小写处理不一致（helper 里 `toLowerCase` 对中文无效） | 统一本地化搜索，中文用 `normalize('NFKC')` + 去空格对比 |
| 4 | 🟡 | **`parsePrintersCSV` 不校验列数**：少列时 `const [a,b,c,d,e,f] = cols` 得到 undefined，trim 报错 | 补 `cols.slice(0,6)` + 缺列填空字符串 |

---

## 三、新增功能实现逻辑（2 项）


### 3.1 字典关联下拉与型号联动 ⭐⭐⭐

**目标**：编辑弹窗的厂商/型号/硒鼓下拉真正绑定字典 id，而非字符串字面值。

**现状**：`form.manufacturer` 是字符串，`el-select allow-create` 可输入任意值 → 字典体系形同虚设。

**修复逻辑**：去掉 `allow-create`，强制字典内选；型号下拉按厂商联动。

```vue
<el-select v-model="form.manufacturer" placeholder="请选择厂商" style="width:100%" :disabled="!dictBrands.length">
  <el-option v-for="b in dictBrands" :key="b.id" :label="b.name" :value="b.name" />
</el-select>
<!-- 型号下拉绑定 form.manufacturer 后自动刷新 modelOptions -->
<el-select v-model="form.model" placeholder="请先选择厂商" :disabled="!form.manufacturer" filterable style="width:100%">
  <el-option v-for="m in dictModelsByBrand[form.manufacturer] || []" :key="m.id" :label="m.name" :value="m.name" />
</el-select>
```

字典缺失项加「新增到字典」快捷按钮：

```vue
<el-button v-if="form.manufacturer && !dictBrands.some(b => b.name === form.manufacturer)" size="small" type="warning"
  @click="addBrandToDict(form.manufacturer)">
  + 新增「{{ form.manufacturer }}」到字典
</el-button>
``

```ts
async function addBrandToDict(name: string) {
  await request('/api/v1/admin/dict/printer-brands', { method: 'POST', body: JSON.stringify({ name }) })
  await loadDict()  // 重新拉字典
}
```

**验证点**：厂商下拉只显示字典内项；输入新厂商时显示「新增到字典」按钮。

---

### 3.2 导出 xlsx ⭐⭐

**目标**：导出支持 xlsx（带格式，状态列染色），模板下载带示例行。

**导出 xlsx**（复用 `src/utils/excel.ts`）：

```ts
// src/utils/printer-csv.ts 新增 exportPrintersXlsx
import ExcelJS from 'exceljs'

export async function exportPrintersXlsx(printers: Printer[]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('打印机清单')
  ws.columns = [
    { header: '楼层', key: 'floor', width: 10 },
    { header: '位置', key: 'location', width: 20 },
    { header: '厂商', key: 'manufacturer', width: 12 },
    { header: '型号', key: 'model', width: 25 },
    { header: '硒鼓型号', key: 'tonerModel', width: 20 },
    { header: '备注', key: 'notes', width: 30 },
    { header: '状态', key: 'status', width: 8 },
  ]
  // 状态列染色
  printers.forEach(p => {
    const row = ws.addRow(p)
    const statusCell = row.getCell(7)
    if (p.status === '缺墨') statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } }
    else if (p.status === '故障') statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
  })
  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(buf, '打印机清单.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}
```

顶部下拉加「导出 Excel」项：

```vue
<el-dropdown-item command="export-xlsx"><el-icon><Download /></el-icon> 导出 Excel</el-dropdown-item>
```

**模板下载**带 3 行示例：

```ts
export function downloadPrinterTemplate() {
  const csv = '\uFEFF' + CSV_HEADERS.join(',') + '\n'
    + '3F,东区茶水间旁,HP,LaserJet Pro M404dn,HP 58A (CF258A),,正常\n'
    + '3F,西区会议室,Canon,imageCLASS MF4570dw,Canon C-EXV 55,,正常\n'
    + '2F,前台,HP,LaserJet MFP M430f,HP 59X,,缺墨'
  downloadBlob(csv, '打印机导入模板.csv', 'text/csv;charset=utf-8')
}
```

**验证点**：导出 xlsx 打开后状态列有颜色；模板含 3 行示例。

---


## 四、优先级路线图 + 工作量预估

| 阶段 | 任务 | 预估 |
| --- | --- | --- |
| Day 1 | P0 三项（§2.1.1-2.1.3）撤销原子化 + 导入字典校验 | 3h |
| Day 2 | P1 健壮性（§2.2.1 PUT 校验 + §2.2.2 状态筛选） | 2h |
| Day 3 | P1 UX（§2.2.5 el-dialog 改造 + §2.2.6 导入预览 xlsx） | 4h |
| Day 4 | P1 字典联动（§2.2.7 方案A） + P2 缓存 | 3h |
| Day 5 | 字典关联下拉（§3.1）+ 导出 xlsx（§3.2） | 1d |

总计约 3 人日，P0+P1 可在 2 天内闭环。

---

## 五、验证清单

### P0 验证

| # | 操作 | 预期 |
| --- | --- | --- |
| 1 | 删 50 台后点撤销 | 网络面板仅 1 次 POST `/batch-create`，DB 恢复 50 条 |
| 2 | 导入含未知厂商的 CSV | 默认返回 errors 提示；勾「自动补录」后成功且字典表新增 |
| 3 | 撤销删除后查看新记录 | id 为自增新值，非旧 id |

### P1 验证

| # | 操作 | 预期 |
| --- | --- | --- |
| 4 | `PUT { floor: "x"*20 }` | 返回 400 |
| 5 | toolbar 选「缺墨」 | 只显示缺墨打印机，楼层计数同步 |
| 6 | Ctrl 点 2 个楼层标签 | 同时显示两楼层卡片 |
| 7 | 弹窗打开后按 ESC | 关闭 |
| 8 | 导入 xlsx 文件 | 预览表格显示，确认后才入库 |
| 9 | 后台改字典品牌名 | 前台打印机厂商显示同步更新 |

### 新功能验证

| # | 功能 | 验证点 |
| --- | --- | --- |
| 10 | 字典关联下拉 | 厂商下拉仅显示字典项，新值显示「新增到字典」按钮 |
| 11 | 导出 xlsx | 打开后状态列有颜色 |

---

## 六、关键文件清单

| 模块 | 文件 |
| --- | --- |
| 前台视图 | `src/views/PrintersView.vue` |
| API 层 | `src/api/printers.ts` |
| Store | `src/stores/printers.ts` |
| 后端路由 | `server/routes/printers.ts` |
| 数据库 | `server/db.ts`（printers L172-183 / printer_brands L114 / printer_models L122 / toner_models L133 / printer_floors 字典） |
| 类型 | `src/types/index.ts` L55-64（`Printer` interface） |
| CSV 工具 | `src/utils/printer-csv.ts` |
| 表格 helper | `src/utils/printer-table-helper.ts` |
| Excel 工具（复用） | `src/utils/excel.ts` |
| 后台字典路由 | `server/routes/admin.ts` L37-59 |
| 前台路由 | `src/router/index.ts` L66-70 |
| 后台字典路由 | `src/router/index.ts` L83-86 |
| 首页入口 | `src/views/HomeView.vue` L61-69 |

---

> 本文档为打印机管理页面的完整评审 + 实现细则合并版，可直接按章节排期执行。
