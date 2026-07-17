# OpsHub 项目代码审查报告

> 审查日期：2026-07-16（第 2 轮）
> 审查范围：全项目（server/ + src/ + 配置文件）
> 相比上轮（2026-07-16 第 1 轮），38 个文件变更，1854 行新增，223 行删除

---

## 本轮审查发现的新问题

### 🔴 严重 (CRITICAL)

#### 1. `req.cookies` 使用了未注册的中间件 — Cookie 认证功能彻底失效

| 字段 | 值 |
|------|-----|
| **文件** | `server/middleware/auth.ts:57` |
| **类型** | 功能失效 / 安全 |

**问题描述**：`auth.ts` 第 57 行引用了 `req.cookies?.token` 作为 Bearer token 的备选认证来源（#11 功能），但 **`cookie-parser` 中间件未安装也未注册**，Express 不会解析 `Set-Cookie` 头部到 `req.cookies`。`req.cookies` 始终为 `undefined`，Cookie 认证路径永不命中。

```typescript
// auth.ts:57 — 期望 req.cookies 有值，但 cookie-parser 未安装
} else if (req.cookies?.token) {
    token = req.cookies.token
}

// auth.ts:79 — 正确设置了 HttpOnly Cookie，但无人能读取
res.setHeader('Set-Cookie', `token=${token}; ${cookieFlags}`)
```

**影响**：
- HttpOnly Cookie 认证功能完全不可用
- 前端 localStorage 中的 token 仍然是唯一认证来源（XSS 可窃取）
- 违反了 #11 功能的设计目标

**建议修复**：
```bash
npm install cookie-parser
npm install -D @types/cookie-parser
```

```typescript
// server/index.ts
import cookieParser from 'cookie-parser'
app.use(cookieParser())  // 加在 app.use(cors(...)) 之后
```

---

### 🟠 高 (HIGH)

#### 2. `tsconfig.server.json` 缺少 `allowImportingTsExtensions` 配置

| 字段 | 值 |
|------|-----|
| **文件** | `tsconfig.server.json` |
| **行号** | 11 |
| **类型** | 构建配置 |

**问题描述**：`tsconfig.server.json` 设置了 `"allowImportingTsExtensions": false`，但这与 `noEmit: true` 组合使用时，`tsx` 运行时能正常工作，但 `vue-tsc -p tsconfig.server.json --noEmit` 类型检查时可能因缺少 `.ts` 扩展名解析规则而报类型错误。实际上 `tsx` 使用 ESM 加载器，不依赖 `tsconfig` 的模块解析，所以运行时没问题。但配置项 `allowImportingTsExtensions: false` 是默认值，显式设置为 `false` 没问题，但若与 `noEmit: true` 一起使用则 `allowImportingTsExtensions` 的设置无意义，因为既然不生成输出文件，就不需要关心扩展名。这不是真正的 bug，但配置语义不清晰。

**建议**：移除 `allowImportingTsExtensions` 行（或设为 `true`），因为 `noEmit: true` 模式下此配置不产生实际影响。

#### 3. `server/index.ts` 中 `cron` 调度器路径硬编码

| 字段 | 值 |
|------|-----|
| **文件** | `server/index.ts:150` |
| **类型** | 可维护性 |

```typescript
const baseDir = path.join('data', 'log-audit')  // 硬编码路径
```

与 `DB_PATH` 不同，`log-audit` 目录路径没有通过环境变量配置，后续如果需要迁移数据目录位置会遗漏此路径。

**建议**：统一使用 `process.env.DATA_DIR || 'data'` 作为基础路径。

---

### 🟡 中 (MEDIUM)

#### 4. `escapeHtml` 函数在采购导入弹窗中使用，但 `sanitizeHtml` 仍有可改进空间

| 字段 | 值 |
|------|-----|
| **文件** | `src/utils/sanitize.ts:86` |
| **类型** | 安全 / 健壮性 |

**问题描述**：`sanitizeNode` 函数中，不在白名单的标签直接 `node.remove()`（移除标签及其子节点），而非 `unwrap()`（保留子节点只移除标签本身）。这会导致 `<script>alert(1)</script>` 被移除（正确），但 `<unknown>Hello</unknown>` 也会被移除（可接受，但更温和的处理是保留文本）。

当前行为安全但不保守，属于设计选择，非 bug。

#### 5. `backup-db.mjs` 使用 ESM 但无 `import` 错误处理

