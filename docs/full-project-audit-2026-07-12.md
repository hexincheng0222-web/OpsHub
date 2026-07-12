# 项目全面巡查报告

> **巡查时间**：2026-07-12
> **分支**：`hxc`
> **范围**：后端 13 个路由 + 全部 stores/apis/utils/类型定义/路由配置（共 50+ 文件）
> **方法**：4 路并行只读审查，覆盖采购/话机/服务/日志监控/认证/操作手册/设备打印机/数据库基础设施
> **计数**：🔴 高 5 个 / 🟡 中 12 个 / 🟢 低 7 个

---

## 一、🔴 高严重度（5 个，必修）

| # | 位置 | 问题 | 触发场景 |
|---|------|------|----------|
| 1 | `server/routes/phones.ts:361` vs `:486` | `/:id/details` 拦截整组 `/phonebook` 路由（Express 按定义顺序匹配，前端请求 `/api/v1/phones/phonebook` 会先命中 `/:id/details`，`id="phonebook"` 找不到 → 404）。电话簿 CRUD + 通讯录下发全部失效 | 打开电话簿 / 推送通讯录 |
| 2 | `server/logMonitor.ts:591-598` | LogQL 字符串拼接 `{host="${hostname}"}` 未做白名单校验，调用方 `routes/log-monitor.ts:120` 把 `req.body.hostname` 直传。可注入跨设备读日志（LogQL 注入 = 数据泄漏） | 攻击者对 `POST /analyze-device` 传恶意 hostname |
| 3 | `src/views/OperationsView.vue:433`、`:486` | 打印 / 导出 `.doc` 时 `doc.title` 未 HTML 转义直接拼进 `document.write` → XSS | 文档标题含 `<img src=x onerror=...>` 时点「打印」 |
| 4 | `src/views/ManDocEditor.vue:47` | `v-html="versionPreview.content"` 直接渲染 DB 内容，无 sanitize（同页面阅读视图用了 `sanitizeHtml`，版本预览漏了）→ 次生 XSS | 点开含恶意脚本的版本「预览」 |
| 5 | `server/db.ts` | **双重问题**：①全文只有 `PRAGMA table_info` 从无 `PRAGMA foreign_keys = ON`，better-sqlite3 默认关闭外键 → 建表声明的 `REFERENCES ... ON DELETE CASCADE/SET NULL` 全部失效，删机柜后 `rack_slots` orphan 永久残留、`printer_models`/`phone_models`/`toner_models`/`manual_docs` 等级联均不生效；②`device_types` 迁移（行 560）在无 `key` 列时 `DROP TABLE device_types` 重建为空表，而行 681 的 `INSERT INTO device_types` 整个嵌在 `if (floorCount.cnt === 0)`（行 673） seed 块内。**仅当两个条件同时成立才会触发清空不重填**：库中 `device_types` 尚无 `key` 列（触发 DROP 重建为空）**且** `device_floors` 已有历史数据（seed 块被跳过）。一次性迁移——成功加上 key 列后不会再进 DROP 分支 | ①删除机柜 ②持"无 key 列旧库"升级且 device_floors 已有数据 |

---

## 二、🟡 中严重度（12 个）

