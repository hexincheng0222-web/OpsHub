# 操作日志添加操作用户记录 — 设计规格

> 创建日期：2026-07-17
> 状态：已评审
> 相关模块：操作日志（operation_logs）、前端 Admin 页、各业务路由

## 1. 背景与目标

### 1.1 现状

`operation_logs` 表**已有** `operator` 字段，`admin`、`computer-procurement`、`phone-procurement` 三个路由已通过本地 `logOperation` 函数写入操作用户（`req.user?.username`）、IP、UA 等信息。

但存在三个问题：

1. **前端未展示**：`AdminLogs.vue` 表格无"操作用户"列，也无按用户筛选能力。
2. **phones.ts 用旧函数**：第 483-485 行的 `logOp(module, action, target, detail)` 只写 4 列，缺 operator/IP/UA。
3. **services.ts / operations.ts 未接入**：写操作完全不记日志。
4. **重复代码**：`admin.ts`、`computer-procurement.ts`、`phone-procurement.ts` 三处各自定义了几乎一样的 `logOperation` 函数。

### 1.2 目标

- 前端操作日志列表展示"操作用户"，支持按用户筛选和搜索。
- 所有业务模块的写操作统一记录操作用户、IP、UA、请求方法、路径。
- 消除重复的 `logOperation` 定义，统一到共享模块。

### 1.3 不在范围

- 日志保留策略（已有 30 天自动清理，不变更）。
- 日志导出 / 审计告警（本期不做）。

## 2. 方案总览

采用**全量接入**方案：

| 层 | 动作 |
|---|---|
| 架构 | 抽共享 `server/logOperation.ts`，统一 `logOperation` + `logCtx` |
| 前端 | 加"操作用户"列 + 按用户筛选 + 搜索框扩展 + 后端接口扩展 |
| phones.ts | 删旧 `logOp`，改用共享函数，所有调用点补全字段 |
| services.ts | 服务主机增删改 3 处接入 |
| operations.ts | 文件夹/文档的增删改回滚 7 处接入（favorite 不接） |

## 3. 架构层设计

### 3.1 新增文件：`server/logOperation.ts`

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

### 3.2 重构影响

- `server/routes/admin.ts`：删除本地 `logOperation` 定义（约 15 行），改为 import。所有调用点加 `...logCtx(req)`。
- `server/routes/computer-procurement.ts`：删除本地 `logOperation`，复用共享版本（其 `logCtx` 已存在，直接改用共享的）。
- `server/routes/phone-procurement.ts`：同上。

**净删代码：约 30 行重复定义。**

## 4. 前端展示层设计

### 4.1 文件变更

- `src/views/admin\AdminLogs.vue`
- `src/api/admin.ts`

### 4.2 表格加列

在"操作"列后、"目标"列前，加"操作用户"列（宽 90）：

```vue
<el-table-column prop="operator" label="操作用户" width="90">
  <template #default="{ row }">
    <span class="cell-operator">{{ row.operator || '—' }}</span>
  </el-table-column>
```

历史数据中 phones 旧函数写入的 operator 为空，显示"—"。

### 4.3 筛选栏扩展

新增 `filterOperator` ref + `operatorOptions`（动态下拉，来源 `GET /logs/operators`）：

```vue
<el-select v-model="filterOperator" placeholder="操作用户" clearable size="small" style="width: 130px">
  <el-option v-for="u in operatorOptions" :key="u" :label="u" :value="u" />
</el-select>
```

`watch(filterOperator, ...)` 同模块筛选，变更时重置页码并 `loadLogs()`。

### 4.4 搜索框扩展

`filteredLogs` computed 的匹配字段加 `row.operator`。

### 4.5 后端接口扩展

**`GET /api/v1/admin/logs/list`**：

- 新增查询参数 `operator`
- WHERE 条件加 `operator = ?`（精确匹配）

**新增 `GET /api/v1/admin/logs/operators`**：

```sql
SELECT DISTINCT operator FROM operation_logs WHERE operator != '' ORDER BY operator ASC
```

返回 `{ code: 200, data: string[] }`，用于前端下拉。

## 5. phones.ts 旧函数升级

### 5.1 变更

- 删除本地 `logOp(module, action, target, detail)` 函数。
- import 共享 `logOperation` + `logCtx`。
- 所有 `logOp(` 调用点（电话簿/分机/设备等，约 5-8 处）改为：

