# 操作日志添加操作用户记录 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让操作日志在所有业务模块的写操作中统一记录操作用户、IP、UA，并在前端 Admin 日志页展示与筛选。

**架构：** 把分散在 admin/computer-procurement/phone-procurement 三处的 `logOperation` 函数抽到共享模块 `server/logOperation.ts`，提供 `logOperation` + `logCtx` 两个导出；phones.ts 旧 `logOp` 升级、services.ts / operations.ts 接入；前端 AdminLogs.vue 加列加筛选，后端 logs/list 和新增 logs/operators 接口支持按用户查询。

**技术栈：** Express + better-sqlite3（后端），Vue 3 + Element Plus（前端），tsx 运行，vue-tsc 类型检查。

---

## 测试策略说明

本项目**未配置测试运行器**（无 vitest/jest，无 tests 目录）。本计划采用以下验证方式替代单元测试：

- **后端逻辑**：`npm run typecheck:server`（vue-tsc 类型检查）+ `npm run build:server`（构建验证）+ 启动后用 `curl` 调接口验证行为。
- **前端**：`npm run build:client`（含 vue-tsc 类型检查）验证编译。
- **重构任务**：重构前后行为等价，用 typecheck + 关键接口 curl 验证无回归。

每个任务都给出具体验证命令和预期输出。

---

## 文件结构

### 新增
- `server/logOperation.ts` — 共享 `logOperation` 函数 + `logCtx(req)` 辅助（单一职责：写操作日志）。

### 修改
- `server/routes/admin.ts` — 删本地 `logOperation`，改 import；`sanitizeDetail` 保留本地（仅 admin 用）。
- `server/routes/computer-procurement.ts` — 删本地 `logOperation` + `logCtx`，改 import 共享版本。
- `server/routes/phone-procurement.ts` — 同上。
- `server/routes/phones.ts` — 删旧 `logOp`，改 import，12 处调用点升级。
- `server/routes/services.ts` — 3 处写操作接入。
- `server/routes/operations.ts` — 7 处写操作接入。
- `src/views/admin/AdminLogs.vue` — 加列 + 筛选 + 搜索扩展。
- `src/api/admin.ts` — 加 `fetchLogOperators`，`fetchLogs` 支持 operator 参数。

### 职责边界
- `logOperation.ts`：只负责写 `operation_logs` 表，不引入路由依赖。
- 各路由文件：负责业务逻辑 + 在合适时机调用 `logOperation`。
- `admin.ts` 的 `sanitizeDetail`：仅 admin 字典/配置用，保留本地。

---

## 任务 1：创建共享 logOperation 模块

**文件：**
- 创建：`server/logOperation.ts`

- [ ] **步骤 1：创建文件**

创建 `server/logOperation.ts`：

```ts
import { Request } from 'express'
import db from './db'

export interface LogParams {
  module: string
  action: string
  target: string
  detail?: string
  operator?: string
  ip?: string
  userAgent?: string
  status?: 'success' | 'fail'
  errorMessage?: string
  requestMethod?: string
  requestPath?: string
  durationMs?: number
}

export function logOperation(p: LogParams) {
  db.prepare(
    `INSERT INTO operation_logs
       (module, action, target, detail, operator, ip_address, user_agent,
        status, error_message, request_method, request_path, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    p.module, p.action, p.target, p.detail || '', p.operator || '',
    p.ip || '', p.userAgent || '', p.status || 'success',
    p.errorMessage || '', p.requestMethod || '', p.requestPath || '',
    p.durationMs || 0
  )
}