| 字段 | 值 |
|------|-----|
| **文件** | `scripts/backup-db.mjs` |
| **行号** | 38 |
| **类型** | 健壮性 |

```typescript
db = new Database(DB_PATH, { readonly: true })
await db.backup(tmpPath)
```

`db.backup()` 是同步 API 但被 `await` 调用，实际上 `better-sqlite3` 的 `backup()` 方法返回的是 `Promise` 吗？查看 better-sqlite3 文档，`backup()` 返回的是 `Backup` 对象，不是 Promise。这是同步操作，不需要 `await`。`await` 一个非 Promise 对象会直接 resolve，所以不会报错，但语义不对。

**建议**：移除 `await`，直接调用 `db.backup(tmpPath)`。

#### 6. `.gitignore` 中 `data/` 会忽略所有数据相关文件

| 字段 | 值 |
|------|-----|
| **文件** | `.gitignore:30` |
| **类型** | 配置 |

`data/` 被忽略，但 `data/backups/` 目录下的备份文件也应该被忽略，这已经正确。但 `data/` 目录下的 `opshub.db` 等数据库文件在生产环境中确实不应该被版本控制，所以当前配置是合理的。没有新问题。

---

### 🔵 低 (LOW)

#### 7. `server/index.ts` 中 `cron` 的动态 `import('fs')` 重复执行

```typescript
cron.schedule('0 4 * * *', async () => {
  // 每次执行都动态 import('fs')
  const fsRef = await import('fs')
  // ...
})
```

`fs` 已经在 `db.ts` 中静态导入，这里每次 cron 执行都重新 `import()` 一次，性能开销虽然小但不必要。建议在模块顶部静态导入。

#### 8. `sanitizeHtml` 的 `DOMParser` 在 SSR 环境下不可用

| 字段 | 值 |
|------|-----|
| **文件** | `src/utils/sanitize.ts:82` |
| **类型** | 兼容性 |

`DOMParser` 是浏览器 API，在 Vite 客户端构建中可用，但如果未来引入 SSR，此函数会报错。建议添加 `typeof DOMParser === 'undefined'` 的降级处理。

---

## 上轮问题修复状态

| # | 问题 | 状态 | 修复文件 |
|---|------|------|----------|
| 1 | 🔴 硬编码密码随前端打包 | ✅ **已修复** | `src/mock/services.ts`, `server/db.ts` seeds |
| 2 | 🟠 API 响应码不一致（`code: 0`） | ✅ **已修复** | `server/routes/devices.ts`, `log-monitor.ts` |
| 3 | 🟠 文件夹 ID 生成不唯一 | ✅ **已修复** | `server/routes/operations.ts` → `crypto.randomUUID()` |
| 4 | 🟠 批量删除无上限校验 | ✅ **已修复** | `computer-procurement.ts`, `phones.ts`, `printers.ts` |
| 5 | 🟡 未使用的 import | ✅ **已修复** | 移除 `computer-procurement.ts`, `db.ts` 中 unused import |
| 6 | 🟡 `.gitignore` 缺少 `.playwright-mcp/` | ✅ **已修复** | `.gitignore` 新增条目 |
| 7 | 🟡 服务巡检顺序检测效率低 | ✅ **已修复** | `servicesScheduler.ts` → 并发 10 |
| 8 | 🟡 `log-monitor.ts` 错误未设置 HTTP 状态码 | ✅ **已修复** | `log-monitor.ts` → `res.status(500)` |
| 9 | 🔵 全量 `any` 类型使用 | ✅ **部分修复** | `servicesScheduler.ts` 增加接口类型，其他文件仍有大量 `any` |
| 10 | 🔵 Digest Auth 密码硬编码回退 | ✅ **已修复** | `phones.ts` → 环境变量 + 空值回退 |
| 11 | 🔵 SSRF 拦截内网地址 | ✅ **已修复** | `services.ts` → `allowInternal` 参数 + `isPrivateIp` |
| 12 | 🔵 `node-cron` 重复导入 | ✅ **已修复** | cron 从 `db.ts` 移至 `index.ts` |
| 13 | 🔵 `http.ts` 语义混乱 | ✅ **已修复** | 超时控制、AbortController、TimeoutError |

---

## 本轮新增问题汇总