| # | 位置 | 问题 | 触发场景 |
|---|------|------|----------|
| 1 | `server/logMonitor.ts:474-506` | 调度器用 `setInterval` 但无互斥锁，上一轮未结束下一轮就并发进入，叠加 DB/Loki 压力甚至拖垮进程 | LLM 或 Loki 响应慢、设备数 ≥10 |
| 2 | `server/logMonitor.ts:289-295` | `cleanupAudit` 只做 `DELETE FROM log_audit`，从不清理 `saveAudit` 写入的 `data/log-audit/YYYY-MM-DD/*.json` 磁盘文件。7 天后 DB 行删除但 JSON 文件永远保留，磁盘越积越多 | 系统运行数月后 `data/log-audit/` 目录膨胀耗尽磁盘 |
| 3 | `server/logMonitor.ts:669-699` | `getDashboardData` 对 `discoveredDevices.map(fetchLokiLogsCached)` 直接 `Promise.all`。Loki query_range 缓存 key 含 `start.getTime()`，timeRange 切换或 10s TTL 过期会同时打出与设备数等量的请求，无并发池/限流 | 自动刷新 + 设备数较多（50+）时每 10s 一次洪峰 |
| 4 | `src/views/PrintersView.vue:303`、`:354` | 确认导入 / 批量删除无 loading 态互斥，快速双击「确认导入 N 条」会发送两次相同请求，后端 `importPrinters` 无唯一性约束 → 数据重复写入 | 双击或连续点击「确认导入」/「批量删除」 |
| 5 | `server/routes/phones.ts:27` | `params.opaque` 错拼成 `params.opopaque`（第 23 行正则捕获的 key 是 `opaque`，存在 `params.opaque` 里）→ Digest 认证重试时 `opaque` 恒为空 | ATCOM 服务端若严格校验 opaque，所有 `atcomPost`（下发通讯录、写配置、远程话机、重启）会认证失败 |
| 6 | `src/views/PhonesView.vue:298-304` | `openDetail` 把编辑态重置写在 try 块内，`fetchPhoneDetail` 抛错进入 catch 时 `editing`/`pbEditing` 不重置，抽屉保持「编辑中」但 detail 为空/旧数据；`remarkForm`/`pbForm` 也不在开新抽屉时清空 → 编辑态串到另一台话机 | 保存账号失败后关闭抽屉再点开另一台话机 |
| 7 | `src/views/procurement/ComputerProcurementTab.vue:720` / `PhoneProcurementTab.vue:710` | 撤销删除走 `addComputer/addPhone`（INSERT 新记录）而非恢复。后端不用前端传入的 id，手机采购还会由 `generateAssetNumber()` 重新生成资产号。结果「撤销」实际新增了一条 id/资产号不同的新记录，原软删除记录仍在回收站 → 语义错误且可能产生重复记录 | 批量删除后点提示中的「撤销」 |
| 8 | `src/utils/format.ts:6-10` | `server/db.ts` 所有时间戳用 `datetime('now')`（**UTC**）存储；`formatTime` 用 `new Date(time).toLocaleString('zh-CN', { hour12: false })`——ES2015+ 对无时区后缀的 ISO 字符串按**本地时间**解析，再用本地时区显示，等于把 UTC 数值直接当本地时间。UTC+8 用户看到的时间比真实晚 8 小时（UTC 08:00 应显示 16:00 却显示 08:00） | 所有时间显示（created_at / updated_at / 操作日志等） |
| 9 | `src/utils/http.ts:63` | OK 路径 `const json = await res.json()` 无 try/catch，假设所有 2xx 都是合法 JSON。反向代理错误页、网关 502 等可能回传 HTML 且状态码为 200，`res.json()` 抛 `SyntaxError: Unexpected token <` 未捕获 → 顶层 unhandled rejection，调用方拿不到友好错误。与行 52-55 的 4xx/5xx try/catch 保护不对称 | 网络基础设施异常时错误兜底缺失 |
| 10 | `server/routes/computer-procurement.ts:64-67` / `phone-procurement.ts:77-80` | 回收站端点直接 `res.json({ data: rows })` 返回 snake_case 原始行，未走 `toApi`（主列表行 58/71、PUT 行 147 都转了 camelCase）。前端 `fetchComputerTrash/fetchPhoneTrash` 也没 `fromApi`。模板 `ComputerProcurementTab.vue:251` 访问 `r.model`/`r.department`/`r.deleted_at`、`PhoneProcurementTab.vue:262` 访问 `r.brand`/`r.deleted_at`——单字段名 snake/camel 一致所以碰巧不崩，但数据契约不一致，一旦模板扩展显示 `macAddress`、`assetNumber` 等字段即显示 `undefined` | 当前碰巧不崩，UI 扩展即坏 |
| 11 | `src/utils/printer-table-helper.ts:29`、`:100-115` | `floorGroupsCache` 模块级单例 Map 无 TTL / 失效机制；cache key 只含 `id + status`，不含 `manufacturer / model / location / tonerModel / notes` 等参与排序分组的字段 → 编辑打印机型号/位置后刷新列表时 hash 未变 → 命中旧缓存显示陈旧分组；长期运行 Map 单调增长（内存泄漏） | 编辑打印机型号 / 位置 |
| 12 | `src/views/ServicesView.vue:263-269` | `watch(selectedService)` 异步取历史点 `fetchHistory`，无 requestId / 计数器守卫。快切卡片时先发出的慢响应可能在后发起的请求返回之后才回来，把旧设备的 `healthPoints` 写入 / 把 A 的历史数据绘制到 B 的抽屉里 | 连续快速点击两个不同的服务卡片 |

