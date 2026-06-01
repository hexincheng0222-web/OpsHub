# 机柜显示优化设计规格

**日期：** 2026-06-01
**状态：** 已批准

## 背景

`DevicesView.vue` 是一个 1688 行的单文件组件，存在以下问题：
- 拖拽功能完全不可用（选择器不匹配、缺少 data 属性）
- 机柜高度固定（hardcoded 42 行），不随 U 数变化
- 设备卡片信息不全（缺少 IP、型号）
- 没有机柜统计信息
- 所有逻辑混在一个文件中，维护困难

## 设计方案：组件拆分 + 重写

### 1. 组件架构

```
src/components/devices/
├── RackCard.vue        # 机柜容器（header + U位网格 + 底座）
├── RackHeader.vue      # 机柜名称 + 楼层标签
├── RackStats.vue       # 总U / 已用U / 设备数 / 利用率进度条
├── RackGrid.vue        # U位网格（动态行数 grid-template-rows）
├── USlot.vue           # 单个U位（空位 / 设备占位）
├── DeviceCard.vue      # 设备卡片（名称、IP、型号、状态LED、U标签）
├── DeviceForm.vue      # 新增/编辑设备表单
└── useDragDrop.ts      # 拖拽 composable（鼠标事件 + 放置逻辑）

DevicesView.vue 简化为：楼层筛选 + 机柜列表 + 顶部统计面板
```

### 2. 机柜动态高度

- 每个 U 位固定高度 = 20px
- `grid-template-rows: repeat(${rack.totalU}, 20px)` 动态生成
- 42U → 840px, 24U → 480px, 12U → 240px
- U 编号倒序排列：顶部 = 最大 U 值，底部 = U1

### 3. 设备卡片（DeviceCard.vue）

- 设备类型决定左边框颜色（server=蓝, switch=绿, storage=紫, router=橙, firewall=红, ups=粉, pdu=灰）
- LED 指示灯：正常=绿色 `●`, 停用=红色 `●`
- 停用设备：半透明 + 删除线名称
- 显示信息：
  - 第一行：LED + 设备名称 + U位置标签（如 U42 或 U38-39）
  - 第二行：设备型号 · IP 地址
- 多 U 设备（u > 1）：`grid-row: span N` 跨越多个 U 位行

### 4. 机柜统计（RackStats.vue）

位于机柜头部下方，显示：
- 总容量：`42U`
- 已用 U 位：`6U`
- 设备数量：`3`
- 利用率进度条：绿色填充，宽度 = 已用/总 × 100%

### 5. 空 U 位显示

- **全部展开**，每个空 U 位都渲染
- 空 U 位样式：虚线边框 + U 编号（左侧） + hover 时显示 "+"
- 设备通过 `grid-row: span N` 跨越多个行

### 6. 拖拽系统（useDragDrop.ts）

完全重写，修复当前不可用的拖拽：

**修复要点：**
- 选择器：`.rack-container` → `.rack-card`, `.rack-title` → `.rack-name`
- 每个 `.u-slot` 添加 `data-rack-id` 和 `data-u-offset` 属性
- 通过 `el.dataset` 读取属性，不用 `textContent` 匹配

**拖拽流程：**
1. `mousedown`：记录源设备、源机柜、源 U 位
2. `mousemove`：计算鼠标下方的目标 U 位，高亮放置区域
3. `mouseup`：验证合法性 → 调用 `store.moveDevice()` 或 `store.placeDevice()`

**合法性检查：**
- 目标 U 位必须空闲（无设备占用）
- 多 U 设备的起始位置 + U 跨度不能超过机柜总 U 数
- 跨机柜移动时，自动从源机柜移除并重建 compact 数组

**交互细节：**
- 拖拽时显示半透明跟随光标（ghost）
- 有效放置区域显示绿色高亮脉冲动画
- 无效放置区域（被占用、越界）不显示高亮
- 拖拽开始时源位置变暗，释放后恢复

### 7. 机柜头部（RackHeader.vue）

- 左侧：机柜名称（粗体）
- 右侧：楼层标签（灰色背景 badge）
- 底部分隔线

### 8. 设备表单（DeviceForm.vue）

复用当前 Dialog 的功能，但作为独立组件：
- 新增设备：选择类型、填写名称/型号/IP/U位/U高度
- 编辑设备：预填当前值，修改后保存
- 删除设备：确认后删除

## 不做的事情（YAGNI）

- 不做虚拟滚动（机柜最多 42U，不需要）
- 不做搜索/过滤设备功能（后续迭代）
- 不做机柜之间批量移动设备
- 不做实时协作/多用户
- 不重写 Pinia store 数据层（保持现有接口）

## 文件变更

| 文件 | 操作 |
|------|------|
| `src/components/devices/RackCard.vue` | 新建 |
| `src/components/devices/RackHeader.vue` | 新建 |
| `src/components/devices/RackStats.vue` | 新建 |
| `src/components/devices/RackGrid.vue` | 新建 |
| `src/components/devices/USlot.vue` | 新建 |
| `src/components/devices/DeviceCard.vue` | 新建 |
| `src/components/devices/DeviceForm.vue` | 新建 |
| `src/components/devices/useDragDrop.ts` | 新建 |
| `src/views/DevicesView.vue` | 大幅简化，只保留楼层筛选和机柜列表 |
| `src/stores/devices.ts` | 可能微调（增加 moveDevice 方法） |
| `src/styles/variables.css` | 可能增加设备类型颜色变量 |