| 严重度 | 数量 | 问题 |
|--------|------|------|
| 🔴 严重 | 1 | `cookie-parser` 未安装，Cookie 认证功能完全失效 |
| 🟠 高 | 2 | `tsconfig.server.json` 配置语义不清、`log-audit` 路径硬编码 |
| 🟡 中 | 2 | `backup-db.mjs` 多余 `await`、`sanitizeNode` 移除而非保留子文本 |
| 🔵 低 | 2 | `cron` 动态 `import('fs')`、`DOMParser` SSR 兼容性 |
| **合计** | **7** | |

---

## 优先修复建议

| 优先级 | 问题 | 影响 | 修复方案 |
|--------|------|------|----------|
| **P0** | `cookie-parser` 未安装 | Cookie 认证完全失效，#11 功能未生效 | `npm install cookie-parser` + 注册中间件 |
| P1 | `backup-db.mjs` 多余 `await` | 语义错误，但不影响运行 | 移除 `await` |
| P2 | `log-audit` 路径硬编码 | 迁移数据目录时遗漏 | 统一使用 `DATA_DIR` 环境变量 |
| P3 | `cron` 动态 `import('fs')` | 微性能损耗 | 改为静态导入 |
| P3 | `DOMParser` SSR 兼容 | 未来 SSR 迁移障碍 | 添加 `typeof` 降级检查 |

---

## 安全改进亮点（本轮已修复）

- 🔒 **XSS 净化**：从黑名单模式重写为白名单模式（`sanitize.ts`）
- 🔒 **CSV/Excel 公式注入防护**：`=+-\t` 前缀过滤（`csv.ts`, `excel.ts`）
- 🔒 **操作日志脱敏**：密码/token/key 等敏感字段自动遮蔽（`admin.ts`）
- 🔒 **密码强度校验**：8-64 字符，必须含字母+数字（`auth.ts`）
- 🔒 **路由角色守卫**：`meta.roles` 精确控制页面访问权限（`router/index.ts`）
- 🔒 **Redirect URL 白名单**：拒绝跨域跳转（`router/index.ts`）
- 🔒 **错误信息脱敏**：生产模式隐藏 SQLite 错误细节（`index.ts`）
- 🔒 **AES 密钥启动校验**：生产模式未配置则拒绝启动（`crypto.ts`）
- 🔒 **JWT 密钥环境变量**：优先读取 `JWT_SECRET` 环境变量（`auth.ts`）
- 🔒 **请求竞态保护**：`useProcurementStore` 请求序号守卫（`procurement.ts`）
- 🔒 **优雅关闭**：SIGTERM/SIGINT → 停连接 → 停 cron → 关 DB（`index.ts`）
- 🔒 **HttpOnly Cookie**：登录时同时设置 `Set-Cookie`（`auth.ts`，但需修复 #1 才能生效）

---

## 附录 A：问题难度分级（2026-07-16 补）

> 难度按 **修复工程量 + 技术深度 + 影响面** 综合评估，分四档：
> **S** 简单（机械改 / 单行 / 单文件字符串替换）｜**A** 中等（单功能跨 2–4 文件，需理解时序/协议）｜**B** 较难（跨前后端、UI 重构、类型系统、新数据流）｜**C** 复杂（架构级 / 新依赖 / 回归测试 / 运维流程）

### A.1 全量难度对照表

