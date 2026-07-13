# 内网服务管理页面 — 优化与新增功能建议

> 评审时间：2026-07-11
> 评审范围：`src/views/ServicesView.vue`（前台）、`src/views/admin/AdminServices.vue`（后台）、`src/api/services.ts`、`src/stores/services.ts`、`server/routes/services.ts`、`server/db.ts`（services / service_hosts / service_categories 表）
> 评审人：AtomCode

---

## 一、现状概览

### 1.1 功能矩阵

| 能力 | 前台 ServicesView | 后台 AdminServices |
| --- | :-: | :-: |
| 卡片网格展示服务 | ✓ | — |
| 搜索（名称/描述/地址） | ✓ | ✓ |
| 分类筛选 | ✓ | — |
| 状态筛选（在线/离线/维护） | ✓ | — |
| 主机筛选（按部署主机） | ✓ | — |
| 连通性检测（批量 / 单点） | ✓（仅批量按钮） | — |
| 详情抽屉 | ✓（只读 URL/描述/备注 + 访问按钮） | — |
| 新增 / 编辑 / 删除 | ✗ | ✓ |
| 骨架屏 / 空状态 | ✓ | — |
| 本地缓存（localStorage 5min TTL） | ✓ | — |
| 服务图标自定义 | — | ✓（下拉选择） |
| URL 状态同步（query 参数） | ✓ | — |

### 1.2 技术要点
- 后端检测逻辑：`fetch(svc.url, { method: 'HEAD', signal: AbortController, 5s 超时 })`，并发池上限 10，60s 内存缓存。
- 数据模型：`services` 表唯一约束 `name` 和 `url`；`host_id` 外键 `ON DELETE SET NULL`。
- 状态枚举：`online / offline / maintenance / checking`（`checking` 仅前端过渡态，不入库）。
- 前台与后台共用 `useServicesStore`，但前台只读、后台可写。

---

## 二、问题与优化意见

按「严重程度」分级：🔴 必须修复 · 🟠 建议修复 · 🟡 仅供参考。

### 2.1 数据正确性

| # | 级别 | 问题 | 位置 | 建议 |
| --- | --- | --- | --- | --- |
| 1 | 🔴 | **批量检测结果不刷新前台卡片状态**：`checkAllServices` store 把结果写入 `checkResults`，但卡片绑定的是 `svc.status`（来自 `services` 数组），后端虽然 `UPDATE services SET status` 了，前台 `services` 数组并未更新 → 检测后卡片状态颜色不变，必须重新 `loadServices` 才生效。 | `src/stores/services.ts` `checkAllServices` | 检测完成后回写 `services.value` 中对应项的 `status`，或检测后调用 `loadServices()` 强制刷新（注意会清缓存）。 |
| 2 | 🔴 | **批量检测跳过维护态服务但仍覆盖其状态**：后端 `check-all` 查 `WHERE status != 'maintenance'`，但 `summary.total = allResults.length` 包含维护态，前端 `summary` 展示可能误导（维护态服务被算进 total，却又没真的检测）。 | `server/routes/services.ts` L243-271 | 维护态单独计入 `summary.maintenance`（已做），但应在响应里明确 `skipped` 字段或前端区分「跳过」与「检测失败」。 |
| 3 | 🟠 | **检测缓存与单点检测不互斥**：单点 `/:id/check` 修改了 DB status，但 `checkAllCache`（60s）仍保留旧 summary，下次批量调用会命中缓存返回过期数据。 | `server/routes/services.ts` L234 vs L286 | 单点检测后 `checkAllCache = null` 失效缓存。 |
| 4 | 🟠 | **`PATCH` 未校验 `category` 是否在字典中**，而 `POST`/`PUT` 都校验了 → 可绕过字典插入非法分类。 | `server/routes/services.ts` L154-199 | `PATCH` 中若 `req.body.category` 存在则同样校验 `getCategories().includes(...)`。 |
| 5 | 🟠 | **`PATCH` 未校验 `status` 之外的字段长度/类型**（name、url 长度、url 格式），可写入超长或非法值。 | `server/routes/services.ts` L162-176 | 对 name/url 补充长度上限与 URL 格式校验，与 POST 保持一致。 |
| 6 | 🟡 | **检测连通性仅 HEAD 请求**：部分服务不支持 HEAD（返回 405），会被误判为 offline。 | `server/routes/services.ts` L251 | HEAD 失败后回退 GET（仅取响应头/状态码，不读 body），或改用 `GET` + `AbortController` 取首字节。 |

### 2.2 性能

