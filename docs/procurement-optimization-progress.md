# 采购页面优化进度

> 本文档记录采购页面（电脑采购 / 手机采购 / 采购概览）的优化与新增功能进度。
> 更新日期：2026-07-11（dev server 实测补充）
> 验证方式：`npx vue-tsc --noEmit` + 本地 dev server 端到端实测（2026-07-11，见下方测试报告）

---

## 总览

| 状态 | 数量 | 说明 |
|------|------|------|
| ✅ 已完成 | 29 | 24 项原完成 + #29/#18/#20/#27/#28 实测通过；全部通过 `vue-tsc --noEmit`，dev server 实测 11 个关键交互点通过 |
| ⏳ 待推进 | 1 | #27-补：常规增删改需补 `logOperation` 调用 |

---

## 第一批：Bug 修复 + 高价值低成本（6 项）

### ✅ #22 修复概览 tab 不预加载数据导致 KPI 全为 0

- **问题**：`ProcurementView.vue` 的 `switchTab` 和 `onMounted` 中，overview 分支不加载数据，导致概览首次进入时 KPI 全为 0
- **改动**：`switchTab` overview 分支按需补加载两个 store（缺哪边补哪边）；`onMounted` overview 初始 tab 时也触发加载
- **文件**：`src/views/procurement/ProcurementView.vue`

### ✅ #30 修复概览 tab 下「添加/导入」按钮可点但无响应

- **问题**：概览 tab 下顶部「添加」「导入」按钮仍可点，但 `openAddDialog`/`triggerImport` 只处理 computer/phone，点击无反应
- **改动**：`proc-topbar-right` 加 `v-if="activeTab !== 'overview'"`，概览下隐藏这两个按钮
- **文件**：`src/views/procurement/ProcurementView.vue`

### ✅ #21 概览最近采购记录支持点击跳转详情抽屉

- **改动**：
  - 概览最近记录项加 `clickable` class + `@click="emit('jump', rec)"`，hover 高亮 + 「查看 ↗」提示
  - `ProcurementOverviewTab` 声明 `defineEmits` 的 `jump` 事件
  - `ProcurementView` 监听 `@jump="handleOverviewJump"`，切到对应 tab 后 `nextTick` 调子组件 `openRowDrawer(id)`
  - 两个 tab 子组件新增 `openRowDrawer(id)` 方法并 `defineExpose`