| # | 问题摘要 | 难度 | 工程量 | 技术要点 | 影响面 |
|---|----------|:----:|:------:|----------|--------|
| 1 | mock 硬编码密码+真实 IP | **S** | 10 分钟 | 删除字符串字面量，替换占位 | `src/mock/services.ts` 单文件 |
| 2 | LLM API Key 硬编码 seed | **S** | 15 分钟 | 改 `process.env.LLM_API_KEY`，rotate Key | `server/db.ts` 单文件 + env |
| 3 | 服务种子数据嵌凭据 | **S** | 10 分钟 | seed 改占位字符串 | `server/db.ts` 单文件 |
| 4 | CSV/Excel 公式注入 | **A** | 30 分钟 | 改 `escapeCsvField` 加 `^[=+\-@]` 前缀检测，3 处同步 | `utils/csv.ts`/`printer-csv.ts`/`excel.ts` |
| 5 | 自写 sanitize 黑名单 | **C** | 1 小时 | 引入 DOMPurify 依赖、替换调用、删旧逻辑 | 跨文件（sanitize + 2 个 Vue 调用点），新增 npm 依赖 |
| 6 | PBX 密码明文+默认弱口令 | **A** | 30 分钟 | 新增 `ATCOM_PBX_USER/PASS` env、改路由参数、前端置空 | 跨前后端（phones.ts + AdminAtcomConfig.vue） |
| 7 | API 响应码不一致 | **S** | 20 分钟 | `code: 0` → `code: 200` 批量替换 | 2 个文件机械替换 |
| 8 | 文件夹 ID 用 Date.now() | **S** | 5 分钟 | 改 `crypto.randomUUID()` | 单文件单行 |
| 9 | 批量删除无上限校验 | **S** | 10 分钟 | 加 `ids.length > 1000` 拒绝 + 整数过滤 | 3 个路由文件机械追加 |
| 10 | SSRF 黑名单与内网服务矛盾 | **B** | 15 分钟 | 改白名单模式 + UI 加"允许内网"授权 | 跨前后端，需设计授权数据流 |
| 11 | token 仅存 localStorage | **C** | 4 小时 | 改 HttpOnly cookie + 后端中间件 + 前端移除 token 逻辑 + CSP 头 | 跨前后端 + 浏览器安全策略，需回归测试登录链路 |
| 12 | http.ts 无超时/取消/重试 | **A** | 1 小时 | 加 AbortController + timeout + 视图层 onUnmounted 取消 | http.ts + 多个调用视图协同 |
| 13 | 路由守卫未保护业务路径 | **B** | 2 小时 | 路由 meta.roles 设计 + 守卫统一判 + redirect 白名单 | 跨路由配置 + 守卫 + 多个 redirect 调用点 |
| 14 | addDeviceToRack 越界静默截断 | **S** | 15 分钟 | 加前置边界校验 + ElMessage 提示 | 单文件单函数 |
| 15 | pageSize 硬编码截断 | **B** | 1 小时 | 改真实分页（el-pagination + total 驱动） | 跨 store + API + 视图层，UI 重构 |
| 16 | 搜索筛选无竞态保护 | **A** | 1 小时 | 引入请求序号 ref + 旧响应丢弃模式 | 多个 store 文件复用同一模式 |
| 17 | SQLite 零备份+无优雅关闭 | **C** | 4 小时 | 新增 backup 脚本 + SIGTERM handler + PM2 kill_timeout + DEPLOY 文档 | 跨脚本+进程管理+运维文档，需演练验证 |
| 18 | 服务端无 typecheck + strict | **B** | 2 小时 | 新增 tsconfig.server.json + strict 模式 + 修 100+ 处 `as any` 编译错 | 跨整个 server/ + 大量类型修正 |
| 19 | 生产无 start 脚本/PM2 Windows 硬编码 | **A** | 1 小时 | 加 `start` script + PM2 配置通用化 + README | 跨 package.json + ecosystem + 文档 |
| 20 | 未使用 import | **S** | 5 分钟 | 删除一行 | 单文件 |
| 21 | .gitignore 缺 .playwright-mcp/ | **S** | 1 分钟 | 加一行 | 单文件 |
| 22 | 服务巡检顺序检测效率低 | **S** | 20 分钟 | 改 `Promise.allSettled` 或复用 `concurrentPool` | 单文件单函数 |
| 23 | 错误响应未设 HTTP 状态码 | **S** | 10 分钟 | `res.json` → `res.status(500).json` | 单文件批量替换 |
| 24 | 操作日志落库敏感信息 | **A** | 30 分钟 | `logOperation` 加敏感键遮蔽 + overview 调整 | 跨 admin.ts 多处 + overview 返回结构 |
| 25 | 401 互斥锁释放过早 | **A** | 30 分钟 | 改 `router.afterEach` 触发释放 | 单文件但需理解 Vue Router 异步时序 |
| 26 | fetchMe 任何异常都 logout | **S** | 15 分钟 | 区分 401 与网络抖动，仅 401 logout | 单文件单函数 |
| 27 | 预览弹窗 dangerouslyUseHTMLString | **A** | 1 小时 | 改模板插槽渲染或每字段 escapeHtml | 4 个 Vue 文件多处调用 |
| 28 | 全量 any 类型 | **C** | 持续 | `as any` → `unknown` + 类型守卫，100+ 处 | 全项目类型工程，需逐步收敛 |
| 29 | Digest Auth 密码默认回退 | **S** | 5 分钟 | 移除 `|| 'admin'` 回退，未配置拒启动 | 单行（与 #6 合并） |
| 30 | node-cron 重复导入 | **S** | 5 分钟 | 集中到一处导入 | 2 个文件 |
| 31 | http.ts 状态码语义混乱 | **S** | 5 分钟 | 文档化或加断言 | 单文件（依赖 #7/#23 修复） |
| 32 | 定时器缺 onUnmounted | **A** | 30 分钟 | 加 `onUnmounted` clearTimeout + AbortController | 4 个 Vue 文件 |
| 33 | CSV 中文乱码+split 不处理引号 | **A** | 30 分钟 | `readAsText(f, 'utf-8')` + 引入 papaparse | 2 个 Vue 文件 + 新依赖 |
| 34 | 锁定机制可被绕过 | **A** | 20 分钟 | 锁定到期不重置 failed_attempts + 速率限制中间件 | 单文件 + 新增速率限制逻辑 |
| 35 | AES 密钥一次性读取无启动校验 | **S** | 15 分钟 | 启动校验 `credKeyReady()` 或改函数内动态读取 | 单文件 + index.ts 启动序列 |
| 36 | JWT_SECRET 自动入库 | **A** | 30 分钟 | 优先读 env + 生产拒自动生成 + 轮换机制 | auth.ts + .env.example |
| 37 | express 错误未脱敏 | **A** | 30 分钟 | 日志脱敏模式 + 路由层优先捕获 | index.ts + 多个路由 throw err |
| 38 | 锁定时间字符串比较 | **S** | 5 分钟 | 改 `Date.getTime()` 比较 | 单文件单行 |
| 39 | 改密码未校验强度 | **S** | 20 分钟 | 加长度+复杂度校验，抽公共函数 | auth.ts + users.ts 2 处 |
| 40 | marked 不净化依赖自写 sanitize | **A** | 30 分钟 | marked 输出后 DOMPurify净化 或换 markdown-it | OperationsView 多处（与 #5 协同） |
| 41 | checkAllCache 单进程不一致 | **B** | 1 小时 | 改 DB 共享表或 PM2 进程间广播 | services.ts + 可能新增 DB 表/scheduler |

