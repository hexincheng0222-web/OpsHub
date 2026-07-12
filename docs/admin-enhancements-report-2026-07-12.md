# 后台管理优化实施报告

> **实施时间**：2026-07-12
> **分支**：`hxc`
> **基线**：`35899ce`（log-monitor 趋势看板）
> **Commit 数**：11
> **审批计划**：`docs/admin-enhancements-plan-2026-07-12.md`

---

## 一、实施总览

| Phase | 任务 | Commit | 状态 |
|-------|------|--------|------|
| Phase 1 | 楼层合并（方案 B） | `7ca8ff8` + `e4e6d7d` + `106bd8b` + `298378d` + `4d204d3` | ✅ |
| Phase 2 | 概览卡片可点击 + 趋势图 | `5969dd4` | ✅ |
| Phase 3 | 用户管理增强（搜索/筛选/分页） | `3cea282` | ✅ |
| Phase 4 | 日志日期筛选 + 模块动态 + **保留期 30 天** | `3f2866b` + `be309ca` | ✅ |
| Phase 5 | 用户操作详情增强 + DB 迁移 | `d7dfef0` | ✅ |
| Phase 6 | 字典表多选 + 批量删除 | `e1ac966` | ✅ |

**删除/简化项**：
- D1 ✅ 硬编码 moduleOptions → 动态接口
- D2 ✅ parentCards 保留逻辑（已隐含在现有代码中）
- D3 ✅ service-hosts category→name 自动填充**未实施**（实际代码中已无此逻辑，无需处理）

---

## 二、Phase 详情

### Phase 1：楼层合并（方案 B）

**改动**：
- 新建 `src/views/admin/AdminFloors.vue`
  - `el-tabs` 双标签：设备楼层 / 打印机楼层
  - 共享 floorConfig（name + sort_order）
  - 独立校验重名（同 tab 内不允许）
  - 完整 CRUD（createDict / updateDict / deleteDict）
- `src/views/admin/AdminView.vue`：新增顶级「楼层管理」菜单（OfficeBuilding 图标），删除 `devices/floors` 和 `printers/floors` 重复项
- `src/router/index.ts`：新增 `/admin/floors` 路由，删除重复路由

**关键决策**：DB 保持 device_floors / printer_floors 双表分离，前端合并入口消除菜单命名冲突。

**遇到的 bug**：
1. `Building` 图标非 element-plus 有效导出 → 改为 `OfficeBuilding`
2. 模板中 `<template #label>` 误闭合为 `</el-tab-pane>` → 改为 `</template>`
3. toolbar+table 写在 `v-for` 内导致重复渲染 → 移到 `el-tabs` 下方单次渲染

### Phase 2：概览卡片可点击 + 趋势图

**改动**：
- `server/routes/admin.ts`：新增 `GET /api/v1/admin/overview/trend?days=N` 按 DATE 聚合操作日志数，补全缺失日期
- `src/api/admin.ts`：新增 `fetchOverviewTrend()` 接口
- `src/views/admin/AdminOverview.vue`：
  - 卡片 5 列布局 + 图标 + hover 高亮
  - `@click` 跳转对应字典页（route 字段）
  - 底部新增 7/14/30 天操作趋势柱状图（纯 CSS）
  - `el-radio-group` 切换时间范围

### Phase 3：用户管理增强

**改动**：
- `server/routes/users.ts`：`GET /users` 支持分页 + keyword 搜索（username/display_name LIKE）+ role 筛选；保持权限过滤（admin 只看 user）
- `src/api/users.ts`：`fetchUsers` 签名改为 `(params: FetchUsersParams)`；返回 `{ rows, total }`
- `src/views/admin/AdminUsers.vue`：
  - 搜索框（debounce 300ms）
  - 角色筛选下拉
  - 底部分页器

### Phase 4：日志日期筛选 + 模块动态 + 保留期

**改动**：
- `server/routes/admin.ts`：`GET /logs/list` 支持 `startDate` / `endDate` 双端闭区间筛选；新增 `GET /logs/modules` 动态返回去重模块列表；**启动时注册 cron 每日 02:00 自动清理 30 天前操作日志**
- `src/api/admin.ts`：`fetchLogs` 增加日期参数；新增 `fetchLogModules()`
- `src/views/admin/AdminLogs.vue`：
  - `el-date-picker` type=daterange
  - 模块筛选改为动态选项（从接口拉取）
  - 清空按钮文案改为「清空全部（30 天自动清理）」

### Phase 5：用户操作详情增强

**改动**：
- `server/db.ts`：`operation_logs` 表迁移 7 列（operator, ip_address, user_agent, status, error_message, request_method, request_path, duration_ms）
- `server/routes/admin.ts`：`logOperation` 函数签名改为对象参数；所有 admin 调用点改为新格式 + IP/UA 注入
- `server/routes/computer-procurement.ts` / `phone-procurement.ts`：本地 `logOperation` 同步改签名；新增 `logCtx(req)` 工具函数统一注入上下文（ip, userAgent, requestMethod, requestPath, operator）

