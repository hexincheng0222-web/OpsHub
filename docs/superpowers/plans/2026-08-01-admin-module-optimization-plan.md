# 系统管理模块优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复系统管理模块已确认的 1 个统计 bug，并落实评估报告中的高优先级优化（操作日志详情/导出/状态筛选、用户管理密码校验、监控配置去重、服务导入 hostId 解析、ATCOM 测试连接）与新增功能（默认密码强制修改引导、数据备份管理页）。

**架构：** 前端以 Vue3 + Element Plus 组件化改造（复用现有 AdminLogs.vue / AdminUsers.vue / LogMonitorConfig.vue / AdminAtcomConfig.vue 结构），后端 Express 新增备份列表/下载/触发接口（复用 scripts/backup-db.mjs 逻辑），沿用现有共享工具（excel.ts、request、logOperation）。

**技术栈：** Vue3 + Element Plus + TypeScript、Express 5、better-sqlite3、node-cron

---

## 文件结构

| 文件 | 职责 | 动作 |
|------|------|------|
| `src/views/admin/AdminOverview.vue:42` | 概览统计卡片 | 修改（修 bug） |
| `src/views/admin/AdminLogs.vue` | 操作日志页 | 修改（详情抽屉 + 导出 + 状态筛选） |
| `server/routes/admin.ts` | 日志列表接口 | 修改（加 status 筛选） |
| `src/api/admin.ts` | admin API | 修改（fetchLogs 加 status、fetchLogExport） |
| `src/views/admin/AdminUsers.vue` | 用户管理页 | 修改（密码校验 + 确认密码 + 创建时间列） |
| `src/views/admin/LogMonitorConfig.vue` | 日志监控配置 | 修改（移除 LLM 区块改跳转） |
| `src/views/admin/AdminServices.vue` | 服务管理页 | 修改（导入解析 hostId） |
| `src/views/admin/AdminAtcomConfig.vue` | ATCOM 配置 | 修改（加测试连接） |
| `server/routes/phones.ts` | ATCOM 后端 | 修改（加 test 接口） |
| `src/api/phones.ts` | phones API | 修改（加 testAtcom） |
| `src/App.vue` 或路由守卫 | 默认密码引导 | 修改（admin123 检测提示） |
| `server/routes/backup.ts` | 备份管理接口 | 新增 |
| `src/api/backup.ts` | 备份 API | 新增 |
| `src/views/admin/AdminBackup.vue` | 备份管理页 | 新增 |
| `src/router/index.ts` | 路由 | 修改（加备份路由） |
| `src/views/admin/AdminView.vue` | 菜单 | 修改（加备份菜单） |
| `server/index.ts` | 应用入口 | 修改（注册 backup 路由） |

---

### 任务 1：修复概览统计 bug

**文件：**
- 修改：`src/views/admin/AdminOverview.vue:42`

- [ ] **步骤 1：修改字段名**

```ts
// 修改前
{ label: '电脑型号', value: stats.value.computerPurchaseModels ?? 0, ... }
// 修改后
{ label: '电脑型号', value: stats.value.computerModels ?? 0, ... }
```

- [ ] **步骤 2：验证**

