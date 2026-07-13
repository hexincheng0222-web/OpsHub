# 内网运维中心三项目优化实施报告

> **实施时间**：2026-07-11 ～ 2026-07-12
> **分支**：`hxc`
> **Commit 数**：33（自基线 4b52a14 起）
> **工作模式**：本地 dev server 端到端实测 + 子代理隔离实施 + 两阶段审查
> **涉及评审文档**：
> - `docs/services-review-2026-07-11.md` / `services-review-2026-07-11-detailed.md`
> - `docs/printers-review-2026-07-11.md`
> - `docs/log-monitor-review-2026-07-11.md`

---

## 一、总览

| 项目 | 评审项 | 实施项 | Commits | 核心收益 |
|------|--------|--------|---------|----------|
| **采购页面**（基线） | 29 | 29 | 1（打包） | 修复 3 个阻塞性编译/运行时 bug，回收站权限日志全部实测通过 |
| **服务管理**（Services） | 34 | 14 | 13 | 数据正确性 + 权限层(字段级) + 健康历史/趋势 + 凭证保险柜 + 定时巡检 + 导入导出 |
| **打印机管理**（Printers） | 16 | 11 | 11 | 撤销原子化 + 字典校验 + el-dialog 标准化 + 性能优化(memo+缓存) + 字典关联下拉 |
| **日志监控**（Log-Monitor） | 14 | 9 | 9 | Loki 查询缓存 + 智能采样 + 文件外置(7天滚动) + 异常告警推送 + 趋势看板 |
| **合计** | **93** | **63** | **34** | vue-tsc 全量 0 errors，端到端验证通过 |

关键阻塞性 bug（采购页启动即崩，已修）：
- `computed` 双重 import → 编译报错
- 筛选持久化函数在 ref 声明前访问 → TDZ 运行时错误
- 回收站 /trash 被 /:id 路由拦截 → 404（**路由顺序 bug，Express 机制**，跨平台常见）

---

## 二、服务管理（Services）

**评审点**：34 项（数据正确性 6 + 性能 3 + 前台 UX 8 + 后台 UX 5 + 安全 6 + 代码质量 6）
**实施批次**：14 个子代理任务

### 2.1 P0 安全修复

| # | 措施 | 关键技术 |
|---|------|----------|
| URL 协议校验 | 前端 `isSafeUrl` + 后端 `validateUrl` 双白名单 | 拦截 `javascript:` 等协议 |
| SSRF 黑名单 | `validateSsrfSafe` + `SSRF_BLACKLIST` 网段 | 拦截云元数据 169.254、回环 127、未指定 0.0.0.0 |

**实测**：`javascript:alert(1)` → 400；`http://169.254.169.254/x` → 400；合法 https → 201。

### 2.2 字段级权限（#28）

普通用户（role=user）：
- 顶部「添加 / 导入 / 下载导入模板」**全部隐藏**
- 表格操作列「编辑/删除」替换为「只读」标签

管理员（role=admin/superadmin）：完整写权限。

**实测**：两种角色登录对比，权限边界清晰。

### 2.3 数据正确性

- **检测状态回写**：`checkAllServices` 不再只写 checkResults，回写 `services[i].status`，卡片颜色**立即**变化（任务 2 store 修复）
- **全量加载**：`fetchAllServices(pageSize=100)` 替代默认 20 条，修复服务 >20 条时漏显示缺陷

### 2.4 健康历史（SVG 阶梯图）

纯 SVG 实现，三色阶梯（绿=在线 / 红=离线 / 橙=维护），悬浮-tooltip 显示延迟与时间；无 ECharts 依赖。抽屉详情底部展示「最近 24 小时」时序。

### 2.5 凭证保险柜

AES-256-GCM，密钥来自环境变量 `OPS_CRED_KEY`（32 字节 hex）：
- admin + 密钥配置 → 返回明文 secret
- 普通用户或密钥缺失 → 仅返回结构 + hasSecret 标记（不含明文）

### 2.6 定时巡检

独立调度器 `server/servicesScheduler.ts`（node-cron），不与 logMonitor 混用：
- 每 N 分钟巡检 → 落 `service_health_logs`
- 支持 uptime 计算（`GET /:id/uptime?days=7`)

### 2.7 导入导出

- **导出**：`src/utils/excel.ts` 已验证，535 行 × 15 列 xlsx（333KB）下载实测成功
- **导入**：「将导入 N 条记录」预览确认框（dry-run），取消不写库