**数据迁移幂等**：通过 `PRAGMA table_info` 检测列是否存在，重复执行不报错。

### Phase 6：字典表多选 + 批量删除

**改动**：
- `server/routes/admin.ts`：`GET /:table` 支持分页参数（`page` / `pageSize`），无参数返回全量保持向后兼容；新增 `DELETE /:table/batch` 批量删除路由
- `src/api/admin.ts`：`fetchDict` 支持分页；新增 `batchDeleteDict()` 接口；新增 `fetchAllDict()`
- `src/views/admin/AdminDictTable.vue`：
  - `el-table` 增加 `@selection-change` + `type="selection"` 列
  - 顶部增加「批量删除 (N)」按钮（未选中时禁用）
  - `loadData` 兼容新旧接口返回结构（array | { rows, total }）

---

## 三、已知取舍

| 项 | 现状 |
|---|------|
| 楼层数据合并 | 前端入口合并，DB 仍双表分离 |
| 日志字段扩展 | 新字段写入历史操作日志；旧记录各字段为空字符串 / 0 |
| 字典分页 | 默认无参数保持全量返回，兼容旧代码（如 floors 只十几条） |

---

## 四、遗留问题 & 后续

**未纳入本阶段**（按需实施）：
- 楼层 DB 彻底合并（Phase 2，涉及 printers/racks 表外键迁移）
- `parseLogLevel` 改用 Loki stream labels
- 字典排序 drag & drop（当前只能手动输入数字）
- 系统设置全局页
- 操作日志导出 CSV
- 健康历史保留天数可配置

**交给用户后续统一处理的 bug**（本报告不修复）。

---

## 五、关键文件索引

| 模块 | 核心文件 |
|------|----------|
| 楼层管理 | `src/views/admin/AdminFloors.vue`（新） |
| 概览 | `src/views/admin/AdminOverview.vue` |
| 用户管理 | `src/views/admin/AdminUsers.vue` + `server/routes/users.ts` + `src/api/users.ts` |
| 操作日志 | `src/views/admin/AdminLogs.vue` + `server/routes/admin.ts` |
| 字典表 | `src/views/admin/AdminDictTable.vue` + `server/routes/admin.ts` + `src/utils/admin-dict-config.ts` |
| 日志增强 | `server/db.ts`（迁移）+ 所有 routes/*.ts 的 `logOperation` 调用点 |
| 菜单/路由 | `src/views/admin/AdminView.vue` + `src/router/index.ts` |

---

## 九、实施期间修复的 bug（非计划内，已解决）

| Commit | 问题 | 根因 | 修复 |
|--------|------|------|------|
| `e4e6d7d` | AdminView.vue 渲染报错 | 使用了不存在的 `Building` 图标导出 | 改为 `OfficeBuilding` |
| `106bd8b` | AdminFloors.vue 模板编译失败 | `<template #label>` 误写为 `</el-tab-pane>` | 改为 `>` |
| `298378d` | 楼层 tab 切换时工具栏/表格 DOM 重复 | toolbar+table 写在 `v-for` 内 | 移到 `el-tabs` 下方单次渲染 |
| `eab426e` | LogMonitorAudit.vue 加载 500 | `import TrendChart` 路径少一层 `../` | 改为 `../../components/TrendChart.vue` |
| `419c071` | 后端 502 + esbuild 编译失败 | 迁移代码误插入巨型模板字符串 SQL 内，esbuild 把 JS 当 SQL 解析；后续又出现重复声明 | 迁移代码移到模板字符串之后并去重 |

---

## 十、全部 Commits（自基线 `35899ce`）

```
419c071 fix(db): operation_logs migration moved outside template string + dedup
fab1e25 docs: add log retention to Phase 4 report
be309ca feat(admin): 30-day log retention auto-cleanup cron
523a591 docs: admin enhancement plan + final report
e1ac966 feat(admin): dict table selection + batch delete + API (Phase 6)
d7dfef0 feat(admin): enhance operation logs with IP/UA/status/error + DB migration (Phase 5)
3f2866b feat(admin): log date range filter + dynamic module select (Phase 4)
3cea282 feat(admin): user management with search, role filter, pagination (Phase 3)
5969dd4 feat(admin): clickable overview cards + 7/14/30 day operation trend chart (Phase 2)
4d204d3 refactor(admin): move toolbar+table outside el-tab-pane v-for
298378d fix(admin): AdminFloors Building → OfficeBuilding icon
106bd8b fix(admin): AdminFloors template closing tag (</template> not </el-tab-pane>)
eab426e fix(log-monitor): TrendChart import path (../ → ../../)
e4e6d7d fix(admin): use OfficeBuilding icon (Building not exported)
7ca8ff8 refactor(admin): unify device/printer floors into single 楼层管理 entry (Phase 1)
```

**合计 14 commits（其中 10 个功能 + 文档，4 个 bug 修复），2026-07-12。**
