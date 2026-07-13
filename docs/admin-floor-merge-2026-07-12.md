# 楼层管理合并方案（已实施）

> **决策时间**：2026-07-12
> **实施 commit**：`b391760`
> **方案**：B — 前端合并入口，DB 保持分离

---

## 背景

设备楼层（`device_floors` 表 + `printers.device_floor` 字段）与打印机楼层（`printer_floors` 表 + `printers.floor` 字段）字段完全一致（name + sort_order），但后台菜单出现两个同名的「楼层管理」，用户无法区分。

## 备选方案对比

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A（DB 彻底合并）** | 新建全局 floors 表，双表改外键 | 唯一真相源 | printers/devices/racks 三张表 + 12+ 组件全改，回归面大 |
| **B（前端合并）**✅ 已选 | 单一「楼层管理」入口 + el-tabs 切换设备/打印机楼层 | DB 零改动、菜单立即消歧、为后续 DB 合并打基础 | 数据仍分离，同名楼层改了一边另一边不联动 |
| **C（视图抽象）** | DB 合并但保留原表为 View | 查询兼容 | SQLite 视图不可写，需 trigger，复杂度反升 |

## 已实施改动

1. **新建 `src/views/admin/AdminFloors.vue`**
   - `el-tabs` 双标签页：设备楼层 / 打印机楼层
   - 共享同一 floorConfig（name + sort_order）
   - 独立校验重名（duplicateName computed，同 tab 内不允许重复）
   - 新增/编辑/删除完整 CRUD（调通用 `createDict/updateDict/deleteDict`）

2. **更新 `src/views/admin/AdminView.vue`**
   - 新增顶级菜单「楼层管理」（Building 图标）
   - 移除 `devices/floors` 和 `printers/floors` 子菜单项
   - devices 子菜单剩：设备类型、设备型号库
   - printers 子菜单剩：品牌管理、型号管理、墨粉型号

3. **更新 `src/router/index.ts`**
   - 新增 `{ path: 'floors', component: AdminFloors.vue }`
   - 删除 `devices/floors` 与 `printers/floors` 两条重复路由

## 已知取舍

数据仍分离 → 把设备楼层"3F"改名为"3F 东"时，打印机楼层那条"3F"不会自动同步。

**业务合理性**：实际场景中设备楼层与打印机楼层本就允许不同（如"医疗设备层"只放设备、"文印层"只放打印机）。

## 后续可选（Phase 2，未实施）

若未来确认要做 DB 合并，推荐迁移路径：

```sql
-- 1. 新建全局楼层表
CREATE TABLE floors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'shared',  -- 'device' | 'printer' | 'shared'
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 2. 数据合并（同名楼层 type='shared'）
INSERT OR IGNORE INTO floors (name, sort_order, type)
SELECT name, sort_order, 'device' FROM device_floors;
INSERT OR IGNORE INTO floors (name, sort_order, type)
SELECT name, sort_order, 'printer' FROM printer_floors
ON CONFLICT(name) DO UPDATE SET type='shared';

-- 3. 应用层把 printers.floor / devices.floor 改为关联 floors.id（外键化）
-- 4. 废弃 device_floors / printer_floors 表（保留列但不再写入，向后兼容）
```

> Phase 2 建议在项目节奏slow时再实施，当前优先保功能交付。

## 验证

- 导航到顶级「楼层管理」 → 默认显示设备楼层列表
- 切换「打印机楼层」 tab → 显示打印机楼层列表
- 新增楼层「测试层」 → 校验重名通过 → 写入成功
- 编辑/删除操作正常
- vue-tsc 编译 0 errors

---

## 相关文件

- `src/views/admin/AdminFloors.vue`（新建）
- `src/views/admin/AdminView.vue`（修改：菜单合并）
- `src/router/index.ts`（修改：新增 floors 路由，删除重复）
- `server/db.ts`（未改动，device_floors / printer_floors 保留）
- `server/routes/services.ts`（未改动，字典 CRUD 通用路由照常用于 floors）