---

## 三、打印机管理（Printers）

**评审点**：16 项（P0 3 + P1 7 + P2 4 + 新功能 2）
**实施批次**：11 个子代理任务

### 3.1 P0 必须修复

| # | 措施 | 实测 |
|---|------|------|
| 撤销原子化 | `POST /batch-create`（db.transaction 包裹），替代 N 台 N 次 POST | 删 5 台后撤销 → **1 次 POST** 恢复 |
| import 字典校验 | `/import` 校验 manufacturer 在 `printer_brands`，缺失可拒绝或 `autoCreateDict` 自动补录 | NoSuchBrand → 400 + errors；autoCreateDict=true → 写入成功 |
| 撤销剔除 id | `map(({ id, ...rest }) => rest)` 防止恢复时 id 冲突 | 新记录 id=90（自增，不回收旧 id） |

### 3.2 P1 关键措施

- **PUT 字段校验**：lengthLimits（floor 16 / location 255 / manufacturer 64 / model 128 / toner_model 128 / notes 10000）+ status 枚举（正常/缺墨/故障）
- **状态筛选**：toolbar「缺墨」下拉，卡片同步
- **楼层多选**：`selectedFloors: Set<string>` + Ctrl+点（保留「全部」语义）
- **el-dialog 标准化**：Teleport 自定义弹窗（~80 行 CSS）→ 标准 el-dialog；复用项目 `:deep(.el-dialog)` 样式
- **导入预览**：支持 xlsx（`parseXlsx`）+ CSV；预览表格显示后再入库，取消不写库

### 3.3 P2 性能优化

- **store 缓存**：localStorage 5min TTL，写操作后清缓存
- **buildFloorGroups memo**：按 id+status hash 缓存分组结果
- **本地化搜索**：toLowerCase + includes 双兜底（中英混合）

### 3.4 字典关联下拉（新功能）

- 厂商 / 型号 / 硒鼓下拉绑定真实数据（`manufacturers` / `modelOptions` / `allTonerModels`），去掉 `allow-create`
- 型号按厂商联动：`dictModelsByBrand[form.manufacturer]`
- 导出统一为 CSV（与导入模板格式一致）

---

## 四、日志监控（Log-Monitor）

**评审点**：14 项（P0 3 + P1 6 + P2 3 + 新功能 2）
**实施批次**：9 个子代理任务

### 4.1 P0 必须修复

| # | 措施 | 实测 |
|---|------|------|
| Dashboard 缓存 | `getCachedDevices`（5min TTL）+ `fetchLokiLogsCached`（10s TTL） | 5 秒刷新从「N+1 个 Loki 请求」→ 首次后 0 个 |
| 智能采样 | error 全保留 + warning 前 50 + 其他均匀采 100（上限 200） | LLM 收到关键错误不再被硬截断 |
| 文件外置 + 7 天滚动 | `saveAudit` 全文 → `data/log-audit/YYYY-MM-DD/*.json`，DB 仅存指针 | `SELECT AVG(LENGTH(raw_logs))=0`，`log_file_path < 60 字符` |

收益：DB 行体积从 250KB/行 → < 1KB/行；7 天清理 `rm -rf` O(1) 替代 SQL DELETE + VACUUM。

### 4.2 P1 关键措施

- **骨架屏 + 详情分页**：首次 4 个骨架，500 条日志仅渲染 50 条 + 「加载更多」
- **时间范围防抖**：`requestId` 版本号，快速切换仅最后一次生效
- **Loki 错误透传**：`{ logs, error }` 结构，卡片显示「Loki 查询失败：xxx」而非「0 条」
- **秒级调度**：`setInterval` 替代 cron（node-cron 不支持秒级），配置间隔 30 秒实测通过

### 4.3 异常告警推送（新功能）

`pushAlertIfAbnormal(device, auditId, result)` 仅当 `has_abnormal=true` 触发：
- 静默时段（跨午夜 22:00-08:00 兼容）
- 冷却期（同设备 N 分钟不重复）
- `log_alert_sent` 去重（UNIQUE(device_id, audit_id)）
- 企业微信/钉钉 webhook POST

调度器回调 + 手动分析路由双入口集成。

### 4.4 异常趋势看板（新功能）

- `GET /trend?days=7`：`SUM(has_abnormal)` + `COUNT(*)` 按 device + DATE 聚合
- 纯 CSS 柱状图组件 `TrendChart.vue`（无 ECharts）
- 异常日红色 / 正常日灰色，按异常总数降序