运行：`npx vue-tsc -p tsconfig.app.json --noEmit`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/views/admin/AdminOverview.vue
git commit -m "fix(admin): 概览电脑型号统计字段名与后端对齐"
```

### 任务 2：操作日志详情抽屉 + 导出 + 状态筛选

**文件：**
- 修改：`server/routes/admin.ts`（/logs/list 加 status 参数）
- 修改：`src/api/admin.ts`（fetchLogs 加 status、新增 exportLogs）
- 修改：`src/views/admin/AdminLogs.vue`（状态筛选 + 详情抽屉 + 导出按钮）

- [ ] **步骤 1：后端 /logs/list 支持 status 筛选**

```ts
// server/routes/admin.ts /logs/list 内，在 operator 条件后加：
const status = (req.query.status as string) || ''
// ...
if (status) { conditions.push('status = ?'); params.push(status) }
```

- [ ] **步骤 2：前端 api/admin.ts**

```ts
// fetchLogs 参数加 status?: string；新增导出
export async function exportLogs(params: { module?: string; operator?: string; status?: string; startDate?: string; endDate?: string; keyword?: string }) {
  const qs = new URLSearchParams()
  if (params.module) qs.set('module', params.module)
  if (params.operator) qs.set('operator', params.operator)
  if (params.status) qs.set('status', params.status)
  if (params.startDate) qs.set('startDate', params.startDate)
  if (params.endDate) qs.set('endDate', params.endDate)
  if (params.keyword) qs.set('keyword', params.keyword)
  return request(`${BASE}/logs/list?${qs}`) // 全量（无分页）
}
```

- [ ] **步骤 3：AdminLogs.vue 加状态筛选下拉 + 导出按钮 + 详情抽屉**

在 filter-bar 加：
```vue
<el-select v-model="filterStatus" placeholder="状态" clearable size="small" style="width: 90px">
  <el-option label="成功" value="success" />
  <el-option label="失败" value="fail" />
</el-select>
```
表格行点击打开抽屉（显示 module/action/target/operator/ip/ua/method/path/status/detail 完整 JSON）；header 加"导出"按钮（下载当前筛选的 xlsx）。

- [ ] **步骤 4：验证**

运行：`npx vue-tsc -p tsconfig.app.json --noEmit`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add server/routes/admin.ts src/api/admin.ts src/views/admin/AdminLogs.vue
git commit -m "feat(admin): 操作日志加状态筛选、详情抽屉与导出"
```

### 任务 3：用户管理密码校验 + 确认密码 + 创建时间列

**文件：**
- 修改：`src/views/admin/AdminUsers.vue`

- [ ] **步骤 1：加前端密码强度校验（与后端 validatePasswordStrength 一致）**

```ts
function validatePassword(pwd: string): string | null {
  if (!pwd) return '密码不能为空'
  if (pwd.length < 8) return '密码长度至少 8 字符'
  if (pwd.length > 64) return '密码长度最多 64 字符'
  if (!/[a-zA-Z]/.test(pwd)) return '密码必须包含字母'
  if (!/\d/.test(pwd)) return '密码必须包含数字'
  return null
}
```
新增用户/重置密码提交前调用校验；重置密码对话框加"确认密码"输入框并校验一致。

- [ ] **步骤 2：表格加创建时间列**

```vue
<el-table-column label="创建时间" width="150">
  <template #default="{ row }">
    <span class="cell-time">{{ formatTime(row.created_at) }}</span>
  </template>
</el-table-column>
```
（后端 users 列表已返回 created_at）

- [ ] **步骤 3：验证 + Commit**

运行：`npx vue-tsc -p tsconfig.app.json --noEmit` 预期 PASS，然后 commit。

### 任务 4：日志监控配置去重（LLM 区块改跳转）

**文件：**
- 修改：`src/views/admin/LogMonitorConfig.vue`

- [ ] **步骤 1：移除 LLM 配置表单区块（API 端点/模型/Key/Temperature/Tokens/超时/重试），替换为跳转提示**

```vue
<el-divider content-position="left">LLM 配置</el-divider>
<el-form-item label="LLM 配置">
  <span style="color: var(--el-text-color-secondary); margin-right: 12px">LLM 参数已移至独立页面管理</span>
  <el-button type="primary" size="small" @click="$router.push('/admin/log-monitor/llm-test')">前往 LLM 配置</el-button>
</el-form-item>
```

- [ ] **步骤 2：loadConfig/handleSave 中移除 llm 字段处理（保留 system_prompt 归属 llm 块不变）**

注意：form 仍包含 llm 块（后端 saveConfigPartial 需要），但表单不展示 LLM 项。保存时保留原 llm 值不覆盖：在 handleSave 的 payload 中不包含 llm（后端只更新传入的键）。

- [ ] **步骤 3：验证 + Commit**

