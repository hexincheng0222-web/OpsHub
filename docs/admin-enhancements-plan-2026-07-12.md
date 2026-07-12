# 后台页面优化与功能增删计划

> **规划时间**：2026-07-12
> **范围**：`src/views/admin/**` + `src/router/index.ts` L72-98 + `src/utils/admin-dict-config.ts`
> **状态**：已审批（2026-07-12）
> **基线 Commit**：`35899ce`

---

## 审批确认

| # | 项目 | 状态 |
|---|------|------|
| 功能 1 | 楼层合并（方案 B） | ✅ 批准 |
| 功能 2 | 用户管理增强（搜索/筛选/分页） | ✅ 批准 |
| 功能 3 | 日志日期筛选 + 模块动态 | ✅ 批准 |
| 功能 4 | 操作日志保留期（30 天自动清） | ✅ 批准 |
| 功能 5 | 概览卡片可点击 + 趋势图 | ✅ 批准 |
| 功能 6 | 字典分页 + 批量删除 | ✅ 批准 |
| 功能 7 | 用户操作详情增强（新增） | ✅ 批准 |
| D1 | 删除硬编码 moduleOptions | ✅ 批准 |
| D2 | 简化 parentCards | ✅ 批准 |
| D3 | 删除 service-hosts 自动填充 | ✅ 批准 |

---

## 一、问题清单（修复优先级）

## 一、问题清单（修复优先级）

| # | 级别 | 问题 | 文件 | 方案 |
|---|------|------|------|------|
| P1 | 🔴 | 菜单命名冲突：devices/floors 与 printers/floors 都叫「楼层管理」 | `AdminView.vue` L26/L33 | 合并入口（见功能 1） |
| P2 | 🟠 | 用户表无搜索/无分页/无角色筛选，用户多时性能差 | `AdminUsers.vue` | 加搜索框 + 角色 filter + 分页（功能 2） |
| P3 | 🟠 | 操作日志无日期范围筛选，无法精确查找 | `AdminLogs.vue` | 加 el-date-picker daterange（功能 3） |
| P4 | 🟠 | 操作日志"清空"无保留期、无二次确认详情 | `AdminLogs.vue` L57-71 | 加保留期 + 确认词（功能 4） |
| P5 | 🟠 | 概览卡片不可点击、无趋势图 | `AdminOverview.vue` | 卡片跳转 + 趋势柱状图（功能 5） |
| P6 | 🟠 | 模块筛选 moduleOptions 硬编码 | `AdminLogs.vue` L17-20 | 改接口动态拉（功能 3 一起做） |
| P7 | 🟡 | 字典表全量加载无分页 | `AdminDictTable.vue` | 后端分页 + el-pagination（功能 6） |
| P8 | 🟡 | 字典表无批量操作 | `AdminDictTable.vue` | 加 selection 列 + 批量删除（功能 6） |

---

## 二、功能合并（方案 B，推荐）

### 楼层管理合并

**现状**：设备楼层（device-floors）与打印机楼层（printer-floors）字段完全一致（name + sort_order），菜单出现两个「楼层管理」。

**方案 B 实施**：前端合并入口 + DB 保持分离。

```diff
menuItems:
+ { key: 'floors', label: '楼层管理', icon: Building },
  { key: 'devices', label: '设备管理', icon: Monitor,
    children: [
-     { key: 'devices/floors', label: '楼层管理', ... }
      { key: 'devices/types', ... }
      { key: 'devices/models', ... }
    ]
  }
  { key: 'printers', label: '打印机管理', icon: Printer,
    children: [
-     { key: 'printers/floors', label: '楼层管理', ... }
      { key: 'printers/brands', ... }
      ...
    ]
  }
```

新建 `AdminFloors.vue`：
- `el-tabs` 双标签：设备楼层 / 打印机楼层
- 共享 floorConfig（name + sort_order）
- 独立校验重名（同 tab 内不允许）
- 完整 CRUD（调 createDict/updateDict/deleteDict）

```diff
router:
+ { path: 'floors', component: AdminFloors.vue }
- { path: 'devices/floors', ... }
- { path: 'printers/floors', ... }
```

**已知取舍**：数据仍分离 → 同名楼层改名不同步。业务合理：设备/打印机楼层语义可不同。

**后续可选**（Phase 2，未纳入）：DB 合并 floors 表 + 外键化（详见迁移脚本草案）。

---

## 三、其他新增功能

### 功能 2：用户管理增强

- 搜索框：用户名 / 显示名（`username` / `display_name` LIKE）
- 角色筛选下拉（全部 / 超管 / 管理员 / 普通用户）
- 后端分页：`fetchUsers({ page, pageSize, keyword, role })`
- 表格底部分页器

### 功能 3：日志日期筛选 + 模块动态化

- 加 `el-date-picker` type=daterange（起止日期）
- `moduleOptions` 改从后端接口动态拉（`GET /api/v1/admin/logs/modules`）
- 筛选项：module + dateRange + keyword 三参组合查询

### 功能 4：操作日志保留期

- 加全局常量 `LOG_RETENTION_DAYS = 30`
- 启动时自动清 30 天前日志（SQL DELETE + 日志）
- 清空按钮提示文案改为「清空全部日志（保留最近 30 天自动清理）」

### 功能 7：用户操作详情增强

**背景**：当前操作日志 `log_audit` 仅记录 module / action / target / detail / operator，缺少操作者上下文（IP、浏览器、操作结果），排查安全事件困难。

**实施**：