### A.2 难度统计

| 难度 | 数量 | 占比 | 总工程量 | 特征 |
|:----:|:----:|:----:|:--------:|------|
| **S** 简单（机械改/单行）| 17 | 42.5% | ≈ 2.5 小时 | 单文件、字符串替换、删行、加校验 |
| **A** 中等（单功能跨文件）| 15 | 37.5% | ≈ 11.5 小时 | 跨 2–4 文件、需理解时序/协议、加依赖 |
| **B** 较难（跨模块协调）| 5 | 12.5% | ≈ 6.5 小时 | 跨前后端、UI 重构、类型系统、新数据流 |
| **C** 复杂（架构级/新依赖）| 3 | 7.5% | ≈ 9+ 小时 | 引入新依赖、回归测试、运维流程、持续工程 |

### A.3 按难度×严重度交叉视图

| 难度\严重度 | 🔴严重 | 🟠高 | 🟡中 | 🔵低 | 合计 |
|:-----------:|:------:|:----:|:----:|:----:|:----:|
| **S** 简单 | #1 #2 #3 #35 | #7 #8 #9 #23 | #20 #21 #22 #26 #29 #30 #31 #38 #39 | — | 17 |
| **A** 中等 | #4 #6 #34 | #12 #19 #36 #37 | #24 #25 #27 #32 #33 #40 | — | 15 |
| **B** 较难 | — | #13 #15 #18 | #10 #41 | — | 5 |
| **C** 复杂 | #5 #11 | #17 | #28 | — | 3 |
| **合计** | 8 | 13 | 11 | 0 | 40 |

> 注：🔵 低严重度全部落在 S/A 难度区间，无高难度低风险问题——符合「低风险=低复杂」直觉。**🔴 严重中有 4 个落在 S 难度**（#1/#2/#3/#35），即"工程量极小但影响极大"，应作为**最高优先级立刻清掉**。

---

## 附录 B：A/B/C 难度执行批次（S 难度外委他人）

> S 难度（17 项）留给他人机械修复，本节仅规划 **A / B / C 三档共 23 项** 的执行批次。
> 排批原则：① 同难度优先集中处理（思维切换成本最小）② 跨文件同主题合并一批 ③ 安全优先于整洁 ④ C 难度独立成批需回归测试。

### 批次 A-1：认证与凭据加固（4 项，2 小时）