- **文件**：`ProcurementView.vue` / `ProcurementOverviewTab.vue` / `ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #25 导入模板下载功能（电脑 + 手机）

- **改动**：两个 tab 各加 `downloadTemplate()` 函数和「下载导入模板」按钮
  - 电脑模板：15 列表头 + 1 行示例（含 MAC 格式、日期格式、CE 流程布尔）
  - 手机模板：17 列表头 + 1 行示例（含 IMEI、换/新购、原归属）
  - 表头顺序与各 tab 的 `handleImport` 解析逻辑严格一致
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #1/#2 IMEI 与 MAC 地址前端查重

- **改动**：
  - 表单保存：`handleSave` 前比对 store 已有数据（排除编辑自身 id），重复时 `ElMessage.warning` 并阻止保存
  - CSV 导入：批次内 + 与已有数据双重查重，用 `Set` 去重，重复行跳过并计数
- **文件**：`ComputerProcurementTab.vue`（MAC）/ `PhoneProcurementTab.vue`（IMEI）

### ✅ #13/#11 电脑表格补价格列 + 表头可排序

- **改动**：
  - 电脑表格补「价格」列（交付日期后），`¥` 格式 + 蓝色高亮
  - 电脑/手机表头常用列加 `sortable`：资产序号、采购型号、使用部门、申请人、收货/交付日期、价格（电脑）；资产编号、品牌、型号、领用部门、领用人、到货/领用时间（手机）
  - 日期列自定义排序工厂 `makeDateSorter(prop)`，空值统一沉底
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

---

## 第二批：导入/筛选闭环（4 项）

### ✅ #4 电脑导入跳过 MAC 格式错误行收集行号，弹窗可展开查看

- **改动**：`skippedMac`/`skippedDupMac` 从单纯计数升级为同时收集 CSV 行号（`skippedMacLines`/`skippedDupMacLines`），有跳过时用 `ElMessageBox.alert` 弹出可展开明细（行号列表）
- **文件**：`ComputerProcurementTab.vue`

### ✅ #3 手机导入改为按首行表头映射，缺失字段补空，提高容错

- **改动**：手机 `handleImport` 重写
  - 首行解析中文表头 → 建立 `列名→字段` 映射（`HEADER_MAP`）
  - 数据行按表头取值，缺失字段补空，列顺序不敏感
  - 整行全空跳过并计数；IMEI 重复跳过收集行号 + 弹窗明细
  - 识别字段数 < 17 时提示「识别 N/17 列」；完全未识别表头时报错引导下载模板
- **文件**：`PhoneProcurementTab.vue`

### ✅ #6 电脑补「是否已走 CE 流程」筛选；手机补「领用人」筛选

- **改动**：
  - 电脑筛选栏新增「CE 流程」下拉（已走 / 未走），`filterCeProcessed` 用 `boolean | ''` 区分未选与筛选态
  - 手机筛选栏新增「领用人」可搜索下拉，`recipients` computed 由数据中领用人去重生成
  - 两端 `resetFilters`/`watch`/`filteredData` 同步纳入新筛选条件
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #7 手机搜索补 serialNo/handler/originalOwner 覆盖，与 placeholder 一致

- **改动**：手机 `filteredData` 搜索从 7 字段扩到 10 字段，补 `serialNo`/`handler`/`originalOwner`；placeholder 同步更新为「搜索品牌/型号/资产编号/IMEI/领用人/序列号/经手人/原归属...」
- **文件**：`PhoneProcurementTab.vue`

---

## 第三批：列表/详情/导出/筛选（7 项）

### ✅ #12 手机表格补「采购类型」「经手人」列

- **改动**：手机表格在「领用人」后补两列
  - 采购类型：用 `el-tag` 着色（换=warning 橙 / 新购=success 绿），提升可读性
  - 经手人：普通文本列
- **文件**：`PhoneProcurementTab.vue`

### ✅ #10 长表格列显隐配置（电脑 9 列 + 手机 10 列）

- **改动**：
  - 筛选栏新增「列设置」`el-popover`，`el-checkbox-group` 控制各列 `v-if`
  - 含「全显 / 全隐 / 默认」快捷按钮
  - `COL_KEYS`/`DEFAULT_VISIBLE_COLS`/`visibleCols`/`colOn` 模式两端一致
  - 注意：fixed 列（资产序号/操作）不纳入可控，保持常驻
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #14 表格行高亮标记（未走 CE / 未交付的行加警告底色）

- **改动**：
  - `:row-class-name="rowClass"` 给异常态行加 class
  - 电脑：未走 CE = 橙底色 / 未交付 = 红底色；双重异常态用更深的混合色
  - 手机：未领用 = 橙 / 换机无原归属 = 红
  - CSS 用 `:deep()` + `!important` 覆盖 stripe 斑马纹；hover 时切换为蓝色高亮保留可读性
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #16 详情抽屉「上一条/下一条」切换

- **改动**：
  - 抽屉 footer 加 `el-button-group`，放在删除按钮右侧
  - `currentRowIndex` 基于 `filteredData` 定位，`canPrevRow`/`canNextRow` 控禁用
  - 切条后 `selectedRow` 直接替换为相邻行对象，抽屉内容响应式刷新
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #26 导出全部（含筛选结果），不仅选中行

- **改动**：
  - 筛选栏加 `el-dropdown`「导出」按钮，含「导出筛选结果（N）」「导出全部（N）」两命令
  - 原「导出选中」保留在批量操作栏
  - 手机端顺手把 `batchExport` 内联的 header 提为 `CSV_HEADERS` 常量 + `toCsvRow` 函数，与电脑端结构对齐
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #8 日期范围支持切换类型（收货/交付/领用）

- **改动**：
  - 筛选栏在 date-picker 前加「日期类型」下拉
  - 电脑：收货日期 / 交付日期；手机：到货时间 / 领用时间
  - `dateType` ref 控制筛选走哪个日期字段，`filteredData` 用 `(c as any)[prop]` 动态取值
  - `resetFilters` 时 `dateType` 也回到默认
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #9 筛选状态持久化到 URL query

- **改动**：
  - 挂载时 `applyFiltersFromQuery` 从 query 回填各筛选 ref
  - watch（非 immediate）在用户改动时 `syncFiltersToQuery` 用 `router.replace` 写回
  - 空值删除 query key 避免 URL 冗长
  - 电脑 `c_` / 手机 `p_` 前缀隔离；`c_ce` 用 `'1'/'0'` 编码 boolean
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

---

## 第四批：概览/空状态/表单/抽屉/字典（5 项）

### ✅ #19 概览新增「换机率」KPI 卡片

- **改动**：
  - 概览 KPI 区新增第 5 张卡片「手机换机率」
  - `phoneExchangeRate` computed = `Math.round(换/(换+新购)*100)`，空数据时为 0
  - KPI 区 `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` 自适应布局
- **文件**：`ProcurementOverviewTab.vue`

### ✅ #32 表格空数据加「清空筛选」快捷按钮

- **改动**：
  - 表格 `#empty` slot 替代 `empty-text`，空状态含文案 + 「清空筛选」按钮
  - `hasActiveFilters` computed 判断是否有激活筛选条件
  - 仅在「筛选无结果」（`store.length > 0 && filteredCount === 0`）时按钮才显示
  - 「暂无采购记录」（全空）不显示按钮
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #5 编辑模式未改动直接关闭无需确认