```ts
logOperation({
  module: '电话簿',
  action: '新增',
  target: name,
  detail: '',
  operator: req.user?.username || '',
  ...logCtx(req),
})
```

## 6. services.ts 接入

### 6.1 接入点（3 处）

| 路由 | module | action |
|---|---|---|
| `POST /` | 服务主机 | 新增 |
| `PUT /:id` | 服务主机 | 修改 |
| `DELETE /:id` | 服务主机 | 删除 |

### 6.2 不接入

- `favorite` 2 处：用户级行为，非系统审计。
- `check-all` / `check`：只读探测。

### 6.3 写法

写操作成功后：

```ts
logOperation({
  module: '服务主机',
  action: '新增',
  target: name,
  detail: '',
  operator: req.user?.username || '',
  ...logCtx(req),
})
```

## 7. operations.ts 接入（全量）

### 7.1 接入点（7 处）

| 路由 | module | action |
|---|---|---|
| `POST /folders` | 知识库文件夹 | 新增 |
| `PUT /folders/:id` | 知识库文件夹 | 修改 |
| `DELETE /folders/:id` | 知识库文件夹 | 删除 |
| `POST /docs` | 知识库文档 | 新增 |
| `PUT /docs/:id` | 知识库文档 | 修改 |
| `POST /docs/:id/versions/:versionId/rollback` | 知识库文档 | 回滚 |
| `DELETE /docs/:id` | 知识库文档 | 删除 |

### 7.2 不接入

- `favorite` 2 处：用户级行为。

### 7.3 日志量说明

文档新增/修改较频繁，接入后日志量会增长。如后续审计价值不足，可再降级为"只记删除/回滚"。

## 8. 数据模型

不变更表结构。`operation_logs` 现有字段已满足：

| 字段 | 用途 | 来源 |
|---|---|---|
| `module` | 模块名 | 硬编码字符串（如 '服务主机'） |
| `action` | 操作 | 硬编码（新增/修改/删除/回滚） |
| `target` | 操作目标 | 名称或 ID |
| `detail` | 详情 | 脱敏后的 JSON |
| `operator` | 操作用户 | `req.user?.username` |
| `ip_address` | IP | `x-forwarded-for` / `remoteAddress` |
| `user_agent` | UA | `req.headers['user-agent']` |
| `status` | 成功/失败 | 默认 success |
| `request_method` | 请求方法 | `req.method` |
| `request_path` | 请求路径 | `req.path` |

## 9. 错误处理

- `logOperation` 失败**不应**影响主业务。各调用点保持现有 try/catch 模式；共享函数内部若抛错，由调用方捕获（当前实现未加 try/catch，沿用现有行为）。
- 前端接口失败：`fetchLogOperators` 失败时降级为空数组，筛选不可用但不影响列表。

## 10. 测试要点

### 10.1 后端

- 各接入点写操作后，`operation_logs` 表应有一行 `operator = 当前用户名` 的记录。
- `GET /logs/list?operator=xxx` 只返回该用户日志。
- `GET /logs/operators` 返回去重非空用户名列表。
- phones.ts 旧 `logOp` 已删除，无残留引用。

### 10.2 前端

- 表格"操作用户"列正确渲染，空值显示"—"。
- 按用户筛选下拉选项来自接口，选中后列表刷新。
- 搜索框输入用户名可匹配。

### 10.3 回归

- admin / computer-procurement / phone-procurement 日志行为不变（重构等价）。
- 现有 30 天自动清理、概览统计、趋势接口不受影响。

## 11. 变更清单（实现时参考）

| 文件 | 动作 |
|---|---|
| `server/logOperation.ts` | **新增** |
| `server/routes/admin.ts` | 删本地 logOperation，改 import，调用点加 `...logCtx(req)` |
| `server/routes/computer-procurement.ts` | 删本地 logOperation，改 import |
| `server/routes/phone-procurement.ts` | 删本地 logOperation，改 import |
| `server/routes/phones.ts` | 删旧 `logOp`，改 import，所有调用点升级 |
| `server/routes/services.ts` | 接入 3 处 |
| `server/routes/operations.ts` | 接入 7 处 |
| `src/views/admin/AdminLogs.vue` | 加列 + 筛选 + 搜索扩展 |
| `src/api/admin.ts` | 加 `fetchLogOperators`，`fetchLogs` 支持 operator 参数 |