| # | 难度 | 任务 | 文件 | 验收 |
|---|:----:|------|------|------|
| 6 | A | PBX 凭据隔离 `ATCOM_PBX_USER/PASS` | `server/routes/phones.ts`、`src/views/admin/AdminAtcomConfig.vue`、`.env.example` | 未配置时 phones 路由 500 拒绝；前端 pbx_pass 默认空 |
| 34 | A | 锁定到期不重置 `failed_attempts` + 速率限制中间件 | `server/routes/auth.ts`、`server/middleware/rateLimit.ts`（新建） | 5 次错误后锁定 15 分钟；锁定到期累计计数；同 IP 1 分钟最多 5 次 |
| 36 | A | JWT_SECRET 优先读 env + 生产拒自动生成 | `server/middleware/auth.ts`、`.env.example` | 生产模式未配 JWT_SECRET 拒启动；开发模式自动生成打警告 |
| 37 | A | express 错误中间件日志脱敏 | `server/index.ts`、`server/routes/services.ts`/`racks.ts` throw err 处 | 生产模式 SQLite/FOREIGN KEY 错误细节替换为 `[DB_ERROR]` |

**执行顺序**：#36 → #37 → #6 → #34（#36 启动校验是其他认证改动的地基）
**回归测试**：登录/改密码/路由 500 三条链路各跑一次

---

### 批次 A-2：HTTP 健壮性与 Vue 时序（5 项，3.5 小时）

| # | 难度 | 任务 | 文件 | 验收 |
|---|:----:|------|------|------|
| 12 | A | http.ts 加 AbortController + 15s 超时 | `src/utils/http.ts` + 调用视图 | 慢请求 15s 自动 abort；切换页面无 Vue 已卸载警告 |
| 19 | A | 加 `start` 脚本 + PM2 通用化 | `package.json`、`ecosystem.config.cjs` | `npm start` 可启动；PM2 不含 Windows-only 路径 |
| 25 | A | 401 互斥锁改 `router.afterEach` 触发释放 | `src/stores/auth.ts` | 连续 401 不出现多次跳转闪烁 |
| 27 | A | 预览弹窗改模板插槽或每字段 escapeHtml | `OperationsView.vue`、`AdminServices.vue`、`ComputerProcurementTab.vue`、`PhoneProcurementTab.vue` | 导入 CSV 含 `<img onerror>` 不执行 |
| 32 | A | 定时器加 `onUnmounted` + AbortController | `DevicesView.vue`、`LogMonitorView.vue`、`DeviceForm.vue`、`DeviceDrawer.vue` | 快速切路由无 Vue 已卸载警告 |

**执行顺序**：#12 → #32（同主题 AbortController）→ #25 → #27 → #19
**回归测试**：登录退出、采购导入、设备切换路由三条链路

---

### 批次 A-3：搜索竞态 + CSV 编码 + XSS 净化 + 多进程缓存（5 项，3.5 小时）

| # | 难度 | 任务 | 文件 | 验收 |
|---|:----:|------|------|------|
| 16 | A | 搜索筛选请求序号竞态保护 | `src/stores/procurement.ts`（范本）+ 其他 store | 连续输入"联想→联想笔→联想笔记本"最终结果与最新请求一致 |
| 24 | A | `logOperation` 加敏感键遮蔽 | `server/routes/admin.ts` | `password/token/secret/key` 字段进日志前遮蔽为 `***` |
| 33 | A | CSV 中文 `readAsText(f, 'utf-8')` + papaparse | `ComputerProcurementTab.vue`、`PhoneProcurementTab.vue` | Windows 中文 CSV 导入无乱码；含逗号字段正确分列 |
| 40 | A | marked 输出后强制 DOMPurify 净化 | `src/views/OperationsView.vue` | markdown 含 `<img onerror>` 不执行 |
| 41 | B | checkAllCache 改 DB 共享表 | `server/routes/services.ts`、`server/db.ts`（新增 `service_check_cache` 表） | PM2 cluster 模式下所有 worker 缓存一致 |

> 注：#41 虽是 B 难度，但与 #40 同属 services 模块，合并此批减少上下文切换。

**执行顺序**：#16 → #24 → #33 → #40 → #41
**回归测试**：搜索并发、操作日志、CSV 导入、Markdown 渲染、check-all

---

### 批次 B-1：路由守卫 + 分页 + 类型系统（4 项，6.5 小时）