运行：`npx vue-tsc -p tsconfig.app.json --noEmit` 预期 PASS，然后 commit。

### 任务 5：服务管理导入按主机名解析 hostId

**文件：**
- 修改：`src/views/admin/AdminServices.vue`

- [ ] **步骤 1：导入循环中按主机名解析 hostId**

```ts
// handleImport 内，构造 hostMap 后：
const hostMap = new Map(hosts.value.map((h: any) => [h.name, h.id]))
// 每行：
hostId: r['主机'] ? (hostMap.get(r['主机']) ?? null) : null,
```
同时导出时表头加"主机"列（当前已含）。

- [ ] **步骤 2：验证 + Commit**

运行：`npx vue-tsc -p tsconfig.app.json --noEmit` 预期 PASS，然后 commit。

### 任务 6：ATCOM 配置加测试连接

**文件：**
- 修改：`server/routes/phones.ts`（新增测试接口）
- 修改：`src/api/phones.ts`（新增 testAtcom）
- 修改：`src/views/admin/AdminAtcomConfig.vue`（加测试按钮）

- [ ] **步骤 1：后端测试接口**

```ts
// GET /api/v1/phones/atcom/test 或复用现有 health 逻辑
router.get('/atcom/test', async (req: Request, res: Response) => {
  try {
    const result = await atcomRequest('', 'get_sysinfo', 'GET') // 简单探活
    res.json({ code: 200, data: { success: true, ...result } })
  } catch (e: any) {
    res.json({ code: 200, data: { success: false, error: e.message } })
  }
})
```
（需查看 phones.ts 现有 atcomRequest 调用方式后对齐）

- [ ] **步骤 2：前端按钮 + 结果展示**

```vue
<el-button :loading="testing" @click="handleTestConnection">测试连接</el-button>
<!-- 结果用 el-alert success/error 展示 -->
```

- [ ] **步骤 3：验证 + Commit**

### 任务 7：默认密码强制修改引导

**文件：**
- 修改：`server/routes/auth.ts`（/me 返回 is_default_password）
- 修改：`src/stores/auth.ts` 或 `src/App.vue`（检测提示）
- 修改：`src/views/admin/AdminUsers.vue` 或新增引导对话框

- [ ] **步骤 1：后端标记默认密码**

```ts
// GET /auth/me 返回 is_default_password: bcrypt.compareSync('admin123', user.password_hash)
```
仅当用户名为 admin 且密码为 admin123 时返回 true。

- [ ] **步骤 2：前端引导**

`fetchMe` 后若 `is_default_password`，弹窗提示"当前使用默认密码，请立即修改"并跳转用户管理（或调密码修改接口）。

- [ ] **步骤 3：验证 + Commit**

### 任务 8：数据备份管理页

**文件：**
- 新增：`server/routes/backup.ts`
- 修改：`server/index.ts`（注册路由）
- 新增：`src/api/backup.ts`
- 新增：`src/views/admin/AdminBackup.vue`
- 修改：`src/router/index.ts`、`src/views/admin/AdminView.vue`

- [ ] **步骤 1：后端接口（复用 scripts/backup-db.mjs 逻辑）**

```ts
// GET /api/v1/backup/list — 备份文件列表（data/backups/*.bak.gz，按时间倒序）
// POST /api/v1/backup — 手动触发备份（执行备份逻辑）
// GET /api/v1/backup/:filename/download — 下载备份文件
```

- [ ] **步骤 2：前端页面 + 菜单 + 路由**

页面：备份列表表格（文件名/大小/时间）+ 触发备份 + 下载按钮。

- [ ] **步骤 3：验证 + Commit**

### 任务 9：全量验证

- [ ] **步骤 1：运行完整检查**

```bash
npm run typecheck:server && npx vue-tsc -p tsconfig.app.json --noEmit && npm run build
```
预期：全部 PASS，EXIT 0

- [ ] **步骤 2：最终 Commit**

```bash
git add -A && git commit -m "feat(admin): 系统管理模块优化落地（备份页/日志详情/密码引导等）"
```
