# 内网服务管理页面 — 评审与实现细则（v2）

> 评审时间：2026-07-11
> 评审范围：`src/views/ServicesView.vue`（前台）、`src/views/admin/AdminServices.vue`（后台）、`src/api/services.ts`、`src/stores/services.ts`、`server/routes/services.ts`、`server/db.ts`（services / service_hosts / service_categories 表）、`server/logMonitor.ts`、`ecosystem.config.cjs`
> 评审人：AtomCode
> 文档定位：v1（`services-review-2026-07-11.md`）的细化版，给出每条建议的「现状 → 根因 → 修复实现逻辑 + 关键代码片段 → 验证点」。

---

## 目录

- [一、现状速览](#一现状速览)
- [二、P0 必须修复（3 项）](#二p0-必须修复3-项)
  - [2.1 批量检测后前台卡片状态不刷新](#21-批量检测后前台卡片状态不刷新)
  - [2.2 前台漏显示服务（分页默认 20）](#22-前台漏显示服务分页默认-20)
  - [2.3 openService URL 协议未校验 → XSS / 钓鱼](#23-openservice-url-协议未校验--xss--钓鱼)
- [三、P1 健壮性 + UX（6 项）](#三p1-健壮性--ux6-项)
  - [3.1 检测缓存与单点检测不互斥](#31-检测缓存与单点检测不互斥)
  - [3.2 PATCH 缺 category 校验](#32-patch-缺-category-校验)
  - [3.3 PATCH 缺 name/url 字段校验](#33-patch-缺-nameurl-字段校验)
  - [3.4 HEAD 检测对不支持 HEAD 的服务误判离线](#34-head-检测对不支持-head-的服务误判离线)
  - [3.5 后台无分页 + 无连通性检测入口](#35-后台无分页--无连通性检测入口)
  - [3.6 SSRF 风险：fetch 指向内网任意地址](#36-ssrf-风险fetch-指向内网任意地址)
- [四、新增功能实现逻辑（6 项核心）](#四新增功能实现逻辑6-项核心)
  - [4.1 服务健康历史与趋势](#41-服务健康历史与趋势)
  - [4.2 告警通知（复用 logMonitor）](#42-告警通知复用-logmonitor)
  - [4.3 定时巡检（复用 logMonitor scheduler）](#43-定时巡检复用-logmonitor-scheduler)
  - [4.4 凭证保险柜](#44-凭证保险柜)
  - [4.5 收藏与个人常用面板](#45-收藏与个人常用面板)
  - [4.6 导入/导出](#46-导入导出)
- [五、验证清单](#五验证清单)

---

## 一、现状速览

### 1.1 文件与职责

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| 前台视图 | `src/views/ServicesView.vue` | 卡片网格 + 搜索筛选 + 主机筛选 + 详情抽屉（只读）|
| 后台视图 | `src/views/admin/AdminServices.vue` | 表格 + 增删改弹窗 |
| API 层 | `src/api/services.ts` | 8 个接口封装，`request` 带 Bearer token |
| Store | `src/stores/services.ts` | localStorage 缓存（5min TTL）+ 检测结果归档 |
| 后端路由 | `server/routes/services.ts` | CRUD + 批量/单点检测，60s 内存缓存 |
| DB | `server/db.ts` | `services` 表（唯一 name/url）+ `service_hosts` + `service_categories` |
| 复用 | `server/logMonitor.ts` | 已有 cron 调度器 + LLM 分析 + `saveAudit` 落库模式 |
| 复用 | `ecosystem.config.cjs` | pm2 单实例 fork，可挂多 app |

### 1.2 检测链路现状（关键）

```
前台点「检测连通性」
  → store.checkAllServices()
  → api.checkAllServices() POST /api/v1/services/check-all
  → 后端 checkAllCache 命中？→ 返回 cached
  → 否则 SELECT * WHERE status != 'maintenance'
  → concurrentPool(services, 10, checkOne)
       checkOne: fetch(url, HEAD, 5s AbortController)
         ok → status='online', latencyMs
         err → status='offline', latencyMs=null
  → UPDATE services SET status 写库
  → 返回 { results, summary }
  → store 把 results 写进 checkResults[id]   ← 但 services[i].status 没动！
  → 前台卡片绑 svc.status → 颜色不变
```

---

## 二、P0 必须修复（3 项）

### 2.1 批量检测后前台卡片状态不刷新

**根因**：`store.checkAllServices` 只写 `checkResults`，未回写 `services[i].status`；而后端 `UPDATE services` 写的是 DB，前台 `services` 数组是内存快照，不联动。

**现状代码**（`src/stores/services.ts` L84-97）：

```ts
async function checkAllServices() {
  checking.value = true
  try {
    const data = await api.checkAllServices()
    for (const r of data.results) {
      checkResults.value[r.id] = { status: r.status, latencyMs: r.latencyMs }
      // ← 缺：services[i].status = r.status
    }
  } catch (e: any) { ... }
}
```

**修复逻辑**：

```ts
async function checkAllServices() {
  checking.value = true
  try {
    const data = await api.checkAllServices()
    // 1) 回写 services[i].status，触发卡片响应式更新
    const map = new Map(data.results.map(r => [r.id, r]))
    for (const s of services.value) {
      const r = map.get(s.id)
      if (r) {
        s.status = r.status as Service['status']
        checkResults.value[r.id] = { status: r.status, latencyMs: r.latencyMs }
      }
    }
    // 2) 缓存也要同步，否则下次 loadServices 命中旧缓存把状态冲回去
    writeSvcCache(services.value)
  } catch (e: any) {
    console.warn('连通性检测失败:', e.message)
    ElMessage.warning(e.message || '连通性检测失败')
  } finally {
    checking.value = false
  }
}
```

`checkService`（单点）同样要回写：

```ts
async function checkService(id: number) {
  const result = await api.checkService(id)
  const idx = services.value.findIndex(s => s.id === id)
  if (idx !== -1) {
    services.value[idx].status = result.status as Service['status']
    writeSvcCache(services.value) // 同步缓存
  }
  checkResults.value[id] = { status: result.status, latencyMs: result.latencyMs }
  return result
}
```

**验证点**：
1. 前台点「检测连通性」，离线服务卡片应在检测完成后变红（而非刷新页面才变）。
2. 检测后 5 分钟内刷新页面，状态应保持（缓存已同步）。

---

### 2.2 前台漏显示服务（分页默认 20）

**根因**：`api.fetchServices` 默认 `pageSize=20`（后端 `server/routes/services.ts` L32），store `loadServices` 调用时未传分页参数 → 服务超 20 个时前台只显示前 20 条，主机筛选卡片计数 `services.length` 也只反映 20 条。

**现状**（`src/api/services.ts` L15-30 + `src/stores/services.ts` L45）：

```ts
// api: 默认不传 pageSize → 后端取 20
export async function fetchServices(params?: { page?: number; pageSize?: number; ... })
// store: 直接 await api.fetchServices()
const { list } = await api.fetchServices()
```

**修复逻辑**（两段改）：

```ts
// 1) src/api/services.ts — 新增「全量」便捷函数，走上限 100
export async function fetchAllServices(): Promise<Service[]> {
  const data = await request<PaginatedList>(`${BASE}?pageSize=100`)
  return data.list
}

// 2) src/stores/services.ts — loadServices 用 fetchAllServices
async function loadServices() {
  const cached = readSvcCache()
  if (cached) {
    services.value = cached.list
    if (Date.now() - cached.ts < SVC_TTL) return
  }
  loading.value = true
  try {
    const list = await api.fetchAllServices()
    services.value = list
    writeSvcCache(list)
  } catch (e: any) { ... }
}
```

**注意**：后端上限 100，服务超 100 时仍会截断。需在前台顶部加提示：

```vue
<span v-if="servicesStore.total >= 100" class="warn-tip">
  服务数已达上限 100，如需查看更多请联系管理员
</span>
```

**验证点**：
1. mock 25 个服务时前台应全部显示，主机筛选卡片计数应为 25。
2. 计数 `{{ servicesStore.services.length }}` 与后端 `SELECT COUNT(*) FROM services` 一致。

---

### 2.3 openService URL 协议未校验 → XSS / 钓鱼

**根因**：`ServicesView.vue` 的 `openService` 直接 `window.open(url, '_blank')`，url 来自 DB。管理员若录入 `javascript:alert(document.cookie)` 或外部钓鱼链接，用户点「访问服务」即触发。

**现状**（`src/views/ServicesView.vue` L234-236）：

```ts
function openService(url: string) {
  window.open(url, '_blank')
}
```

**修复逻辑**：前端校验 + 后端入库校验（双保险）。

```ts
// src/views/ServicesView.vue
function openService(url: string) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      ElMessage.warning('仅支持 http/https 协议的服务地址')
      return
    }
  } catch {
    ElMessage.warning('服务地址格式不合法')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
```

抽屉按钮禁用兜底：

```vue
<el-button
  type="primary"
  :disabled="!isSafeUrl(selectedService!.url)"
  @click="openService(selectedService!.url)"
>
  <el-icon><Position /></el-icon> 访问服务
</el-button>
```

```ts
function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}
```

后端入库同样校验（`server/routes/services.ts` POST/PUT/PATCH）：

```ts
function validateUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

// POST 里，校验 url 后追加：
if (!validateUrl(url)) {
  return res.status(400).json({ code: 400, message: 'url 必须是 http/https 协议' })
}
```

**验证点**：
1. DB 写入 `javascript:alert(1)` 的服务，前端「访问」按钮应禁用。
2. 后端 POST `url: "ftp://x"` 应返回 400。

---

## 三、P1 �健壮性 + UX（6 项）

### 3.1 检测缓存与单点检测不互斥

**根因**：`checkAllCache`（60s）在单点检测改库后仍保留旧 summary，下次批量调用返回过期数据。

**现状**（`server/routes/services.ts` L234 + L286-307）：单点 `/:id/check` 改了 DB status 但未清 `checkAllCache`。

**修复逻辑**：单点检测后失效缓存。

```ts
// server/routes/services.ts 顶部导出失效函数
export function invalidateCheckAllCache() {
  checkAllCache = null
}

// router.post('/:id/check', ...) 成功/失败 UPDATE 后都加：
invalidateCheckAllCache()
```

若不想 export，直接在 `/:id/check` 路由体内 `checkAllCache = null`（同文件作用域内）。

**验证点**：单点检测某服务变 offline 后，立即批量检测应返回最新 summary（offline+1），而非命中缓存返回旧值。

---

### 3.2 PATCH 缺 category 校验

**根因**：POST/PUT 都校验 `getCategories().includes(category)`，PATCH 遍历 `allowedFields` 直接写入，可绕过字典插入非法分类。

**现状**（`server/routes/services.ts` L162-184）：只校验了 `status`。

**修复逻辑**：

```ts
// PATCH 路由内，遍历 allowedFields 之前补：
if (req.body.category !== undefined && !getCategories().includes(req.body.category)) {
  return res.status(400).json({ code: 400, message: 'category 必须是已配置的服务分类之一' })
}
```

**验证点**：`PATCH /api/v1/services/1 { category: "非法分类" }` 应返回 400。

---

### 3.3 PATCH 缺 name/url 字段校验

**根因**：PATCH 可写超长 name 或非法 url，与 POST/PUT 校验不一致。

**修复逻辑**：

```ts
// PATCH 路由内补：
if (req.body.name !== undefined) {
  if (typeof req.body.name !== 'string' || req.body.name.length < 1 || req.body.name.length > 100) {
    return res.status(400).json({ code: 400, message: 'name 需 1-100 字符' })
  }
}
if (req.body.url !== undefined) {
  if (typeof req.body.url !== 'string' || req.body.url.length > 500 || !validateUrl(req.body.url)) {
    return res.status(400).json({ code: 400, message: 'url 需 http/https 协议，最多 500 字符' })
  }
}
```

**验证点**：`PATCH { name: "x".repeat(200) }` 应返回 400。

---

### 3.4 HEAD 检测对不支持 HEAD 的服务误判离线

**根因**：部分服务（如某些静态资源、自定义服务）不支持 HEAD，返回 405/404 → `fetch` 抛错 → 误判 offline。但 4xx 实际代表「服务在运行，只是不支持该方法」。

**现状**（`server/routes/services.ts` L246-257）：

```ts
await fetch(svc.url, { method: 'HEAD', signal: controller.signal })
return { ... status: 'online' ... }
catch { status: 'offline' }
```

**修复逻辑**：HEAD 失败回退 GET，且把 4xx 视为在线（服务在响应）。

```ts
const checkOne = async (svc: any): Promise<any> => {
  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(svc.url, { method: 'HEAD', signal: controller.signal })
    clearTimeout(timeout)
    // HEAD 成功（2xx/3xx/4xx 都算服务在线，5xx 算离线）
    const online = res.status < 500
    return { id: svc.id, name: svc.name, status: online ? 'online' : 'offline', latencyMs: Date.now() - start, httpStatus: res.status }
  } catch (headErr) {
    // HEAD 不支持（405）或网络层失败 → 回退 GET
    try {
      const controller2 = new AbortController()
      const timeout2 = setTimeout(() => controller2.abort(), 5000)
      const res = await fetch(svc.url, { method: 'GET', signal: controller2.signal })
      clearTimeout(timeout2)
      const online = res.status < 500
      return { id: svc.id, name: svc.name, status: online ? 'online' : 'offline', latencyMs: Date.now() - start, httpStatus: res.status }
    } catch {
      return { id: svc.id, name: svc.name, status: 'offline', latencyMs: null, error: '连接超时' }
    }
  }
}
```

**注意**：GET 会下载 body，对大文件服务流量浪费。可加 `Range: bytes=0-0` 只取首字节：

```ts
headers: { Range: 'bytes=0-0' }
```

**验证点**：mock 一个只支持 GET 的服务（如返回 405 给 HEAD），检测后应显示 online。

---

### 3.5 后台无分页 + 无连通性检测入口

**根因**：`AdminServices.vue` 表格直接绑 `services.value`（前台 store 拿到的 20 条），且「操作」列只有编辑/删除，无检测按钮。

**修复逻辑**：

```vue
<!-- AdminServices.vue 表格操作列 -->
<el-table-column label="操作" width="220" fixed="right">
  <template #default="{ row }">
    <el-button type="primary" text size="small" @click="handleEdit(row)">编辑</el-button>
    <el-button type="success" text size="small" :loading="checkingId === row.id" @click="handleCheck(row)">检测</el-button>
    <el-button type="danger" text size="small" @click="handleDelete(row)">删除</el-button>
  </template>
</el-table-column>
```

```ts
const checkingId = ref<number | null>(null)

async function handleCheck(row: any) {
  checkingId.value = row.id
  try {
    const r = await servicesStore.checkService(row.id)
    ElMessage.success(`${row.name} 当前 ${r.status === 'online' ? '在线' : '离线'}（${r.latencyMs ?? '--'}ms）`)
    await loadData() // 刷新表格状态列
  } catch (e: any) {
    ElMessage.error(e.message || '检测失败')
  } finally {
    checkingId.value = null
  }
}
```

顶部加「批量检测」按钮（复用 store.checkAllServices）：

```vue
<el-button type="warning" size="small" :loading="servicesStore.checking" @click="servicesStore.checkAllServices().then(loadData)">
  <el-icon><Refresh /></el-icon> 批量检测
</el-button>
```

**分页**：同 §2.2，`loadData` 改用 `fetchAllServices`。

**验证点**：后台点「检测」按钮后，状态列实时更新；「批量检测」后所有行状态刷新。

---

### 3.6 SSRF 风险：fetch 指向内网任意地址

**根因**：管理员可录入任意 URL，后端 `fetch(svc.url)` 会从服务器发起请求 → 可探测内网其他机器、云元数据 `169.254.169.254`、本机管理端口。

**修复逻辑**：URL 入库时校验不在黑名单网段。

```ts
// server/routes/services.ts 新增
import { isIP } from 'node:net'

const SSRF_BLACKLIST: Array<{ cidr: string; mask: number }> = [
  { cidr: '169.254.0.0', mask: 16 },   // 链路本地（含云 metadata）
  { cidr: '127.0.0.0', mask: 8 },       // 本机回环
  { cidr: '0.0.0.0', mask: 8 },         // 未指定
]

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0
}

function isBlacklisted(host: string): boolean {
  // 域名不黑名单（只拦 IP 字面值），域名由 DNS 解析后再判需在 fetch 层做（较复杂，先拦字面 IP）
  if (!isIP(host)) return false
  if (isIP(host) === 6) return false // IPv6 先放行，内网一般 IPv4
  for (const { cidr, mask } of SSRF_BLACKLIST) {
    const network = ipToInt(cidr) >>> (32 - mask)
    const hostNet = ipToInt(host) >>> (32 - mask)
    if (network === hostNet) return true
  }
  return false
}

function validateSsrfSafe(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (isBlacklisted(u.hostname)) return false
    return true
  } catch { return false }
}
```

入库校验：

```ts
// POST/PUT/PATCH 校验 url 时追加：
if (!validateSsrfSafe(url)) {
  return res.status(400).json({ code: 400, message: 'url 不允许指向元数据/回环地址' })
}
```

**检测层兜底**（防止已入库的脏数据）：`checkOne` 内同样判一次 `validateSsrfSafe(svc.url)`，false 则直接返回 offline + `error: 'SSRF 黑名单'`，不发起 fetch。

**验证点**：录入 `http://169.254.169.254/latest/meta-data` 应返回 400。

---

## 四、新增功能实现逻辑（6 项核心）

### 4.1 服务健康历史与趋势

**目标**：每次检测落一条历史，前台抽屉显示最近 24 小时状态时间线。

**DB 迁移**（`server/db.ts` 现有迁移区追加）：

```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS service_health_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status     TEXT NOT NULL,                -- online / offline / maintenance
    latency_ms INTEGER,                     -- NULL 表示超时/失败
    http_status INTEGER,                    -- HTTP 响应码（可空）
    error      TEXT NOT NULL DEFAULT '',
    checked_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_shl_service_time ON service_health_logs (service_id, checked_at DESC);
`)
```

**检测路由落库**（`server/routes/services.ts`）：在批量与单点 UPDATE 后插入日志。

```ts
// check-all 里，UPDATE 循环中追加：
const insertLog = db.prepare(
  'INSERT INTO service_health_logs (service_id, status, latency_ms, http_status, error) VALUES (?, ?, ?, ?, ?)'
)
for (const r of results) {
  allResults.push(r)
  updateStmt.run(r.status, r.id)
  insertLog.run(r.id, r.status, r.latencyMs, r.httpStatus || null, r.error || '')
}
// 维护态也落一条（标识跳过）
for (const s of skipped) {
  insertLog.run(s.id, 'maintenance', null, null, 'skipped')
}
```

**新路由**：拉取某服务历史。

```ts
// GET /api/v1/services/:id/history?hours=24
router.get('/:id/history', (req, res) => {
  const id = parseInt(req.params.id)
  const hours = Math.min(168, Math.max(1, parseInt(req.query.hours as string) || 24))
  const rows = db.prepare(
    `SELECT status, latency_ms, http_status, error, checked_at
     FROM service_health_logs
     WHERE service_id = ? AND checked_at >= datetime('now', ?)
     ORDER BY checked_at ASC`
  ).all(id, `-${hours} hours`)
  res.json({ code: 200, data: { points: rows } })
})
```

**前台抽屉**（`ServicesView.vue`）：抽屉内加时序图区块。

```vue
<div class="drawer-section">
  <div class="drawer-label">最近 24 小时</div>
  <ServiceHealthChart :service-id="selectedService!.id" :points="healthPoints" />
</div>
```

```ts
const healthPoints = ref<any[]>([])
watch(() => selectedService.value?.id, async (id) => {
  if (!id) return
  try {
    const { points } = await request<any>(`${BASE}/${id}/history?hours=24`)
    healthPoints.value = points
  } catch { healthPoints.value = [] }
})
``

`ServiceHealthChart.vue`（新组件）：用 SVG 画阶梯图，绿/红/橙对应 online/offline/maintenance，点悬浮显示延迟与时间。无 ECharts 依赖，纯 SVG ~80 行可实现。

**可用率计算**（后台服务详情）：

```ts
// GET /api/v1/services/:id/uptime?days=7
router.get('/:id/uptime', (req, res) => {
  const id = parseInt(req.params.id)
  const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7))
  const row = db.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status='online' THEN 1 ELSE 0 END) AS online
     FROM service_health_logs
     WHERE service_id = ? AND checked_at >= datetime('now', ?)`
  ).get(id, `-${days} days`) as { total: number; online: number }
  const uptime = row.total > 0 ? (row.online / row.total * 100).toFixed(2) : '--'
  res.json({ code: 200, data: { uptime, total: row.total, online: row.online } })
})
```

**定时清理**（避免表无限增长）：在 `server/index.ts` 启动后挂一个每日 cron，删除 30 天前数据。

```ts
import cron from 'node-cron'
cron.schedule('0 3 * * *', () => {
  db.prepare("DELETE FROM service_health_logs WHERE checked_at < datetime('now', '-30 days')").run()
})
```

---

### 4.2 告警通知（复用 logMonitor）

**目标**：检测发现 `online → offline` 时写告警，复用 logMonitor 的 LLM/ webhook 通道推送。

**DB**：

```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS service_alerts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    event      TEXT NOT NULL,                -- offline / online_recover
    prev_status TEXT,
    new_status  TEXT,
    latency_ms INTEGER,
    message    TEXT NOT NULL DEFAULT '',
    acknowledged INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sa_created ON service_alerts (created_at DESC);
`)
```

**检测路由内触发**（`check-all` 与 `/:id/check`）：检测后比对旧状态。

```ts
// check-all 里，更新前先取旧状态
const prevMap = new Map(services.map(s => [s.id, s.status]))
for (const r of results) {
  const prev = prevMap.get(r.id)
  if (prev === 'online' && r.status === 'offline') {
    triggerAlert(r.id, 'offline', prev, r.status, r.latencyMs, r.error)
  } else if (prev === 'offline' && r.status === 'online') {
    triggerAlert(r.id, 'online_recover', prev, r.status, r.latencyMs, '')
  }
  updateStmt.run(r.status, r.id)
  insertLog.run(...)
}
```

```ts
function triggerAlert(serviceId: number, event: string, prev: string, newStatus: string, latency: number | null, err: string) {
  const svc = db.prepare('SELECT name FROM services WHERE id=?').get(serviceId) as any
  const msg = event === 'offline'
    ? `服务「${svc.name}」离线（${err || '连接失败'}）`
    : `服务「${svc.name}」已恢复在线`
  db.prepare(
    'INSERT INTO service_alerts (service_id, event, prev_status, new_status, latency_ms, message) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(serviceId, event, prev, newStatus, latency, msg)
  // 推送：复用 logMonitor 的 webhook（若有配置）
  pushAlertToChannel(msg)
}

async function pushAlertToChannel(msg: string) {
  // 复用 logMonitor loadConfig 里的 webhook 配置，或新增 service_alert webhook
  const cfg = loadConfig()
  const url = (cfg as any).serviceAlertWebhook
  if (!url) return
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: msg }) })
  } catch (e) { console.warn('[service-alert] webhook 推送失败:', e) }
}
```

**后台告警面板**（新视图 `src/views/admin/AdminServiceAlerts.vue`）：表格显示未处理告警，按钮「确认」。

```ts
// router admin 下新增：
// /admin/services/alerts → AdminServiceAlerts.vue
```

**前台铃铛**（`ServicesView.vue` 顶栏）：显示未处理告警数，点击跳后台告警页。

```vue
<el-badge :value="unackAlertCount" :hidden="unackAlertCount === 0">
  <el-button circle @click="router.push('/admin/services/alerts')">
    <el-icon><Bell /></el-icon>
  </el-button>
</el-badge>
``

**关键控制**（避免告警风暴）：
- 同一服务离线期间不重复告警：`triggerAlert` 前查 `SELECT 1 FROM service_alerts WHERE service_id=? AND event='offline' AND acknowledged=0`，存在则跳过。
- 静默时段：配置 `silentHours: [0-6]`，区间内只落库不推送。

---

### 4.3 定时巡检（复用 logMonitor scheduler）

**现状可复用**：`server/logMonitor.ts` 已有 `startScheduler`（cron + 设备列表 + analyzeLogs + saveAudit）。服务巡检只需另起一个 cron，不混进日志调度。

**实现逻辑**（新建 `server/servicesScheduler.ts`）：

```ts
import cron from 'node-cron'
import db from './db'
import { concurrentPool } from './routes/services' // 若 export，否则内联
import { invalidateCheckAllCache } from './routes/services'

let cronTask: any = null
let lastRunTime: Date | null = null

export function startServicesScheduler(intervalMin = 10): void {
  if (cronTask) return
  const expr = `*/${intervalMin} * * * *`
  cronTask = cron.schedule(expr, async () => {
    lastRunTime = new Date()
    console.log('[services-scheduler] 开始巡检')
    const services = db.prepare("SELECT * FROM services WHERE status != 'maintenance'").all() as any[]
    // 复用 checkOne 逻辑（抽到一个共享函数更好）
    const results = await concurrentPool(services, 10, async (svc: any) => { /* 同 checkOne */ })
    const insertLog = db.prepare('INSERT INTO service_health_logs (...) VALUES (...)')
    const updateStmt = db.prepare("UPDATE services SET status=?, updated_at=datetime('now') WHERE id=?")
    for (const r of results) {
      updateStmt.run(r.status, r.id)
      insertLog.run(r.id, r.status, r.latencyMs, r.httpStatus || null, r.error || '')
      // 告警比对同 §4.2
    }
    invalidateCheckAllCache()
    console.log('[services-scheduler] 巡检完成, 在线=' + results.filter(r => r.status === 'online').length)
  })
}

export function stopServicesScheduler() { if (cronTask) { cronTask.stop(); cronTask = null } }
export function getServicesSchedulerStatus() { return { running: !!cronTask, lastRunTime } }
```

**配置入口**：`AdminServices.vue` 顶部加「巡检设置」按钮 → 弹窗配 `intervalMin`、`enable`，写入 `service_categories` 同级的配置表或复用 `admin` 字典。

**启动挂载**（`server/index.ts`）：

```ts
import { startServicesScheduler } from './servicesScheduler'
if (process.env.NODE_ENV === 'production') {
  startServicesScheduler(parseInt(process.env.SVC_CRON_MIN || '10'))
}
```

**pm2 配置**（`ecosystem.config.cjs`）：env 里加 `SVC_CRON_MIN: '10'`。

**验证点**：启动后每 10 分钟自动巡检，`service_health_logs` 表应有周期性记录。

---

### 4.4 凭证保险柜

**目标**：把现在明文放 `notes` 的账号密码加密存，按权限解密查看。

**DB**：

```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS service_credentials (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    label      TEXT NOT NULL,           -- 如「管理员账号」「数据库密码」
    username   TEXT NOT NULL DEFAULT '',
    secret_enc TEXT NOT NULL,           -- AES-256-GCM 密文 + iv + tag
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sc_service ON service_credentials (service_id);
`)
``

**加密**：AES-256-GCM，密钥从环境变量 `OPS_CRED_KEY`（32 字节 hex）取，启动时校验存在。

```ts
// server/utils/crypto.ts 新增
import crypto from 'node:crypto'

const KEY = Buffer.from(process.env.OPS_CRED_KEY || '', 'hex')
if (KEY.length !== 32) console.warn('[crypto] OPS_CRED_KEY 未配置或长度非 32，凭证功能不可用')

export function encryptSecret(plain: string): string {
  if (KEY.length !== 32) throw new Error('加密密钥未配置')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptSecret(b64: string): string {
  if (KEY.length !== 32) throw new Error('加密密钥未配置')
  const buf = Buffer.from(b64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
``

**路由**（仅 admin 可访问）：

```ts
// server/routes/services.ts 新增，挂在 admin 中间件后
router.get('/:id/credentials', requireAdmin, (req, res) => {
  // admin 可拿明文，普通用户返回「有凭证」标记 + label 列表
  const rows = db.prepare('SELECT id, label, username FROM service_credentials WHERE service_id=?').all(id)
  if (req.user?.role === 'admin') {
    const withPlain = rows.map((r: any) => ({ ...r, secret: decryptSecret(r.secret_enc) /* 从库里取 enc */ }))
    res.json({ code: 200, data: withPlain })
  } else {
    res.json({ code: 200, data: rows.map((r: any) => ({ id: r.id, label: r.label, username: r.username, hasSecret: true })) })
  }
})
``

**审计**：每次解密落一条 `credential_access_logs(admin_id, service_id, cred_id, accessed_at)`。

**前台抽屉**：

```vue
<div class="drawer-section">
  <div class="drawer-label">凭证</div>
  <div v-if="!auth.isAdmin && creds.length === 0" class="drawer-value">无凭证</div>
  <div v-for="c in creds" :key="c.id" class="cred-row">
    <span>{{ c.label }}</span>
    <span v-if="auth.isAdmin" class="cred-secret" @click="copy(c.secret)">{{ c.secret }}</span>
    <el-tag v-else type="info" size="small">需管理员权限查看</el-tag>
  </div>
</div>
``

---

### 4.5 收藏与个人常用面板

**DB**：

```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS user_service_favorites (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, service_id)
  );
`)
``

**路由**：

```ts
router.post('/:id/favorite', (req, res) => {
  db.prepare('INSERT OR IGNORE INTO user_service_favorites (user_id, service_id) VALUES (?, ?)').run(req.user.id, id)
  res.json({ code: 200 })
})
router.delete('/:id/favorite', (req, res) => {
  db.prepare('DELETE FROM user_service_favorites WHERE user_id=? AND service_id=?').run(req.user.id, id)
  res.json({ code: 200 })
})
router.get('/favorites', (req, res) => {
  const rows = db.prepare(
    `SELECT s.* FROM services s JOIN user_service_favorites f ON s.id=f.service_id WHERE f.user_id=? ORDER BY f.sort_order`
  ).all(req.user.id)
  res.json({ code: 200, data: rows.map(toApi) })
})
``

**前台**：卡片右上角星标按钮（`@click.stop` 防触发抽屉）：

```vue
<el-icon class="fav-btn" :class="{ active: isFav(svc.id) }" @click.stop="toggleFav(svc.id)">
  <Star v-if="!isFav(svc.id)" /><StarFilled v-else />
</el-icon>
``

**首页常用区**（`HomeView.vue`）：在「内网服务」卡片下加「我的常用」迷你网格，从 `/api/v1/services/favorites` 拉，点击直达。

---

### 4.6 导入/导出

**复用**：项目已有 `src/utils/excel.ts`（exceljs 封装）与 `src/utils/csv.ts`。

**导出**（后台 `AdminServices.vue` 顶部按钮）：

```ts
import { exportToExcel } from '../../utils/excel'

async function handleExport() {
  const rows = services.value.map(s => ({
    名称: s.name, 地址: s.url, 分类: s.category, 主机: getHostName(s.hostId),
    状态: s.status, 描述: s.description, 备注: s.notes, 图标: s.icon,
  }))
  await exportToExcel(rows, { fileName: '内网服务列表.xlsx', sheetName: '服务' })
}
``

**导入**：

```vue
<el-upload :show-file-list="false" :before-upload="handleImport" accept=".xlsx,.csv">
  <el-button type="success" size="small"><el-icon><Upload /></el-icon> 导入</el-button>
</el-upload>
``

```ts
async function handleImport(file: File) {
  // 解析 excel/csv → 行数组
  const rows = file.name.endsWith('.csv') ? parseCsv(file) : await parseExcel(file)
  // 批量调 createService，校验失败行单独收集
  const ok: string[] = [], fail: string[] = []
  for (const r of rows) {
    try {
      await servicesStore.addService({ name: r.名称, url: r.地址, category: r.分类, ... })
      ok.push(r.名称)
    } catch (e) { fail.push(`${r.名称}: ${e.message}`) }
  }
  ElMessage.success(`导入成功 ${ok.length} 条，失败 ${fail.length} 条`)
  if (fail.length) ElMessage.warning('失败明细：' + fail.slice(0, 5).join('；'))
  await loadData()
}
``

**导入模板下载**：提供一个固定 `.xlsx` 模板（仅表头），放 `public/templates/services-import-template.xlsx`。

---

## 五、验证清单

### P0 验证

| # | 操作 | 预期 |
| --- | --- | --- |
| 1 | 前台点「检测连通性」，对某离线服务 | 检测完成卡片立即变红，无需刷新 |
| 2 | mock 25 个服务，前台加载 | 全部 25 个显示，主机卡片计数正确 |
| 3 | DB 写 `javascript:alert(1)` 的服务 | 前台「访问」按钮禁用，后端 POST 返回 400 |

### P1 验证

| # | 操作 | 预期 |
| --- | --- | --- |
| 4 | 单点检测某服务变 offline 后立即批量检测 | summary 反映最新 offline+1（不命中旧缓存） |
| 5 | PATCH `{ category: "非法" }` | 返回 400 |
| 6 | PATCH `{ name: "x"*200 }` | 返回 400 |
| 7 | mock 只支持 GET 的服务（HEAD 返 405） | 检测后状态为 online |
| 8 | 后台点某行「检测」按钮 | loading 完后状态列更新 |
| 9 | POST `url: "http://169.254.169.254/x"` | 返回 400 SSRF 拦截 |

### 新功能验证

| # | 功能 | 验证点 |
| --- | --- | --- |
| 10 | 健康历史 | 检测 5 次后抽屉时序图显示 5 个点 |
| 11 | 告警 | 在线服务断网后 1 分钟内铃铛 +1，webhook 收到推送 |
| 12 | 定时巡检 | 启动后 10 分钟 `service_health_logs` 自动新增 N 条 |
| 13 | 凭证保险柜 | admin 可解密查看，普通用户只见「需管理员权限」 |
| 14 | 收藏 | 点星标后首页「我的常用」立即出现该服务 |
| 15 | 导入导出 | 导出 xlsx 用 Excel 打开列对齐；导入同名应返 409 |

---

## 六、附：实现顺序与工作量预估

| 阶段 | 任务 | 预估 |
| --- | --- | --- |
| Day 1 | P0 三项（§2.1-2.3） | 2h |
| Day 2 | P1 健壮性（§3.1-3.3） | 2h |
| Day 3 | P1 UX（§3.4-3.5） + SSRF（§3.6） | 3h |
| Day 4-5 | 健康历史（§4.1）含 SVG 图表组件 | 1d |
| Day 6-7 | 告警（§4.2） + 定时巡检（§4.3） | 1.5d |
| Day 8 | 凭证保险柜（§4.4） | 0.5d |
| Day 9 | 收藏（§4.5） + 导入导出（§4.6） | 0.5d |

总计约 5 人日，P0+P1 可在 2 天内闭环。

---

> 本文档与 `services-review-2026-07-11.md`（v1 总览）配合使用：v1 看全貌与优先级，v2 看每项的实现逻辑与代码片段。