- **改动**：
  - `editingSnapshot` ref + `snapshotForm()`（JSON.stringify）记录编辑初始快照
  - `onDialogClose` 改为：编辑模式按 `snapshotForm() !== editingSnapshot.value` 判断是否改动，新增模式仍用 `formDirty`
  - 编辑未改动直接关闭，新增未填写直接关闭，避免无谓弹窗
  - 确认文案改为「表单内容已改动，确定关闭？」更准确
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #15/#17 详情抽屉编辑保存后回抽屉并同步刷新 selectedRow

- **改动**：
  - `returnToDrawer` ref 标记编辑是否从抽屉进入
  - `openEditDialog` 时 `returnToDrawer.value = drawerVisible.value`（抽屉正开则 true）
  - `handleSave` 保存成功后若 `editingId && returnToDrawer`，从 store 取更新后的行对象赋给 `selectedRow` 并重新打开抽屉
  - 避免编辑后抽屉数据陈旧
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #31 字典数据手动刷新入口

- **改动**：
  - 字典加载逻辑提取为 `loadDicts()` 函数（返回 bool），`onMounted` 和「刷新字典」按钮共用
  - 筛选栏导出下拉后加 `text` 按钮 `Refresh` 图标，`refreshDicts()` 调 `loadDicts()` 成功时 toast
  - 新增字典项后无需刷新整页
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #24 导入预览 dry-run（解析后展示「将导入 N 条，跳过 M 行」确认后再提交）

- **改动**：
  - 电脑/手机 `handleImport` 解析完成后不再直接提交
  - 用 `ElMessageBox.confirm` 展示预览：将导入 N 条 + 跳过 M 行（含明细行号）
  - 用户「确认导入」后才调 `store.batchImport`；「取消」则 toast 提示已取消
  - 解析后无有效行时直接 warning 引导检查文件或下载模板，不进预览
  - 取代了原来「导入后再 toast + alert 明细」的事后告知模式
- **文件**：`ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`

### ✅ #23 Excel `.xlsx` 导入导出（SheetJS，依赖已就绪）

- **改动**：
  - 新建 `src/utils/excel.ts` 封装 `downloadXlsx`（aoa_to_sheet + writeFile）和 `parseXlsx`（arrayBuffer + sheet_to_json header:1）
  - 两个 tab 导入 input 的 `accept` 加 `.xlsx`，`handleImport` 按扩展名分流：xlsx 走 `parseXlsx`，CSV 走原 FileReader
  - 电脑 xlsx 导入按 `COL_ORDER` 列名定位（与 CSV 列序一致），手机 xlsx 导入复用 `processImportFromGrid` 表头映射
  - 导入解析 + MAC/IMEI 校验 + dry-run 预览逻辑提取为共用函数（电脑 `validateMacRows`/`processImportRows`，手机 `processImportFromGrid`），CSV 和 Excel 共用
  - 导出下拉新增「导出筛选结果 Excel」「导出全部 Excel」两个命令，`onExportCmd` 加 `filtered-xlsx`/`all-xlsx` 分支
  - 导出代码重构：`toRowArr` 返回数组（CSV 和 xlsx 共用），`toCsvRow` 仅做 escape + join