/** 从 req 抽取 ip / ua / method / path，避免每个路由重复写 */
export function logCtx(req: Request) {
  return {
    ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] as string,
    requestMethod: req.method,
    requestPath: req.path,
  }
}
```

- [ ] **步骤 2：类型检查验证**

运行：`npm run typecheck:server`
预期：无报错（新文件编译通过）

- [ ] **步骤 3：Commit**

```bash
git add server/logOperation.ts
git commit -m "refactor: 抽取共享 logOperation 模块"
```

---

## 任务 2：重构 admin.ts 使用共享模块

**文件：**
- 修改：`server/routes/admin.ts:148-171`（本地 logOperation 定义）+ 所有调用点

- [ ] **步骤 1：删除本地 logOperation 定义**

删除 `server/routes/admin.ts` 第 148-171 行的 `function logOperation(...)` 整块（保留 `sanitizeDetail`，仅 admin 用）。

- [ ] **步骤 2：添加 import**

在文件顶部 import 区加：

```ts
import { logOperation, logCtx } from '../logOperation'
```

- [ ] **步骤 3：升级所有调用点**

把文件中所有 `logOperation({ ... operator: req.user?.username || '', ip: req.headers['x-forwarded-for']...` 的调用，改为用 `...logCtx(req)` 展开。示例（config 路由，原第 210 行）：

```ts
logOperation({
  module: '系统配置', action: '修改',
  target: configs.map(c => c.key).join(', '),
  detail: sanitizeDetail(configs),
  operator: req.user?.username || '',
  ...logCtx(req),
})
```

需改的调用点：config(PUT)、batch-delete、POST、PUT、DELETE、logs/clear（共 7 处）。每处都是把 `ip: ... || req.socket.remoteAddress, userAgent: ..., requestMethod: req.method, requestPath: req.path` 替换为 `...logCtx(req)`。

- [ ] **步骤 4：类型检查验证**

运行：`npm run typecheck:server`
预期：无报错

- [ ] **步骤 5：Commit**

```bash
git add server/routes/admin.ts
git commit -m "refactor(admin): 改用共享 logOperation 模块"
```

---

## 任务 3：重构 computer-procurement.ts

**文件：**
- 修改：`server/routes/computer-procurement.ts:6-24`（本地 logOperation + logCtx）

- [ ] **步骤 1：删除本地定义**

删除第 6-24 行的 `function logOperation(...)` 和 `const logCtx = (req: any) => (...)` 两块。

- [ ] **步骤 2：添加 import**

```ts
import { logOperation, logCtx } from '../logOperation'
```

- [ ] **步骤 3：类型检查验证**

运行：`npm run typecheck:server`
预期：无报错（所有调用点已用 `...logCtx(req)`，无需改动）

- [ ] **步骤 4：Commit**

```bash
git add server/routes/computer-procurement.ts
git commit -m "refactor(computer-procurement): 改用共享 logOperation 模块"
```

---

## 任务 4：重构 phone-procurement.ts

**文件：**
- 修改：`server/routes/phone-procurement.ts:7-24`

- [ ] **步骤 1：删除本地定义**

删除第 7-24 行的 `function logOperation(...)` 和 `const logCtx = ...`。

- [ ] **步骤 2：添加 import**

```ts
import { logOperation, logCtx } from '../logOperation'
```

- [ ] **步骤 3：类型检查验证**

运行：`npm run typecheck:server`
预期：无报错

- [ ] **步骤 4：Commit**

```bash
git add server/routes/phone-procurement.ts
git commit -m "refactor(phone-procurement): 改用共享 logOperation 模块"
```

---

## 任务 5：升级 phones.ts 旧 logOp 函数

**文件：**
- 修改：`server/routes/phones.ts:483-485`（旧 logOp）+ 12 处调用点

- [ ] **步骤 1：删除旧 logOp 函数**

删除第 483-485 行：

```ts
function logOp(module: string, action: string, target: string, detail: string = '') {
  db.prepare('INSERT INTO operation_logs (module, action, target, detail) VALUES (?, ?, ?, ?)').run(module, action, target, detail)
}
```

- [ ] **步骤 2：添加 import**

```ts
import { logOperation, logCtx } from '../logOperation'
```

- [ ] **步骤 3：升级所有 12 处调用点**

每个调用点格式转换。示例（电话簿新增，原第 506 行）：

```ts
// 旧：
logOp('电话簿', '新增', d.name)
// 新：
logOperation({ module: '电话簿', action: '新增', target: d.name, detail: '', operator: req.user?.username || '', ...logCtx(req) })
```

完整调用点清单（行号参考修改前文件）：
- 407: `logOp('话机配置', '修改', `${phone.extension} 账号配置`, params.join('&'))`
- 427: `logOp('话机配置', '修改', `${phone.extension} 远程电话本`, `URL: ${xmlUrl}`)`
- 443: `logOp('话机管理', '重启', phone.extension)`
- 463: `logOp('话机管理', '修改备注', phone.extension, remark ? ... : ...)`
- 506: `logOp('电话簿', '新增', d.name)`
- 527: `logOp('电话簿', '修改', d.name || `ID:${req.params.id}`)`
- 542: `logOp('电话簿', '删除', existing.name || `ID:${req.params.id}`)`
- 560: `logOp('电话簿', '批量删除', `${cleanIds.length} 条`)`
- 584: `logOp('电话簿', '导入', `${imported} 条`)`
- 620: `logOp('电话簿', 'PBX同步', `${synced} 个分机`)`
- 676: `logOp('电话簿', '推送', `${targetPhones.length} 台话机`, JSON.stringify(results))`

每处都补 `operator: req.user?.username || ''` 和 `...logCtx(req)`。

- [ ] **步骤 4：类型检查验证**

运行：`npm run typecheck:server`
预期：无报错

- [ ] **步骤 5：Commit**

```bash
git add server/routes/phones.ts
git commit -m "fix(phones): 升级旧 logOp 补全 operator/IP/UA"
```

---

## 任务 6：services.ts 接入操作日志

**文件：**
- 修改：`server/routes/services.ts`（POST/PUT/DELETE 三处写操作）

- [ ] **步骤 1：添加 import**

```ts
import { logOperation, logCtx } from '../logOperation'
```

- [ ] **步骤 2：POST / 新增成功后加日志**

在 `res.status(201).json(...)` 之前（约第 247 行）加：

```ts
logOperation({ module: '服务主机', action: '新增', target: name, detail: '', operator: req.user?.username || '', ...logCtx(req) })
```

- [ ] **步骤 3：PUT /:id 修改成功后加日志**

在 `res.json({ code: 200, data: toApi(updated) })` 之前（约第 290 行）加：

```ts
logOperation({ module: '服务主机', action: '修改', target: name, detail: '', operator: req.user?.username || '', ...logCtx(req) })
```

- [ ] **步骤 4：DELETE /:id 删除成功后加日志**

注意：DELETE 前需先查出 name。在 `const result = db.prepare('DELETE FROM services ...'` 之前加查询，并在删除成功后（`res.status(204).send()` 之前）加：

```ts
const existing = db.prepare('SELECT name FROM services WHERE id = ?').get(id) as { name: string } | undefined
// ... 删除 ...
logOperation({ module: '服务主机', action: '删除', target: existing?.name || `ID:${id}`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
res.status(204).send()
```

- [ ] **步骤 5：类型检查验证**

运行：`npm run typecheck:server`
预期：无报错

- [ ] **步骤 6：Commit**

```bash
git add server/routes/services.ts
git commit -m "feat(services): 服务主机增删改接入操作日志"
```

---

## 任务 7：operations.ts 接入操作日志（全量）

**文件：**
- 修改：`server/routes/operations.ts`（7 处写操作）

- [ ] **步骤 1：添加 import**

```ts
import { logOperation, logCtx } from '../logOperation'
```

- [ ] **步骤 2：POST /folders 新增**

在 `res.status(201).json(...)` 之前加：

```ts
logOperation({ module: '知识库文件夹', action: '新增', target: name, detail: '', operator: req.user?.username || '', ...logCtx(req) })
```

- [ ] **步骤 3：PUT /folders/:id 修改**

在 `res.json(...)` 之前加：

```ts
logOperation({ module: '知识库文件夹', action: '修改', target: name, detail: '', operator: req.user?.username || '', ...logCtx(req) })
```

- [ ] **步骤 4：DELETE /folders/:id 删除**

在 `res.status(204).send()` 之前加（需先查出 name）：

```ts
const existing = db.prepare('SELECT name FROM manual_folders WHERE id = ?').get(req.params.id) as { name: string } | undefined
// ... 事务删除 ...
logOperation({ module: '知识库文件夹', action: '删除', target: existing?.name || `ID:${req.params.id}`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
res.status(204).send()
```

- [ ] **步骤 5：POST /docs 新增**

在 `res.status(201).json(...)` 之前加：

```ts
logOperation({ module: '知识库文档', action: '新增', target: title, detail: '', operator: req.user?.username || '', ...logCtx(req) })
```

- [ ] **步骤 6：PUT /docs/:id 修改**

在 `res.json(...)` 之前加：

```ts
logOperation({ module: '知识库文档', action: '修改', target: req.body.title || existing.title, detail: '', operator: req.user?.username || '', ...logCtx(req) })
```

- [ ] **步骤 7：POST /docs/:id/versions/:versionId/rollback 回滚**

在 `res.json(...)` 之前加：

```ts
logOperation({ module: '知识库文档', action: '回滚', target: `${existing.title} → v${version.version_number}`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
```

- [ ] **步骤 8：DELETE /docs/:id 删除**

在 `res.status(204).send()` 之前加（先查 title）：

```ts
const existing = db.prepare('SELECT title FROM manual_docs WHERE id = ?').get(req.params.id) as { title: string } | undefined
// ... 删除 ...
logOperation({ module: '知识库文档', action: '删除', target: existing?.title || `ID:${req.params.id}`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
res.status(204).send()
```

- [ ] **步骤 9：类型检查验证**

运行：`npm run typecheck:server`
预期：无报错

- [ ] **步骤 10：Commit**

```bash
git add server/routes/operations.ts
git commit -m "feat(operations): 知识库文件夹/文档写操作全量接入操作日志"
```

---

## 任务 8：后端 logs/list 和 logs/operators 接口扩展

**文件：**
- 修改：`server/routes/admin.ts`（logs/list 路由 + 新增 logs/operators 路由）

- [ ] **步骤 1：logs/list 加 operator 参数**

在 `const endDate = ...` 后加：

```ts
const operator = (req.query.operator as string) || ''
```

在 conditions 数组后加：

```ts
if (operator) { conditions.push('operator = ?'); params.push(operator) }
```

- [ ] **步骤 2：新增 logs/operators 路由**

在 `// GET /api/v1/admin/logs/modules` 路由之后加：

```ts
// GET /api/v1/admin/logs/operators — 操作用户下拉选项（去重，排除空值）
router.get('/logs/operators', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT DISTINCT operator FROM operation_logs WHERE operator != ? ORDER BY operator ASC').all('') as { operator: string }[]
  res.json({ code: 200, data: rows.map(r => r.operator) })
})
```

- [ ] **步骤 3：类型检查验证**

运行：`npm run typecheck:server`
预期：无报错

- [ ] **步骤 4：Commit**

```bash
git add server/routes/admin.ts
git commit -m "feat(admin): logs/list 支持按用户筛选 + 新增 logs/operators 接口"
```

---

## 任务 9：前端 API 层扩展

**文件：**
- 修改：`src/api/admin.ts`

- [ ] **步骤 1：fetchLogs 加 operator 参数**

把 `fetchLogs` 函数签名和实现扩展：

```ts
export async function fetchLogs(params: { page?: number; pageSize?: number; module?: string; operator?: string; startDate?: string; endDate?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.module) qs.set('module', params.module)
  if (params.operator) qs.set('operator', params.operator)
  if (params.startDate) qs.set('startDate', params.startDate)
  if (params.endDate) qs.set('endDate', params.endDate)
  return request(`${BASE}/logs/list?${qs}`)
}
```

- [ ] **步骤 2：新增 fetchLogOperators**

```ts
export async function fetchLogOperators(): Promise<string[]> {
  return request(`${BASE}/logs/operators`)
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/api/admin.ts
git commit -m "feat(api): fetchLogs 支持 operator 参数 + 新增 fetchLogOperators"
```

---

## 任务 10：前端 AdminLogs.vue 展示层

**文件：**
- 修改：`src/views/admin/AdminLogs.vue`

- [ ] **步骤 1：加"操作用户"列**

在模板"操作"列（`prop="action"`）之后、"目标"列之前，插入：

```vue
<el-table-column prop="operator" label="操作用户" width="90">
  <template #default="{ row }">
    <span class="cell-operator">{{ row.operator || '—' }}</span>
  </template>
</el-table-column>
```

- [ ] **步骤 2：筛选栏加操作用户筛选**

在 `<script setup>` 的 ref 声明区加：

```ts
const filterOperator = ref('')
const operatorOptions = ref<string[]>([])
```

在 `loadModules` 后加：

```ts
async function loadOperators() {
  try {
    operatorOptions.value = await fetchLogOperators()
  } catch {
    operatorOptions.value = []
  }
}
```

`onMounted` 里加 `loadOperators()`。

模板筛选栏的 `el-select`（模块筛选）之后加：

```vue
<el-select
  v-model="filterOperator"
  placeholder="操作用户"
  clearable
  size="small"
  style="width: 130px"
>
  <el-option v-for="u in operatorOptions" :key="u" :label="u" :value="u" />
</el-select>
```

- [ ] **步骤 3：loadLogs 传 operator 参数 + watch**

`loadLogs` 调用 `fetchLogs` 时加 `operator: filterOperator.value || undefined`。

`watch(filterModule, ...)` 之后加：

```ts
watch(filterOperator, () => {
  page.value = 1
  loadLogs()
})
```

- [ ] **步骤 4：搜索框扩展**

`filteredLogs` computed 的 filter 条件加：

```ts
(row.operator || '').toLowerCase().includes(q)
```

- [ ] **步骤 5：import 更新**

把 `import { fetchLogs, clearLogs, fetchLogModules } from '../../api/admin'` 改为：

```ts
import { fetchLogs, clearLogs, fetchLogModules, fetchLogOperators } from '../../api/admin'
```

- [ ] **步骤 6：样式补充**

在 `<style scoped>` 加：

```css
.cell-operator { font-size: 12px; color: var(--ops-text-secondary); }
```

- [ ] **步骤 7：构建验证**

运行：`npm run build:client`
预期：无类型错误，构建通过

- [ ] **步骤 8：Commit**

```bash
git add src/views/admin/AdminLogs.vue
git commit -m "feat(admin): 操作日志列表加操作用户列和筛选"
```

---

## 任务 11：端到端验证

无自动化测试，用 curl 手动验证关键路径。

- [ ] **步骤 1：启动服务器**

运行：`npm run dev:server`（或 `npm start`）
预期：服务器启动在 PORT 3001

- [ ] **步骤 2：验证 logs/operators 接口**

运行：`curl -s http://localhost:3001/api/v1/admin/logs/operators | head -c 200`
预期：返回 `{ "code": 200, "data": [...] }`，data 是字符串数组

- [ ] **步骤 3：验证 logs/list 按用户筛选**

先登录拿 token（如已有 token 直接用），再：

```bash
curl -s "http://localhost:3001/api/v1/admin/logs/list?operator=admin&pageSize=5" -H "Authorization: Bearer <TOKEN>" | head -c 300
```

预期：返回的 rows 中所有 operator 字段都为 `admin`

- [ ] **步骤 4：验证写操作产生日志**

调一次 services POST 新增（需 token），再查 logs/list 看最新一条 module='服务主机'、operator 为当前用户。

- [ ] **步骤 5：验证前端页面**

启动 `npm run dev:client`，浏览器打开 Admin → 操作日志，确认：
- "操作用户"列显示
- 筛选栏有操作用户下拉
- 选中某用户后列表刷新

---

## 自检

**规格覆盖度：**
- 第一节（共享模块）→ 任务 1-4 ✅
- 第二节（前端展示层）→ 任务 8-10 ✅
- 第三节（phones 升级）→ 任务 5 ✅
- 第四节（services 接入）→ 任务 6 ✅
- 第五节（operations 全量接入）→ 任务 7 ✅
- 测试要点 → 任务 11 ✅

**占位符扫描：** 无"待定/TODO/后续实现"。

**类型一致性：**
- `logOperation` 参数对象字段（module/action/target/operator/...）在所有任务中一致
- `logCtx(req)` 展开用法在任务 2-7 中一致
- `operator: req.user?.username || ''` 在所有调用点一致
- 前端 `fetchLogOperators` / `filterOperator` / `operatorOptions` 命名在任务 9-10 中一致

**无遗漏：** 规格变更清单 9 个文件全部覆盖。