| # | 级别 | 问题 | 建议 |
| --- | --- | --- | --- |
| 7 | 🟠 | **前台 `fetchServices` 拿全量列表**（API 默认 pageSize=20，但 store 未传分页参数，实际返回 20 条），当服务超过 20 个时前台只显示前 20 个，主机筛选卡片计数 `services.length` 也只反映 20 条 → 数据不一致。 | 前台调用 `fetchServices({ pageSize: 100 })`（后端上限 100），或新增「不分页全量」接口；超过 100 时需引入分页 UI。 |
| 8 | 🟡 | **批量检测并发上限 10 固定**，服务数量多时整体耗时线性增长。 | 可按服务总数动态调整（如 `Math.min(20, Math.ceil(n/3))`），或前端显示进度条。 |
| 9 | 🟡 | **`getCategories()` 每次写操作都查库**，高频写入时重复查询。 | 进程内缓存 + 写操作后失效，或启动时预载。 |

### 2.3 前台 UX

| # | 级别 | 问题 | 建议 |
| --- | --- | --- | --- |
| 10 | 🔴 | **无分页/无限滚动**：当服务数量 > pageSize（20）时，前台会漏显示部分服务，且无任何提示。 | 显式传 `pageSize: 100` 兜底，并在卡片栏底部显示「共 N 个，已显示 M 个」；超过时引入「加载更多」。 |
| 11 | 🟠 | **检测中无进度反馈**：点「检测连通性」后按钮变 loading，但用户不知道在测哪个、剩几个。 | 后端 `check-all` 改 SSE（Server-Sent Events）流式返回每条结果，前端边测边更新卡片状态；或至少在按钮旁显示「检测中 X/Y」。 |
| 12 | 🟠 | **卡片缺少「最后检测时间」与「延迟」**：后端 `checkOne` 返回 `latencyMs`，store 存进 `checkResults`，但前台完全没用。 | 卡片底部显示「↓ 32ms · 14:30」；抽屉里显示最近 N 次检测时序图（需后端记录历史，见新增功能 §3.3）。 |
| 13 | 🟠 | **主机卡片横向溢出时无滚动提示**：`overflow-x: auto` 但不显示滚动条，多个主机时用户不知可横滑。 | 加 `scrollbar` 样式或在两端显示渐变遮罩 + 「左右箭头」按钮。 |
| 14 | 🟠 | **抽屉详情信息过少**：只有 URL/描述/备注，缺少分类、部署主机、创建时间、最后检测等。 | 抽屉补充分类、主机名+IP、创建时间、最后检测状态/延迟、历史趋势（若有）。 |
| 15 | 🟡 | **卡片整卡可点打开抽屉，但无「访问」快捷按钮**：CSS 里定义了 `.quick-visit` 但模板没用到 → 歪代码。 | 卡片右下角加「访问」按钮（`@click.stop` 防误触发抽屉），或抽屉里已有「访问服务」按钮就够了——删除死代码。 |
| 16 | 🟡 | **无键盘可达性**：卡片是 `<div @click>`，无 `tabindex` / `role="button"` / `Enter` 触发。 | 加 `tabindex="0"` `role="button"` `@keyup.enter`。 |
| 17 | 🟡 | **状态枚举不一致**：前端 type 有 `checking`，后台 AdminServices 的 `statusLabel` 只认 online/offline/maintenance，遇到 `checking` 会原样输出英文。 | 后台补 `checking` 分支或统一前端枚举常量。 |
| 18 | 🟡 | **筛选状态未与主机筛选同步到 URL**：`watch` 只同步了 search/category/status，`selectedHostId` 未同步 → 刷新丢失主机筛选。 | 把 `selectedHostId` 也并入 `router.replace` 的 query。 |

### 2.4 后台 UX（AdminServices）

| # | 级别 | 问题 | 建议 |
| --- | --- | --- | --- |
| 19 | 🟠 | **无分页**：表格直接绑定 `services.value`（前台拿到的 20 条），服务多时同 §2.3 #10 问题，且后台编辑完 `loadData` 也只拿 20 条。 | 后台表格接入分页（el-pagination），或同样传 `pageSize: 100`。 |
| 20 | 🟠 | **无连通性检测入口**：后台表格只展示 status 字段值，无法触发检测。 | 表格「操作」列加「检测」按钮 → 调 `checkService`，或顶部加「批量检测」。 |
| 21 | 🟡 | **图标选择器为下拉文本，预览弱**：`el-option` 里有图标，但选中后输入框只显示文字。 | 改用图标网格选择器（前台 CSS 已有 `.icon-picker` 模板，可复用）。 |
| 22 | 🟡 | **无批量操作**：不能批量改状态/分类/删主机迁移。 | 表格加 `selection` 列 + 批量操作工具栏。 |

### 2.5 安全与健壮性

