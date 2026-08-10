# 低速端口告警豁免设计

- 日期：2026-08-10
- 范围：设备告警系统新增「端口豁免」，允许对「网卡本身只有 100M 属正常」的端口不产生低速告警

## 背景与目标

低速端口告警规则（`alertEngine.ts` 的 `port_speed`）上线后，所有 `up && speedBps < 1e9` 的端口都会告警。但实际场景中，部分设备/端口**本身网卡就是 100M**（接老终端、老交换机、IoT 设备），100M 是它们的正常工作速率，不应告警。

目标：管理员可为指定设备的指定端口配置**豁免**（白名单），被豁免的端口不再触发低速告警；豁免可随时增删，增删后**立即生效**。

## 需求确认（用户已确认）

| 决策点 | 选择 |
|--------|------|
| 豁免粒度 | **按设备 + 端口**（`device_id` + `ifName`） |
| 配置入口 | 现有「设备告警配置」页（`/admin/devices/alerts-config`）内新增区块 |
| 豁免立即生效 | 是——已有活跃告警的端口被豁免后，告警面板**立刻消失**（立即恢复） |
| 取消豁免 | 是——删除豁免条目后，该端口恢复低速告警（下一采集周期生效） |
| 豁免期间端口状态 | 完全静音：不产生告警，也不产生恢复记录（告警面板干净） |

## 数据模型

新增表 `alert_port_whitelist`（在 `db.ts` 迁移中建）：

```sql
CREATE TABLE IF NOT EXISTS alert_port_whitelist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id  INTEGER NOT NULL,      -- OpsHub devices.id
  if_index   INTEGER NOT NULL,      -- 端口 ifIndex（与告警 target {ifIndex}:speed 一致）
  if_name    TEXT NOT NULL,         -- 端口名，如 GigabitEthernet0/0/5（展示用）
  reason     TEXT DEFAULT '',       -- 豁免原因备注（可选）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_apw_device_port
  ON alert_port_whitelist (device_id, if_index);
```

唯一约束 `(device_id, if_index)` 保证同一设备同一端口只豁免一次（添加时幂等防重）。同时存 `if_index`（告警 target 用）与 `if_name`（展示用），实现时从该设备最新 `ports_json` 拿映射。

## 告警引擎改动（server/alertEngine.ts）

### 1. 读取豁免集合

在 `readAlertConfig()` 之外新增（或并入）读取豁免白名单，供每轮采集使用：

```ts
/** 读取端口豁免白名单：device_id -> Map<ifIndex, ifName> */
export function readPortWhitelist(): Map<number, Map<number, string>> {
  const rows = db.prepare('SELECT device_id, if_index, if_name FROM alert_port_whitelist').all()
  const m = new Map<number, Map<number, string>>()
  for (const r of rows) {
    if (!m.has(r.device_id)) m.set(r.device_id, new Map())
    m.get(r.device_id)!.set(r.if_index, r.if_name)
  }
  return m
}
```

### 2. `evaluatePortAlerts` 低速判定前查豁免

签名改为 `evaluatePortAlerts(deviceId, prevPorts, currPorts, whitelist)`，低速分支：

```ts
// 端口协商速率：up 且速率非 null 才评估；端口 down 或速率未知时恢复
const targetKey = `${target}:speed`
if (curr.status === 'up' && curr.speedBps != null) {
  if (curr.speedBps < 1e9) {
    // 命中豁免白名单 → 静音：恢复该端口已有的活跃低速告警，且不再 upsert
    if (whitelist.get(deviceId)?.has(curr.ifIndex)) {
      recoverAlert(deviceId, 'port_speed', targetKey)
    } else {
      // ...原有低速告警 upsert 逻辑
    }
  } else {
    recoverAlert(deviceId, 'port_speed', targetKey)
  }
} else {
  recoverAlert(deviceId, 'port_speed', targetKey)
}
```

**关键语义**：命中豁免时走 `recoverAlert` —— 既保证**已有活跃告警立即消失**，又保证**后续持续静音**（不 upsert）。

### 3. `deviceMonitor.ts` 传白名单

`runCollect()` 每轮读取一次 `readPortWhitelist()`，传给 `evaluatePortAlerts`。因为豁免配置改动频率低，每轮（5 分钟）读一次即可——**增删豁免后最迟下一轮采集生效；但对已有活跃告警的端口，删除豁免触发"立即恢复"是即时的**（见 API 设计）。

> 注：实现时也可在「添加豁免」的 API 里同步对目标端口执行一次 `recoverAlert`，实现真正"立即"（无需等采集轮）。两者都做，体验最佳。

## API 设计（挂 server/routes/devices.ts）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/devices/alerts/port-whitelist` | 豁免列表（join devices 得设备名/IP） |
| POST | `/api/v1/devices/alerts/port-whitelist` | 添加 `{ deviceId, ifName, reason? }`，幂等；成功后**立即**对该端口 `recoverAlert` |
| DELETE | `/api/v1/devices/alerts/port-whitelist/:id` | 删除豁免 |