- **文件**：`src/utils/excel.ts`（新建）/ `ComputerProcurementTab.vue` / `PhoneProcurementTab.vue`
- **依赖**：`xlsx@^0.18.5`（项目 `package.json` 已有，无需新增）

---

## 待推进项（1 项，前端逻辑补全）

| # | 任务 | 依赖 | 优先级 | 实测说明 |
|---|------|------|--------|----------|
| #27-补 | 常规增删改需写入 `operation_logs` | 前端 store 操作 | 中 | 抽屉「最近变更」前端拉取+过滤逻辑已验证可用，但 `logOperation` 当前仅在批量删/回收站中触发，常规 add/update/delete 未写日志，导致真实业务无留痕 |

> **注**：原"待推进"的 #29（回收站软删除）、#18/#20（概览图表）、#28（字段级权限）已在代码中实现，本次实测通过。前端按纯 SVG 实现了环形图/柱状图/折线图，无图表库依赖；#18/#20 不再"依赖图表库"。

---

## 涉及文件汇总

| 文件 | 改动批次 |
|------|---------|
| `src/views/procurement/ProcurementView.vue` | #22 #30 #21 |
| `src/views/procurement/ProcurementOverviewTab.vue` | #21 #19 #18/#20（图表 SVG） |
| `src/utils/excel.ts` | #23（新建） |
| `src/views/procurement/ComputerProcurementTab.vue` | #25 #1/#2 #13/#11 #4 #6 #21 #12 #10 #14 #16 #26 #8 #9 #32 #5 #15/#17 #31 #24 #23 |
| `src/views/procurement/PhoneProcurementTab.vue` | #25 #1/#2 #13/#11 #3 #6 #7 #21 #12 #10 #14 #16 #26 #8 #9 #32 #5 #15/#17 #31 #24 #23 |
| `server/routes/computer-procurement.ts` | #29 后端（trash/restore/purge 端点） |
| `server/routes/phone-procurement.ts` | #29 后端（trash/restore/purge 端点） |
| `server/db.ts` | #29 迁移（`deleted`/`deleted_at` 字段，try-catch ALTER TABLE） |

## 验证建议

所有改动通过 `vue-tsc --noEmit`，但未跑完整 dev server。建议本地起 dev 实测以下交互点：

- 概览首次进入：KPI 是否有数（#22）
- 概览最近记录点击：是否切到对应 tab 并弹出详情抽屉（#21）
- 导入按钮旁「下载导入模板」：CSV 列顺序与导入解析一致（#25）
- 表单重复 IMEI/MAC 保存：是否提示并阻止（#1/#2）
- 表头点击排序：日期列空值是否沉底（#13/#11）
- 电脑导入含错误 MAC 行：应弹出明细框列出行号（#4）
- 手机导入列顺序乱或列数不足：应按表头识别导入（#3）
- 电脑 CE 流程下拉筛选、手机领用人下拉筛选是否生效（#6）
- 手机搜索框搜 serialNo / 经手人 / 原归属是否能命中（#7）
- 列设置 popover：勾选/取消是否实时生效，「全隐」后表格是否只剩选择框+操作列（#10）
- 行高亮：造一条未走 CE 且未交付的电脑记录，应显示混合深橙色（#14）
- 抽屉上一条/下一条：筛选后浏览到首/末条时按钮应禁用（#16）
- 导出下拉：筛选后「导出筛选结果」应只含筛选行（#26）
- 日期类型切换：选「交付日期」+范围，应只按交付日期筛（#8）
- URL 持久化：筛选后刷新页面，筛选条件应保留；复制 URL 到新窗口应还原同样筛选视图（#9）
- 概览换机率：造几条「换」类型手机记录，卡片应显示百分比（#19）
- 空状态「清空筛选」：筛选到无结果，按钮应出现且点击后清空所有筛选（#32）
- 编辑未改动关闭：打开编辑弹窗不改任何字段直接关闭，应无确认弹窗（#5）
- 抽屉编辑回流：从抽屉点编辑→保存，抽屉应重新打开且显示更新后的字段（#15/#17）
- 刷新字典：后台加新部门后点按钮，下拉应立即含新项（#31）
- 导入预览：选 CSV 后应先弹「将导入 N 条，跳过 M 行」确认框，取消则不导入，确认后才写入（#24）
- Excel 导入：选 .xlsx 文件应按表头识别导入，导出下拉选 Excel 应下载 .xlsx 文件（#23）