| # | 级别 | 问题 | 建议 |
| --- | --- | --- | --- |
| 23 | 🟠 | **`openService(url)` 直接 `window.open(url, '_blank')`**：服务 url 来自数据库，若被写入 `javascript:` 或外站钓鱼链接，用户点击「访问服务」会执行恶意代码。 | 校验 url 协议必须 `http/https`，否则禁用按钮并提示；后端入库时也应校验协议白名单。 |
| 24 | 🟠 | **后端 `fetch(svc.url)`  SSRF 风险**：服务 url 由管理员录入，可指向内网任意地址（含 metadata 服务 `169.254.169.254`），检测逻辑变 SSRF 放大器。 | 检测前校验 url 不在保留网段黑名单（云元数据、本机管理端口），或限制仅允许录入的网段。 |
| 25 | 🟡 | **`fetch` HEAD 超时 5s 单点，但批量并发 10 × 5s = 最坏 50s**，前端 fetch 默认无超时，可能一直挂。 | 前端 `request` 加超时（如 30s）与取消；或后端批量改为 SSE 边测边回。 |
| 26 | 🟡 | **路由权限未在 services 路由内做分层**：前台 `/services` 任何登录用户可读全部服务（含内网 IP/url），后台 `/admin/services/*` 才需 admin。 | 评估是否按用户可见范围过滤；或前台仅返回有访问权限的服务子集。 |

### 2.6 代码质量

| # | 级别 | 问题 | 建议 |
| --- | --- | --- | --- |
| 27 | 🟡 | **store `updateService` 调 `api.updateService`（PUT 全量），但传的是 `Partial<Service>`**，未提供的字段会被覆盖为 undefined → DB 写入空值。 | 后台编辑用的是全量表单所以暂时无 bug，但 API 语义不匹配；改为按字段补默认值或改调 `patchService`。 |
| 28 | 🟡 | **`toApi` 手工列字段**，新增字段需同步多处，易漏。 | 用 `Object.fromEntries` + 字段白名单，或引入 zod schema 双向校验。 |
| 29 | 🟡 | **mock 数据与回填脚本硬编码**在 `db.ts`（如 `['Zabbix 监控', 'ESXi-01']`），环境差异时误执行会污染数据。 | 迁移到独立 seed 脚本，仅在 `NODE_ENV=seed` 时执行。 |
| 30 | 🟡 | **前台 `hosts` / `serviceCategories` 用 `any[]`**，无类型。 | 定义 `ServiceHost` / `ServiceCategory` interface。 |

---

## 三、可新增加功能意见

按「价值 / 实现成本」排序，⭐ 越多越值得做。

### 3.1 服务健康历史与趋势 ⭐⭐⭐⭐⭐

**现状**：检测只保留「当前」状态，无历史。

**方案**：
- 新表 `service_health_logs(id, service_id, status, latency_ms, checked_at)`，每次检测（批量/单点）插入一条。
- 前台抽屉加「最近 24 小时状态时间线」（element-plus 无时序图，可用简单 SVG 或 ECharts）。
- 后台服务详情加「可用率 = online / total」「平均延迟」。
- 可配置保留天数（默认 7 天，定时清理）。

**价值**：判断「偶发抖动」与「长期离线」，定位不稳定服务。

### 3.2 服务告警与通知 ⭐⭐⭐⭐

**方案**：
- 检测结果与上次比对，`online → offline` 触发告警事件，写入 `service_alerts` 表。
- 告警通道复用已有的 `log-monitor` LLM/ webhook 机制（项目已有 `server/logMonitor.ts`），推送至企业微信群。
- 后台「告警规则」配置：连续 N 次失败才告警、静默时段、告警级别。
- 前台顶部加「告警铃铛」入口，显示未处理告警数。

**价值**：从「被动查看」变「主动通知」，运维闭环。

### 3.3 定时巡检 / 计划任务 ⭐⭐⭐⭐

**现状**：检测靠用户手动点。

**方案**：
- 后台配置「巡检计划」（每 5/10/30 分钟执行 `check-all`），复用 `pm2` + node-cron。
- 巡检结果落 `service_health_logs`，配合 §3.1。
- 前台显示「下次巡检时间」与「上次巡检结果」。
- 项目已有 `ecosystem.config.cjs`（pm2），集成成本低。

**价值**：7×24 自动监控，无需人值守。

### 3.4 服务分组与标签 ⭐⭐⭐

**现状**：只有单一 `category`，无法多维度归类（如「监控」+「核心」+「ESXi-01」）。

**方案**：
- 新增 `service_tags` 多对多关系表，或直接 `tags TEXT` JSON 列。
- 前台支持按标签筛选；卡片角标显示标签。
- 后台编辑表单加「标签输入」。

**价值**：运维大屏可按「核心/边缘」「部门」聚合查看。

### 3.5 服务依赖关系图 ⭐⭐⭐