1. **`log_audit` 表新增字段**（`server/db.ts` 迁移）：
   ```sql
   ALTER TABLE log_audit ADD COLUMN ip_address TEXT NOT NULL DEFAULT '';
   ALTER TABLE log_audit ADD COLUMN user_agent TEXT NOT NULL DEFAULT '';
   ALTER TABLE log_audit ADD COLUMN status TEXT NOT NULL DEFAULT 'success';  -- success / fail
   ALTER TABLE log_audit ADD COLUMN error_message TEXT NOT NULL DEFAULT '';
   ALTER TABLE log_audit ADD COLUMN request_method TEXT NOT NULL DEFAULT '';  -- GET/POST/PUT/DELETE
   ALTER TABLE log_audit ADD COLUMN request_path TEXT NOT NULL DEFAULT '';
   ALTER TABLE log_audit ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0;
   ```

2. **`logOperation` 函数补全**（`server/routes/services.ts` 等处的调用点 + 新增打包函数）：
   ```ts
   // 新增统一调用函数
   export function logOperation(params: {
     module: string; action: string; target: string; detail?: string;
     operator?: string; ip?: string; userAgent?: string;
     status?: 'success' | 'fail'; errorMessage?: string;
     requestMethod?: string; requestPath?: string; durationMs?: number;
   })
   ```

3. **后端写日志点包装**（现有库存写操作处）：
   ```ts
   const start = Date.now()
   try {
     await db.prepare('INSERT ...').run(...)
     logOperation({ module: '电脑采购', action: '新增', target: model, status: 'success', durationMs: Date.now() - start, ... })
   } catch (e) {
     logOperation({ ..., status: 'fail', errorMessage: e.message })
     throw e
   }
   ```

4. **审计详情页（`AdminLogs.vue`）展示**：
   - 详情列 or 展开行新增：IP / 浏览器 / 操作结果 / 耗时 / 失败原因
   - 状态列加色标（success 绿 / fail 红）
   - 筛选加「操作结果」下拉

5. **IP / User-Agent 获取**（`server/routes/services.ts` 入口处注入）：
   ```ts
   const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
   const userAgent = req.headers['user-agent'] || ''
   ```

### 功能 5：概览页增强

- 15 个 stat-card 加 `@click` → 跳转对应字典页
- 卡片 hover 高亮 + cursor pointer
- 底部新增「近 7 天操作趋势」柱状图（纯 CSS）
- 后端新增 `GET /api/v1/admin/overview/trend?days=7`

### 功能 6：字典表通用增强

- 后端分页接口（`GET /api/v1/admin/dict/:key?page&pageSize`）
- 表格加 `el-pagination`
- 加 `type="selection"` 列
- 顶部加「批量删除」按钮 + 确认框

---

## 四、建议删除/简化

| # | 项目 | 文件 | 理由 |
|---|------|------|------|
| D1 | 硬编码 `moduleOptions` | `AdminLogs.vue` L17-20 | 功能 3 已覆盖（改接口动态） |
| D2 | `parentCards` 父级筛选逻辑（12 字典仅 4 个有父级） | `AdminDictTable.vue` L48-75 | 保留但默认隐藏，仅字典 config 显式 `showParentFilter: true` 时渲染 |
| D3 | `service-hosts.category → name` 自动填充 | `AdminDictTable.vue` L116-119 | 行为反直觉（category 选主板自动填 hostname），应删 |

---

## 五、实施阶段建议

| 阶段 | 任务 | 预估 | 价值 |
|------|------|------|------|
| **Phase 1** | 功能 1 楼层合并 | 1h | 菜单消歧 |
| **Phase 2** | 功能 5 概览卡片可点击 + 趋势 | 1.5h | 导航效率 |
| **Phase 3** | 功能 2 用户搜索/筛选/分页 | 1.5h | 用户量增长刚需 |
| **Phase 4** | 功能 3 日志日期 + 模块动态 | 1h | 排查刚需 |
| **Phase 5** | 功能 4 + 功能 7 日志详情增强 + D3 | 2h | 安全审计 + 反直觉修正 |
| **Phase 6** | 功能 6 字典分页 + 批量 | 2h | 数据量增长 |

---

## 六、关键文件改动预估

| 文件 | 改改动类型 |
|------|------------|
| `src/views/admin/AdminFloors.vue` | **新建** |
| `src/views/admin/AdminView.vue` | 修改：菜单合并 |
| `src/views/admin/AdminOverview.vue` | 修改：卡片可点击 + 趋势 |
| `src/views/admin/AdminUsers.vue` | 修改：搜索/筛选/分页 |
| `src/views/admin/AdminLogs.vue` | 修改：日期筛选 + 模块动态 + 保留期 |
| `src/views/admin/AdminDictTable.vue` | 修改：分页 + 批量 + 简化 parentCards |
| `src/router/index.ts` | 修改：新增 floors 路由 |
| `server/routes/admin.ts` | 修改：日志模块接口 + 概览趋势接口 |
| `server/db.ts` | 修改：日志保留 cron |

---

## 七、审批确认

- [x] 功能 1：楼层合并（方案 B）— **已批准**
- [x] 功能 2：用户管理增强 — **已批准**
- [x] 功能 3：日志日期筛选 + 模块动态 — **已批准**
- [x] 功能 4：操作日志保留期 — **已批准**
- [x] 功能 5：概览卡片可点击 + 趋势 — **已批准**
- [x] 功能 6：字典分页 + 批量 — **已批准**
- [x] 功能 7：用户操作详情增强 — **已批准**
- [x] D1：删除硬编码 moduleOptions — **已批准**
- [x] D2：简化 parentCards — **已批准**
- [x] D3：删除 service-hosts 自动填充 — **已批准**

> 全部批准则按 Phase 1→6 顺序实施；部分批准则仅实施勾选项。