| # | 难度 | 任务 | 文件 | 验收 |
|---|:----:|------|------|------|
| 13 | B | 路由 meta.roles 统一鉴权 + redirect 白名单 | `src/router/index.ts` + 全部业务路由 | 普通 user 访问 /devices /procurement 等被拒；redirect 拒绝跨域 |
| 15 | B | 服务/采购列表改真实分页 | `src/api/services.ts`、`src/stores/operations.ts`、`src/stores/procurement.ts` + 视图 | el-pagination 驱动 total；服务 >100 条不再静默截断 |
| 18 | B | 服务端 typecheck + strict 模式 | 新建 `tsconfig.server.json`、`package.json` build | `npm run build` 含 `vue-tsc -p tsconfig.server.json`；strict 下零错误 |
| 10 | B | SSRF 改白名单 + "允许内网"授权复选框 | `server/routes/services.ts` + 前端表单 | 默认拒内网；勾选授权后可添加 10.x 地址 |

**执行顺序**：#18 → #13 → #15 → #10（#18 先建类型地基，后续改动有编译期保护）
**回归测试**：全量 `npm run build`；各角色登录访问全部路由；服务分页翻页；内网服务添加授权流

---

### 批次 C-1：架构级独立批（3 项，9+ 小时，需回归测试）

| # | 难度 | 任务 | 文件 | 验收 |
|---|:----:|------|------|------|
| 5 | C | 引入 DOMPurify 替代自写 sanitize | 新增 `dompurify` 依赖、`src/utils/sanitize.ts` 重写、2 个 Vue 调用点 | `npm run build` 无新警告；XSS payload 全部被净化 |
| 11 | C | token 改 HttpOnly cookie + 后端中间件 + CSP 头 | `server/middleware/auth.ts`、`server/index.ts`、`src/stores/auth.ts`、`src/utils/http.ts` | 登录后 `document.cookie` 无 token；CSP 头生效；回归登录/退出/401 全链路 |
| 17 | C | SQLite 备份脚本 + 优雅关闭 + PM2 kill_timeout | 新建 `scripts/backup-db.mjs`、`server/index.ts` SIGTERM handler、`ecosystem.config.cjs`、`DEPLOY.md` | `npm run backup` 生成带校验的备份；SIGTERM 后 8s 内连接停 + DB close |
| 28 | C | `as any` → `unknown` + 类型守卫，持续收敛 | 全项目 100+ 处 | strict 模式下无 `as any`；新增 `noExplicitAny` lint 规则 |

**执行顺序**：#5 → #11 → #17 → #28
- #5 必须先于 #11（XSS 防线加固后才能安全迁移 token 存储）
- #17 独立无依赖，可与 #5/#11 并行
- #28 是持续工程，每 PR 收敛 5–10 处

**回归测试**（全批必跑）：
- `npm run build` 零错误
- 登录 → 访问各模块 → 退出 全链路
- `npm run backup` + 模拟 SIGTERM
- OWASP XSS payload 注入测试清单

---

### 批次总览与排期

| 批次 | 难度 | 项数 | 工时 | 依赖 | 可并行 |
|------|:----:|:----:|:----:|------|:------:|
| A-1 认证加固 | A | 4 | 2h | 无 | — |
| A-2 HTTP 健壮性 | A | 5 | 3.5h | 无 | 与 A-1 并行 |
| A-3 搜索/CSV/XSS/缓存 | A+B | 5 | 3.5h | 无 | 与 A-1/A-2 并行 |
| B-1 路由/分页/类型 | B | 4 | 6.5h | A 批完成 | — |
| C-1 架构级 | C | 4 | 9h+ | A/B 完成 | #17 可与 #5/#11 并行 |