**方案**：
- 服务间声明依赖（`service_dependencies(from_id, to_id)`）。
- 前台「依赖视图」用 DAG 图（如 vis-network）展示，离线服务高亮其下游。
- 下线某服务前可评估影响面。

**价值**：变更影响分析，防连环故障。

### 3.6 服务账号/凭证保险柜 ⭐⭐⭐

**现状**：`notes` 字段明文存账号密码，所有登录用户可见。

**方案**：
- 新增 `service_credentials` 表，加密存（AES-GCM，密钥放后端环境变量）。
- 前台抽屉「凭证」区按权限显示：普通用户仅显示「有凭证」标记，管理员可解密查看 + 复制。
- 操作审计日志记录每次解密。

**价值**：解决内网服务账号共享与安全的矛盾。

### 3.7 服务收藏与个人面板 ⭐⭐⭐

**方案**：
- `user_service_favorites(user_id, service_id)`。
- 前台卡片加「星标」，首页 `/` 加「我的常用服务」区，快速直达。
- 按用户访问频次自动推荐「常用」。

**价值**：每个运维人关心的服务不同，个性化入口。

### 3.8 服务访问审计 ⭐⭐

**方案**：
- 前台点「访问服务」时上报一条 `service_access_logs(user_id, service_id, accessed_at, ip)`。
- 后台服务详情显示「最近访问者」与「访问热度」。

**价值**：评估服务使用情况，下线决策依据；安全审计。

### 3.9 服务 SLA 看板 ⭐⭐

**方案**：
- 基于 `service_health_logs` 计算 SLA（在线时间 / 总时间），按分类/主机聚合。
- 首页或 `/services` 顶部加统计卡片：「在线率 99.2% · 平均延迟 45ms · 离线 2 个」。
- 复用 `onlineCount/ offlineCount/ maintenanceCount` 已有的 store computed。

**价值**：一眼掌握整体健康度。

### 3.10 服务导入/导出 ⭐⭐

**方案**：
- 后台加「导入 Excel/CSV」与「导出」按钮，复用项目已有 `src/utils/excel.ts` 与 `csv.ts`。
- 导入模板：name, url, category, host, icon, description, notes。

**价值**：批量初始化或迁移，减少手工录入。

### 3.11 服务地图 / 拓扑可视化 ⭐⭐

**方案**：
- 结合已有 `service_hosts` 主机 + `racks`（机柜）数据，绘制「机柜 → 主机 → 服务」三层拓扑。
- 离线服务在拓扑上标红。

**价值**：直观定位物理位置，机房巡线参考。

### 3.12 单点登录门户 ⭐⭐

**方案**：
- 卡片「访问」改为「一键登录」：后端代理目标服务的登录请求，下发 session token，前端跳转带 token。
- 仅对支持该模式的服务（如 Gitea、Grafana 有 OAuth/API Token）实现。

**价值**：免去逐个服务输密码，提升运维效率。

---

## 四、优先级建议路线图

### P0（本周）— 数据正确性兜底
1. 修 §2.1 #1：检测后回写 `services` 状态
2. 修 §2.3 #10：前台传 `pageSize: 100` 并显示总数
3. 修 §2.5 #23：`openService` 校验 url 协议白名单

### P1（2 周内）— UX 与健壮性
4. §2.1 #3 #4 #5：PATCH 校验 + 缓存失效
5. §2.3 #11 #12：检测进度 + 延迟展示
6. §2.4 #19 #20：后台分页 + 检测入口
7. §2.5 #24：SSRF 网段校验

### P2（1 月内）— 新功能首期
8. §3.1 健康历史 + §3.3 定时巡检（配套落地）
9. §3.2 告警通知（复用 log-monitor）
10. §3.7 收藏与个人面板

### P3（季度）— 深化
11. §3.4 标签 / §3.5 依赖图 / §3.6 凭证保险柜 / §3.9 SLA 看板
12. §3.10 导入导出 / §3.11 拓扑 / §3.12 SSO 门户

---

## 五、附录：关键文件清单

| 模块 | 文件 |
| --- | --- |
| 前台视图 | `src/views/ServicesView.vue` |
| 后台视图 | `src/views/admin/AdminServices.vue` |
| API 层 | `src/api/services.ts` |
| Store | `src/stores/services.ts` |
| 后端路由 | `server/routes/services.ts` |
| 数据库 | `server/db.ts`（services / service_hosts / service_categories 表 + 迁移） |
| 类型 | `src/types/index.ts`（`Service` interface L25-35） |
| 路由 | `src/router/index.ts`（L20-24 前台、L87-89 后台） |
| 复用资源 | `src/utils/excel.ts` `src/utils/csv.ts` `server/logMonitor.ts` `ecosystem.config.cjs` |