---

## 五、未纳入但识别的后续打磨项

以下评审点属 UX 细节或复杂重构，未纳入本阶段实施，由用户按需排期：

### 服务管理
- 健康历史保留天数可配置（当前硬编码 30 天清理 cron）
- 凭证写入表单 / 后台管理 UI（加密核心已实现，前端录入 UI 未改）

### 打印机管理
- 字典改名同步需覆盖 printer_models / toner_models（当前仅 brands）
- 跨楼层对比后导出报表
- 批量操作（批量改状态/分类）

### 日志监控
- `parseLogLevel` 改用 Loki stream labels（当前关键字匹配）
- DashboardData 类型 `analysis` 为 null 的 TS 严格模式兜底
- discoverDevices 回退路径 Loki 版本兼容性日志提示

---

## 六、验证清单

### 采购页面（11 项关键交互，详见 `docs/procurement-optimization-progress.md`）
- [x] 概览 KPI 有数（#22）
- [x] 环形图/柱状图/折线图渲染（#18/#20）
- [x] 最近记录点击 → 切 tab + 抽屉（#21）
- [x] 详情抽屉「最近变更」日志（#27）
- [x] 普通用户只读（#28）
- [x] 回收站软删除 / 恢复 / 永久删除（#29）
- [x] Excel 导入 + .xlsx 下载（#23）
- [x] 导入预览确认框（#24）
- [x] URL 持久化（#9）

### 服务管理（P0 + 关键路径）
- [x] URL / SSRF 校验（400）
- [x] 普通用户权限隐藏（前端实测）
- [x] check-all 状态立即变化
- [x] history / uptime 路由 200
- [x] credentials admin 明文 / 普通用户受限
- [x] 收藏 CRUD 200/200/200
- [x] 导入导出 end-to-end

### 打印机管理（P0 + 关键路径）
- [x] batch-create 撤销（1 次 POST）
- [x] import 字典校验（拒绝 / autoCreateDict）
- [x] PUT floor 超长 400
- [x] 撤销剔除 id（新 id=90）

### 日志监控（P0 + 关键路径）
- [x] log_file_path 列已加
- [x] GET /trend 200
- [x] GET /audit/1/logs 完整日志
- [x] import 未知厂商 400
- [x] batch-create imported:1

---

## 七、关键文件索引

| 模块 | 核心文件 |
|------|----------|
| 服务管理前端 | `src/views/ServicesView.vue` / `src/views/admin/AdminServices.vue` |
| 服务管理后端 | `server/routes/services.ts` / `src/stores/services.ts` / `src/api/services.ts` |
| 服务管理图表 | `src/components/ServiceHealthChart.vue` |
| 凭证加密 | `server/utils/crypto.ts` |
| 定时巡检 | `server/servicesScheduler.ts` |
| 打印机前端 | `src/views/PrintersView.vue` / `src/utils/printer-table-helper.ts` |
| 打印机后端 | `server/routes/printers.ts` / `src/stores/printers.ts` |
| CSV 工具 | `src/utils/printer-csv.ts` |
| 日志监控核心 | `server/logMonitor.ts` / `server/routes/log-monitor.ts` |
| 日志监控前端 | `src/views/log-monitor/LogMonitorView.vue` / `LogMonitorAudit.vue` |
| 趋势看板 | `src/components/TrendChart.vue` |
| Excel 复用工具 | `src/utils/excel.ts` |

---

## 八、附：子代理驱动开发模式

本批三项目全部采用**子代理隔离实施**：
- 每个任务 1 个独立子代理（共享上下文 + 代码行号锚点 + 关键决策提示）
- 协调者负责规格合规审查 + 质量审查（对照评审文档）
- 典型任务 1 次通过；复杂任务（如 log-monitor 任务 7 告警推送）需 2 轮交互

该模式优势：
- 子代理间零上下文污染（各自读到的文件现状互不干扰）
- 编译错误 / 路由顺序 bug 在子代理内快速定位修复
- 协调者保留全局视角，跨任务依赖（如任务 1 DB 迁移 → 任务 4 saveAudit 改造）顺序可控

损耗规避：采购页实测中提前发现 3 个阻塞性 bug（含 Express 路由顺序）后才进入服务管理 / printers 阶段，避免在子代理海中被动暴露。