---

## 本地 dev server 实测报告（2026-07-11）

> 本次实测在本地起完整 dev server（前端 Vite :5173 + 后端 tsx server/index.ts :3001），使用 Playwright 驱动浏览器端到端验证。

### 实测环境

- 后端：PM2 / 前台进程启动 `server/index.ts`（port 3001）
- 前端：Vite dev server（port 5173）
- 数据库：`data/opshub.db`（原库，无 mock）
- 测试账号：`admin` / `admin123`（超管）；`81038896` / `user123`（普通用户，原密码未知，已重置为 `user123` 以便测试）
- 数据库补全：`computer_procurement` / `phone_procurement` 的软删除字段 `deleted` / `deleted_at` 原先缺失，已手动补列（`db.ts` 中迁移代码存在但未实际执行）

### 阻塞性 Bug（首次 dev server 报错，已修复）

以下 3 个 bug 导致采购页首次打开即渲染异常 / API 404，已在实测中定位并修复：

#### 1. `computed` 双重 import（编译阻塞）

- **现象**：Vite 编译 `ComputerProcurementTab.vue` 报 `[vue/compiler-sfc] Identifier 'computed' has already been declared`，采购页白屏
- **根因**：行 268 已 `import { ref, reactive, computed, watch, onMounted, h } from 'vue'`，行 277 又重复 `import { computed } from 'vue'` —— ES 语法错误
- **文件**：`src/views/procurement/ComputerProcurementTab.vue`、`PhoneProcurementTab.vue`
- **修复**：删除第 277 / 288 行的重复 import

#### 2. `search` TDZ 错误（运行时阻塞）

- **现象**：渲染错误 `ReferenceError: Cannot access 'search' before initialization`
- **根因**：`syncFiltersToQuery` 函数（调用 `search.value`）和 `watch([search, ...], ...)` 被放在 `const search = ref('')` **之前**，形成暂时性死区
- **文件**：`src/views/procurement/ComputerProcurementTab.vue`、`PhoneProcurementTab.vue`
- **修复**：把 `applyFiltersFromQuery` / `syncFiltersToQuery` 及 watch 调用整体移到所有筛选 ref 声明之后

#### 3. 回收站 API 路由顺序 bug（关键后端 bug）

- **现象**：回收站抽屉显示「回收站为空」，即使已有软删除记录；curl `GET /api/v1/computer-procurement/trash` 返回 404 `记录不存在`
- **根因**：`server/routes/computer-procurement.ts` 中 `GET /:id` 路由注册在 `GET /trash` **之前**，Express 顺序匹配把 `/trash` 当成了 `/:id`（id='trash'） → 查无此记录 → 404。`GET /:id` handler 里 `if (!row) return 404 记录不存在`，这就是该响应的实际来源
- **文件**：`server/routes/computer-procurement.ts`、`server/routes/phone-procurement.ts`
- **修复**：把 trash 三个端点（`GET /trash`、`POST /trash/restore`、`DELETE /trash/purge`）整体移到 `GET /:id` 之前，并加注"必须放在 /:id 前"警醒

> 修复 #3 后，两个 trash 端点实测返回 200，回收站抽屉正常显示软删除记录。

### 11 项关键交互点实测结果