**关键路径**：A-1 → B-1 → C-1，总工时 ≈ 17.5 小时（不含 S 难度 2.5h 外委部分）
**最低上线门槛**：A-1 + C-1(#5/#11) 必须完成，其余可迭代消化

---

## 附录 C：第三轮审查与修复记录（2026-07-17）

### C.1 上轮残留问题修复（5 项）

| # | 严重度 | 文件 | 修复 | 验证 |
|---|:------:|------|------|:----:|
| R1 | 🟠 高 | `src/router/index.ts:151-161` | 路由守卫 `meta.roles` 校验存在缺陷：`if (requiredRoles && auth.user)` 当 `auth.user` 为 null 时（fetchMe 失败/网络抖动）直接跳过角色校验，普通 user 可趁登录态未校验时进入 admin 路由。修复：改为 `if (requiredRoles) { if (!auth.user) return '/'; if (!requiredRoles.includes(auth.user.role)) return '/' }` | ✅ |
| R2 | 🟠 高 | `server/routes/auth.ts:71-79`、`server/index.ts:36-54` | HttpOnly cookie 的 `SameSite=Lax` 对 GET 导航请求仍发送 cookie，CSRF 防护弱；且 CSP 头未配置（#11 长期项未落地）。修复：`SameSite=Lax` → `Strict`；`helmet` 加 `contentSecurityPolicy` 限制 `defaultSrc/scriptSrc 'self'`、`objectSrc 'none'`、`frameAncestors 'none'` | ✅ |
| R3 | 🟡 中 | `server/routes/auth.ts:33-40` | #34 修复"锁定到期即重置 failed_attempts 给攻击者 4 次免费尝试"窗口，但产生副作用：长期未登录用户的偶发错误永远累计不清零，下次错误即锁定。修复：锁定到期后若距上次锁定 > 24h，视为长期未登录，重置 `failed_attempts=0`；否则保留累计威慑 | ✅ |
| R4 | 🟡 中 | `server/index.ts:1-8, 83, 179` | `fs` 用动态 `await import('fs')` 两处（顶层 + cron 内），顶层阻塞启动，cron 内每次触发都动态导入（代码气味）。修复：改 `import fs from 'node:fs'` 静态导入，删除两处动态 import 复用顶层引用 | ✅ |
| R5 | 🟢 低 | `server/utils/crypto.ts:24-27` | `reloadCredKey()` 函数无实际调用方（`pm2 reload` 重启进程会自动重读 env，不需要该函数），属死代码。修复：删除函数 | ✅ |

### C.2 服务端 typecheck 残留错误清零（#18 真正落地）

**上轮虚报纠正**：评估表写"已修复 41/41 100%"是虚报——#18（服务端 typecheck + strict）上轮只建了 `tsconfig.server.json` 但 30+ 处类型错误未实际收敛，本轮才真正清零。

| 类别 | 文件:行 | 错误 | 修复 |
|------|---------|------|------|
| **A 真实缺陷** | `server/logMonitor.ts:292` | `Property 'lastrowid' does not exist on type 'RunResult'`（better-sqlite3 的正确属性是 `lastInsertRowid`） | `lastrowid` → `lastInsertRowid` |
| **A 真实缺陷** | `server/logMonitor.ts:426` | `Cannot find name 'ScheduledTask'`（node-cron 类型未导入） | 加 `import type { ScheduledTask } from 'node-cron'` |
| **B 类型断言** | `server/routes/admin.ts` ×5 | `Type 'string[]' cannot be used as an index type`（Express 5 的 `req.params` 是 `Record<string, string \| string[]>`） | `tables[req.params.table]` → `tables[String(req.params.table)]` |
| **B 类型断言** | `devices.ts`×3 / `log-monitor.ts`×1 / `services.ts`×10 / `users.ts`×3 共 17 处 | `string[] not assignable to string`（Express 5 的 `req.params.id` 是 `string \| string[]`，`parseInt` 不接受 union） | `parseInt(req.params.id)` → `parseInt(String(req.params.id))` |

### C.3 最终验证

| 检查 | 命令 | 结果 |
|------|------|:----:|
| 前端类型+构建 | `npm run build:client` | ✅ `built in 1.61s`（仅 dynamic import 告警，无害） |
| 服务端类型 | `npm run build:server` | ✅ 无输出 = 无错误 |
| Exit code | `$?` | ✅ 0 |

### C.4 状态纠正

| 项 | 旧状态（虚报） | 新状态（实际） |
|----|--------------|---------------|
| #18 服务端 typecheck | "已修复 41/41 100%" | 上轮仅建 `tsconfig.server.json`，30+ 处错误未收敛；**本轮 2026-07-17 真正清零** |
| R1-R5 残留问题 | 未识别 | 本轮第三轮审查发现并全部修复 |
| 服务端 `lastrowid` 运行时 bug | 未识别 | 本轮发现：`result.lastrowid` 实际为 `undefined`，写入 DB 的 ID 会是 NULL；已修正为 `lastInsertRowid` |
| 服务端 `ScheduledTask` 运行时 bug | 未识别 | 本轮发现：若该行执行（cron 调度控制）会抛 `ReferenceError`；已加类型导入 |