---

## 三、🟢 低严重度（7 个）

| # | 位置 | 问题 |
|---|------|------|
| 1 | `src/router/index.ts:141` | 管理员权限检查用 `to.path.startsWith('/admin')`，会误匹配 `/adminxxx` 这类非 admin 路径。实际路由表无此类路径，只落到 404，不构成真实风险 |
| 2 | `server/routes/racks.ts:59`、`:73` + `src/views/DevicesView.vue:96` | `createRack` 对 `totalU` 无下限校验，可被设为 0 → 生成空布局幽灵机柜（前端 KPI 不受影响）。属功能异常，需外部构造请求触发 |
| 3 | `src/stores/procurement.ts:71-74` / `:120-123` | `updateComputer/updatePhone` 乐观更新用的是前端请求体 `{ ...computers.value[idx], ...data }` 而非后端响应 `toApi(row)`。当前后端不改写字段故无害，但一致性隐患（若未来归一化/裁剪字段会短暂显示错误值） |
| 4 | `src/utils/sanitize.ts:5` | sanitizer 对 `a[target="_blank"]` 与 `on*` 之外的危险协议向量过滤能力有限；`form` 内嵌套 `input`/`button` 的 UI 伪装风险未审视。纵深防御角度可加强，当前关键危险标签已被挡 |
| 5 | `src/views/OperationsView.vue:597-598` | `wordCount` 通过正则 ``.replace(/[`\-\[\]()>#]/g, '').length`` 计算字数，错误地把 markdown 符号当一个字符删掉而非剥标签 → 统计偏少（体验性） |
| 6 | `src/utils/excel.ts:31-42` | `parseXlsx` 用 `sheet_to_json(ws, { header: 1, defval: '' })`：合并单元格只保留首单元格值其余空、日期单元格返回 Excel 序列号数字（如 `45300.5`）而非格式化日期、行数组长度不足 header 时不补齐 → 导入带合并单元格/日期列/缺列的 xlsx 会显示小数、丢数据、字段错位 |
| 7 | `server/routes/devices.ts:76-156` | `POST /api/v1/devices/:id/move` 信任 `device.u` 做冲突检测与槽位回收，未用 `currentSlot.u_size` 做最终一致性检查。若设备行 `u` 字段与槽位历史值不一致，移动会导致槽位重叠/缺口（需已有错误数据才触发） |

---

## 四、✅ 通过项（无问题，供确认）

- **外键指向一致性**：所有 `REFERENCES` 指向的表/列均存在（`services→service_hosts`、`rack_slots→racks/devices`、`printer_models/toner_models→printer_brands`、`phone_models→phone_brands`、`manual_docs→manual_folders`、`manual_favorites→users/manual_docs` 等），无断链，仅因外键关闭不生效
- **主键策略**：全文 35 个主键**全部**是 `INTEGER PRIMARY KEY AUTOINCREMENT`，一致，无 id 复用风险
- **初始数据幂等**：`system_config`（行 1294）和 `log_monitor_config`（行 1380）使用 `INSERT OR IGNORE`；其余 services/racks/devices/字典/手册/打印机/采购用 `if (COUNT(*) === 0)` 包裹，幂等；仅 `device_types` 迁移的 DROP 路径例外
- **sanitize.ts**：XSS 剥离覆盖 script/iframe + 事件属性 + `javascript:`/`data:` URI + style expression/url，策略合理
- **App.vue 定时器 / 事件监听**：`idleTimer`/`countdownTimer` 在 `onUnmounted` 清理，click/keydown/scroll 监听也移除，无明显泄漏
- **路由守卫**：`/admin` 走 `isAdmin` 校验，401 走 auth store logout + redirect，主路径一致

---

## 五、优先修复建议（按投产价值排序）

| 优先级 | 修复项 | 理由 |
|--------|--------|------|
| P0 | **🔴#5 外键 + device_types 迁移（db.ts）** | 数据完整性兜底。外键未启用导致级联全部失效，加 `PRAGMA foreign_keys = ON` 即可；device_types 迁移需把 seed 判断从 `floorCount` 改为独立（seed 字典不应依赖 device_floors 是否为空） |
| P0 | **🔴#1 phonebook 路由（phones.ts）** | 整个电话簿 CRUD + 通讯录下发功能不可用，一组路由提前定义就修好（与采购 trash 路由同手法） |
| P0 | **🔴#2 LogQL 注入（logMonitor.ts）** | 数据安全问题，hostname 加白名单正则（`/^[a-zA-Z0-9._-]+$/`）即可挡 |
| P1 | **🔴#3/4 XSS（OperationsView + ManDocEditor）** | 标题转义 + v-html 过 `sanitizeHtml` |
| P2 | **🟡#8 formatTime 时区（format.ts）** | 影响面最大——所有时间戳偏差 8 小时，影响操作日志/审计/采购/话机等全系统时间判断 |
| P2 | **🟡#1 调度器互斥 / #2 磁盘泄漏 / #3 dashboard 限流（logMonitor.ts）** | 规模部署下会稳定触发，修一处受益多处 |
| P3 | 其余中/低项 | 按迭代排期处理 |

---

## 六、根因模式（横向观察）

本次巡查暴露几类可系统性避免的错误模式：

1. **Express 路由顺序陷阱**：`/:id/*` 类通配路由必须放在静态路径（`/phonebook`、`/trash`）**之前**，否则整组路由被吞。本次 phonebook、采购 trash（已通过注释说明）都踩过。**建议**：项目约定「所有 `/static-path` 必须在 `/:param` 之前」，或统一抽到路由表按静态优先排序。
2. **better-sqlite3 外键默认关闭**：框架不会自动开， CASCADE/SET NULL 只是注释。**建议**：`db.ts` 启动时统一 `db.exec('PRAGMA foreign_keys = ON')`。
3. **破坏性迁移范式**：`DROP TABLE IF EXISTS device_types` 后重建 = 数据全丢。**建议**：字典类升级一律用 `ALTER TABLE ADD COLUMN`（已addColumn 时用重建是兜底，但 seed 必须独立于插入量判断）。
4. **前端乐观更新的数据源**：store 更新应以后端 `toApi(row)` 响应为准而非前端请求体，避免前后端短暂不一致。
5. **时间语义不统一**：DB 用 UTC (`datetime('now')`) 但前端无时区后缀解析。**建议**：要么 DB 改用本地存、要么前端强制按 UTC 渲染（`toLocaleString('zh-CN', { timeZone: 'UTC' })`）。

---

**合计：5 高 + 12 中 + 7 低 = 24 项发现。2026-07-12。**