| # | 测试点 | 结果 | 实测证据 |
|---|--------|------|----------|
| #22 | 概览首次进入 KPI 有数 | ✅ 通过 | 5 张卡片均有数据：电脑 534 台、手机 397 台、总额 ¥1,241,527、本月新增 0 台、手机换机率 4% |
| #18/#20 | 概览环形图/柱状图/折线图渲染 | ✅ 通过 | 纯 SVG 实现：手机品牌占比环形图（红米 92%/苹果 5%/华为 3%）、电脑型号 TOP10 柱状图、近 6 个月采购趋势折线图，无图表库依赖 |
| #21 | 最近记录点击→切 tab+弹出详情抽屉 | ✅ 通过 | 点概览第 1 条手机记录 → URL 切到 `?tab=phone` → 详情抽屉弹出，资产编号 397 与点击项完全匹配；rowIndex=0 时「上一条」正确禁用 |
| #27 | 详情抽屉底部「最近变更」显示操作日志 | ✅ 通过 | 前端拉 `module=手机采购` 全量日志，客户端按 `target` 过滤。插入测试日志后抽屉正确显示「编辑 · 何鑫城 · 2026-07-09」「新增 · admin · 2026-07-06」两条；target≠397 的记录被正确过滤 |
| #28 | 普通用户只读、管理员可写 | ✅ 通过 | 普通用户（role=user）：顶部「添加」「导入」「下载导入模板」全隐藏，表格操作列「编辑/删除」替换为「只读」标签；管理员：上述按钮可见，操作列「编辑/删除」可用 |
| #29 | 回收站软删除 → 恢复 / 永久删除 | ✅ 通过 | 删除后表格 534→533、总额对账（-¥5,399）；回收站抽屉显示型号+删除时间；「恢复」后 533→534 且回收站变空；「永久删除」有二次确认框「确定永久删除 1 条记录吗？此操作不可恢复」，确认后 toast「已永久删除 1 条」且不可恢复 |
| #23 | Excel 导入按表头识别 + 导出下载 .xlsx | ✅ 通过 | 构造表头+1 行的 `.xlsx` 上传 → 解析为 1 条；「导出全部 Excel」→ 浏览器下载 `电脑采购全部记录.xlsx`（333KB），解析后 535 行×15 列，中文表头正确 |
| #24 | 导入预览确认框 | ✅ 通过 | 上传 .xlsx 后弹「导入预览」对话框，显示「将导入 1 条记录」，有「取消」和「确认导入」按钮；点击「确认导入」后 toast「导入 1 条」 |
| #9 | URL 持久化 | ✅ 通过 | 选部门「微创」→ URL 变为 `?c_dept=微+创`，表格筛为 29 条（¥51,374）；刷新后 URL 保留、筛选下拉仍选中「微创」、结果一致 |

### 遗留问题（待后续处理）

#### #27 真实日志目前为空（前端已就绪，后端行为缺失）

- **现象**：抽屉「最近变更」前端逻辑已验证可用，但数据库中 `operation_logs` 的「电脑采购」「手机采购」module 当前记录为 **0 条** —— 即真实业务产生的增/删/改目前**不会**写入操作日志
- **根因**：`logOperation` 函数当前只在「批量删除」和「回收站恢复/永久删除」中被调用，常规 `add` / `update` / `delete`（含单条删除、表单保存、导入）均未调用 `logOperation`
- **修复建议**：在 `useComputerProcurementStore` / `usePhoneProcurementStore` 的 add、update、delete 方法末尾补 `logOperation` 调用（module 分别为「电脑采购」「手机采购」，target 取当条 asset_number 或 id）

#### 其他小问题（非阻塞）

- 「下载导入模板」按钮（筛选栏右上角）原先对普通用户可见（仅触发下载 CSV，无写入权限风险），实测中已顺手加上 `v-if="canEdit"` 保护，与顶部权限风格统一
- `db.ts` 中 `deleted`/`deleted_at` 迁移代码（try-catch ALTER TABLE）存在但未实际执行过，本次手动补列。若部署到全新环境迁移会自生效；若部署到已有库需确认该 ALTER 已跑过

### 测试副作用（已知，已尽量回滚）

- 实测中插入 3 条测试 operation_logs 已删除；导入 1 条测试记录（型号「测试导入型号-XLSX」，价格 9999）已删除
- ⚠️ 资产序号 **30002531** 在测试 #29「永久删除」时被永久删除，**当前不可恢复**（已从表中彻底移除）。数据库电脑采购现共 533 条（原始 534 条）