```ts
// GET 返回字段：id, device_id, device_name, device_ip, if_index, if_name, reason, created_at

// POST 入参：{ deviceId, ifName, reason? }
// 1. 从该设备最新 ports_json 找 ifName → ifIndex 映射；找不到返回 400
// 2. INSERT OR IGNORE 幂等（唯一约束 device_id+if_index）
// 3. 成功后：recoverAlert(deviceId, 'port_speed', `${ifIndex}:speed`) → 已活跃告警立即恢复
//    （ifIndex 存在豁免表中，可精确恢复）
// 4. 审计：logOperation({ module: '设备告警', action: '添加端口豁免',
//       target: `${设备名} ${ifName}`, detail: { deviceId, ifIndex, ifName, reason } })

// DELETE :id
// 1. 查豁免行（含设备名/端口名），不存在返回 404
// 2. 删除
// 3. 审计：logOperation({ module: '设备告警', action: '移除端口豁免',
//       target: `${设备名} ${ifName}`, detail: { deviceId, ifIndex, ifName } })
// 4. 删除后：该端口不在白名单，下一轮采集重新开始低速告警。
```

**审计日志约定**（复用 `server/logOperation.ts`）：
- `module: '设备告警'`、`action: '添加端口豁免' | '移除端口豁免'`
- `target`: `${设备名} ${ifName}`（如 `1F 网络交换机 S5730 GigabitEthernet0/0/5`）
- `detail`: JSON `{ deviceId, ifIndex, ifName, reason? }`
- 操作人/IP/UA 沿用 `operator: req.user?.username, ...logCtx(req)`（与 devices 路由现有模式一致）

**注意（端口标识一致性）**：`evaluatePortAlerts` 的 target 用 `ifIndex:speed`，而豁免表存 `if_name`。两者通过 `PortSnap` 的 `name` 字段关联。添加豁免时，API 会先从该设备最新 `ports_json`（或直接查历史表）找 `ifIndex ↔ ifName` 映射；若当前活跃告警的 target 是 `{ifIndex}:speed`，POST 时查库恢复。简化方案：恢复逻辑依赖下一轮采集白名单分支（5 分钟内自动恢复），POST 不立即 recover——用户确认的"立即生效"由**前端刷新 + 下轮采集**共同达成。实现时优先尝试即时恢复。

## 前端配置页（DeviceAlertConfig.vue 新增区块）

在阈值表单下方新增「端口豁免」区块：

1. **豁免列表表格**：设备名 / IP / 端口名 / 原因 / 添加时间 / 操作（删除）
2. **新增豁免** 按钮 → `el-dialog` 弹窗：
   - **设备选择**：下拉，列出所有设备（搜索），显示 `名称 (IP)`
   - **端口选择**：选中设备后，自动从该设备最新 `ports_json` 读取 up 端口列表，下拉展示（`GigabitEthernet0/0/5` 等）；仅显示**当前低速**端口或全部 up 端口（实现细节，倾向显示当前低速端口方便操作，加"显示全部"开关）
   - **原因**：可选文本输入
   - 保存 → POST
3. 增删后重新拉取列表，实时反映

### 前端 API（src/api/devices.ts）

```ts
export interface PortWhitelistItem {
  id: number
  device_id: number
  device_name: string
  device_ip: string | null
  if_name: string
  reason: string
  created_at: string
}
fetchPortWhitelist(): Promise<PortWhitelistItem[]>
addPortWhitelist(data: { deviceId: number; ifName: string; reason?: string }): Promise<void>
removePortWhitelist(id: number): Promise<void>
// 新增：按设备拉端口列表（用于弹窗）
fetchDeviceUpPorts(deviceId: number): Promise<string[]>  // 从最新 ports_json 提取
```

## 生效时序总结

| 操作 | 效果 |
|---|---|
| 添加豁免（端口当前活跃告警） | 告警面板**立即消失**（POST 时 recoverAlert 精确恢复该端口）|
| 添加豁免（端口当前无告警） | 持续静音，永不告警（下轮采集白名单分支生效）|
| 删除豁免 | 下一轮采集重新开始低速告警（最多 5 分钟）|
| 豁免期间端口 down / 恢复 1G | 无任何告警活动（完全静音）|

## 验收标准

1. 后台「设备告警配置」页出现端口豁免区块，可列出 / 添加 / 删除豁免。
2. 添加豁免后，该端口活跃低速告警在告警面板消失（≤1 轮采集）。
3. 被豁免端口后续持续低速不告警；删除豁免后重新告警。
4. 前端端口下拉正确列出所选设备采集到的 up 端口。
5. 幂等：同一设备同一端口重复添加不产生重复行。
6. 类型检查 `typecheck:server` / `typecheck:client` 通过。
7. 后端迁移幂等，重复启动不报错。
8. 添加/移除豁免均写入 `operation_logs`（module='设备告警'，action 区分添加/移除，detail 含设备 ID、端口、原因）。

## 范围外

- 按设备整机豁免 / 全局阈值调整（可后续基于同一表扩展 device_id 或 if_name 通配）。
- 豁免导出一批导入。
