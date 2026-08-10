# 低速端口告警豁免 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 允许管理员为指定设备的指定端口配置豁免（白名单），被豁免的端口不再产生低速端口告警；添加豁免立即生效（已有活跃告警立刻恢复），删除豁免后下一轮采集恢复告警，所有增删操作记录审计日志。

**架构：** 新增 `alert_port_whitelist` 表存豁免（device_id + if_index + if_name + reason），告警引擎 `evaluatePortAlerts` 低速判定前查白名单、命中则 `recoverAlert`（静音 + 立即恢复）。后端在 `server/routes/devices.ts` 暴露 GET/POST/DELETE 三个端点并记 `operation_logs`。前端在现有「设备告警配置」页（`DeviceAlertConfig.vue`）新增端口豁免区块（列表 + 添加弹窗）。

**技术栈：** Express + better-sqlite3、Vue 3 + Element Plus、tsx watch 热重载、node-cron 每 5 分钟采集

---

## 文件结构

| 文件 | 改动 |
|---|---|
| `server/db.ts` | 新增 `alert_port_whitelist` 表 + 唯一索引 |
| `server/alertEngine.ts` | 新增 `readPortWhitelist()`；`evaluatePortAlerts` 增加 whitelist 参数与豁免判定 |
| `server/deviceMonitor.ts` | `runCollect()` 读白名单并传入 `evaluatePortAlerts` |
| `server/routes/devices.ts` | GET/POST/DELETE 豁免端点 + 审计日志 + ifName→ifIndex 映射辅助 |
| `src/api/devices.ts` | 新增 `fetchPortWhitelist` / `addPortWhitelist` / `removePortWhitelist` / `fetchDeviceUpPorts` |
| `src/views/admin/DeviceAlertConfig.vue` | 新增端口豁免区块（列表 + 添加弹窗）|

---

### 任务 1：后端建表 `alert_port_whitelist`

**文件：**
- 修改：`server/db.ts`（在 device_alerts 建表块之后追加）

- [ ] **步骤 1：在 db.ts 追加建表代码**

在 `server/db.ts` 的 `device_alerts` 建表块（约 1614-1645 行）之后追加：

```ts
// 端口豁免白名单（低速端口告警豁免：网卡本身只有 100M 属正常的端口）
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_port_whitelist (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id  INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      if_index   INTEGER NOT NULL,
      if_name    TEXT NOT NULL,
      reason     TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_apw_device_port ON alert_port_whitelist (device_id, if_index);
  `)
} catch (e: any) { console.warn('[db] alert_port_whitelist 建表失败:', e.message) }
```

- [ ] **步骤 2：服务端类型检查 + 重启验证**

运行：`npx tsc --noEmit -p tsconfig.server.json`
预期：exit 0，无错误。

`tsx watch` 自动重启后端。确认重启后表存在：

运行：`node -e "const db=require('better-sqlite3')('data/opshub.db',{readonly:true}); console.log(db.prepare('PRAGMA table_info(alert_port_whitelist)').all().map(c=>c.name+':'+c.type).join(', '))"`
预期：`id:INTEGER, device_id:INTEGER, if_index:INTEGER, if_name:TEXT, reason:TEXT, created_at:TEXT`

- [ ] **步骤 3：Commit**

```bash
git add server/db.ts
git commit -m "feat(alert): 新增端口豁免白名单表 alert_port_whitelist"
```

---

### 任务 2：告警引擎豁免判定

**文件：**
- 修改：`server/alertEngine.ts`

- [ ] **步骤 1：新增 readPortWhitelist()**

在 `readAlertConfig()` 函数之后（约 55 行）追加：

```ts
/** 读取端口豁免白名单：device_id -> Map<ifIndex, ifName> */
export function readPortWhitelist(): Map<number, Map<number, string>> {
  const rows = db.prepare('SELECT device_id, if_index, if_name FROM alert_port_whitelist').all() as {
    device_id: number
    if_index: number
    if_name: string
  }[]
  const m = new Map<number, Map<number, string>>()
  for (const r of rows) {
    if (!m.has(r.device_id)) m.set(r.device_id, new Map())
    m.get(r.device_id)!.set(r.if_index, r.if_name)
  }
  return m
}
```

- [ ] **步骤 2：evaluatePortAlerts 增加 whitelist 参数与豁免判定**

修改 `evaluatePortAlerts` 签名（第 134 行）和低速分支（第 158-175 行）：

```ts
export function evaluatePortAlerts(
  deviceId: number,
  prevPorts: PortSnap[],
  currPorts: PortSnap[],
  whitelist: Map<number, Map<number, string>>,
): void {
```

低速分支改为：

```ts
    // 端口协商速率：up 且速率非 null 才评估；端口 down 或速率未知时恢复
    // 判定标准与前端黄色状态点一致：协商速率 < 1Gbps 即为告警
    const targetKey = `${target}:speed`
    if (curr.status === 'up' && curr.speedBps != null) {
      if (curr.speedBps < 1e9) {
        // 命中豁免白名单 → 静音：恢复该端口已有的活跃低速告警，且不再 upsert
        if (whitelist.get(deviceId)?.has(curr.ifIndex)) {
          recoverAlert(deviceId, 'port_speed', targetKey)
        } else {
          // 低于 1Gbps → 触发/刷新低速告警（恒定低速也触发，不再要求速率变化）
          const speedChanged = prev.status === 'up' && prev.speedBps != null && prev.speedBps !== curr.speedBps
          upsertActiveAlert({
            deviceId, ruleType: 'port_speed', severity: 'warning', target: targetKey,
            message: speedChanged
              ? `端口 ${curr.name} 协商速率从 ${formatSpeedBps(prev.speedBps)} 降为 ${formatSpeedBps(curr.speedBps)}`
              : `端口 ${curr.name} 协商速率 ${formatSpeedBps(curr.speedBps)}，低于 1Gbps`,
            detail: { port: curr.name, baseline: 1e9, current: curr.speedBps, changed: speedChanged },
          })
        }
      } else {
        // 速率恢复 ≥ 1Gbps → 恢复告警
        recoverAlert(deviceId, 'port_speed', targetKey)
      }
    } else {
      recoverAlert(deviceId, 'port_speed', targetKey)
    }
```

- [ ] **步骤 3：deviceMonitor.ts 传入白名单**

修改 `server/deviceMonitor.ts` 的 `runCollect()` 中调用处（第 98-99 行附近）：

在 `const cfg = readAlertConfig()`（第 92 行）旁读取白名单：

```ts
      const cfg = readAlertConfig()
      if (cfg.enabled) {
        const prevRow = db.prepare(
          'SELECT ports_json FROM device_monitor_history WHERE device_id = ? ORDER BY id DESC LIMIT 1'
        ).get(d.id) as { ports_json: string } | undefined
        evaluateThresholdAlerts(d.id, snap, cfg)
        if (prevRow?.ports_json) {
          const whitelist = readPortWhitelist()
          try { evaluatePortAlerts(d.id, JSON.parse(prevRow.ports_json) as PortSnap[], snap.ports, whitelist) } catch { /* 旧格式解析失败跳过端口告警 */ }
        }
      }
```

并在 import 中加入 `readPortWhitelist`：

```ts
import {
  evaluateOfflineAlerts, evaluatePortAlerts, evaluateThresholdAlerts,
  readAlertConfig, readPortWhitelist, type PortSnap,
} from './alertEngine'
```

- [ ] **步骤 4：服务端类型检查**

运行：`npx tsc --noEmit -p tsconfig.server.json`
预期：exit 0，无错误。

- [ ] **步骤 5：Commit**

```bash
git add server/alertEngine.ts server/deviceMonitor.ts
git commit -m "feat(alert): 低速告警豁免判定——命中白名单端口静音并恢复已有告警"
```

---

### 任务 3：后端豁免 API + 审计日志

**文件：**
- 修改：`server/routes/devices.ts`

- [ ] **步骤 1：新增辅助函数 findIfIndexByPortName**

在 `devices.ts` 顶部（`logCtx` import 之后）新增辅助函数：

```ts
/** 从设备最新 ports_json 查找 ifName → ifIndex 映射 */
function findPortIndexByName(deviceId: number, ifName: string): number | null {
  const row = db.prepare(
    'SELECT ports_json FROM device_monitor_history WHERE device_id = ? ORDER BY id DESC LIMIT 1'
  ).get(deviceId) as { ports_json: string } | undefined
  if (!row) return null
  try {
    const ports = JSON.parse(row.ports_json) as { ifIndex: number; name: string }[]
    const hit = ports.find(p => p.name === ifName)
    return hit ? hit.ifIndex : null
  } catch { return null }
}
```

- [ ] **步骤 2：新增 GET/POST/DELETE 豁免端点**

在 `devices.ts` 的 `/alerts` 路由之后（第 57 行之后）追加：

```ts
// ============ 端口豁免白名单（低速端口告警豁免） ============

// GET /api/v1/devices/alerts/port-whitelist — 豁免列表
router.get('/alerts/port-whitelist', (req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT w.id, w.device_id, w.if_index, w.if_name, w.reason, w.created_at,
             d.name AS device_name, d.ip AS device_ip
      FROM alert_port_whitelist w
      LEFT JOIN devices d ON d.id = w.device_id
      ORDER BY d.name ASC, w.if_name ASC
    `).all() as any[]
    res.json({ code: 200, data: rows })
  } catch (err: any) {
    console.error('[server] 查询端口豁免失败:', err.message)
    res.status(500).json({ code: 500, message: '查询端口豁免失败' })
  }
})

// POST /api/v1/devices/alerts/port-whitelist — 添加豁免（幂等，成功后立即恢复该端口活跃告警）
router.post('/alerts/port-whitelist', (req: Request, res: Response) => {
  try {
    const { deviceId, ifName, reason } = req.body
    const did = parseInt(String(deviceId))
    if (isNaN(did)) return res.status(400).json({ code: 400, message: 'deviceId 无效' })
    if (typeof ifName !== 'string' || !ifName.trim()) return res.status(400).json({ code: 400, message: 'ifName 不能为空' })

    const device = db.prepare('SELECT id, name FROM devices WHERE id = ?').get(did) as any
    if (!device) return res.status(404).json({ code: 404, message: '设备不存在' })

    const ifIndex = findPortIndexByName(did, ifName.trim())
    if (ifIndex == null) return res.status(400).json({ code: 400, message: '未找到该端口的采集数据，无法确定端口索引' })

    // 幂等插入
    db.prepare('INSERT OR IGNORE INTO alert_port_whitelist (device_id, if_index, if_name, reason) VALUES (?, ?, ?, ?)')
      .run(did, ifIndex, ifName.trim(), String(reason || ''))

    // 立即恢复该端口已有的活跃低速告警
    recoverAlert(did, 'port_speed', `${ifIndex}:speed`)

    logOperation({
      module: '设备告警', action: '添加端口豁免',
      target: `${device.name} ${ifName.trim()}`,
      detail: JSON.stringify({ deviceId: did, ifIndex, ifName: ifName.trim(), reason: reason || '' }),
      operator: req.user?.username || '', ...logCtx(req)
    })

    const row = db.prepare('SELECT * FROM alert_port_whitelist WHERE device_id = ? AND if_index = ?').get(did, ifIndex)
    res.json({ code: 200, data: row })
  } catch (err: any) {
    console.error('[server] 添加端口豁免失败:', err.message)
    res.status(500).json({ code: 500, message: '添加端口豁免失败' })
  }
})

// DELETE /api/v1/devices/alerts/port-whitelist/:id — 删除豁免
router.delete('/alerts/port-whitelist/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id))
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的豁免 ID' })

    const row = db.prepare(`
      SELECT w.*, d.name AS device_name FROM alert_port_whitelist w
      LEFT JOIN devices d ON d.id = w.device_id WHERE w.id = ?
    `).get(id) as any
    if (!row) return res.status(404).json({ code: 404, message: '豁免记录不存在' })

    db.prepare('DELETE FROM alert_port_whitelist WHERE id = ?').run(id)

    logOperation({
      module: '设备告警', action: '移除端口豁免',
      target: `${row.device_name || ''} ${row.if_name}`,
      detail: JSON.stringify({ deviceId: row.device_id, ifIndex: row.if_index, ifName: row.if_name }),
      operator: req.user?.username || '', ...logCtx(req)
    })
    res.status(204).send()
  } catch (err: any) {
    console.error('[server] 删除端口豁免失败:', err.message)
    res.status(500).json({ code: 500, message: '删除端口豁免失败' })
  }
})
```

- [ ] **步骤 3：import recoverAlert 与 logOperation**

更新 `devices.ts` 顶部 import（第 5 行）：

```ts
import { logOperation, logCtx } from '../logOperation'
import { recoverAlert } from '../alertEngine'
```

- [ ] **步骤 3b：新增 GET /:id/monitor/ports 端口列表端点**

在 `devices.ts` 的监控端点区块（`GET /:id/monitor/info` 之后，约第 290 行）追加，供豁免弹窗选择端口：

```ts
// GET /api/v1/devices/:id/monitor/ports — 最新采集的 up 端口列表（豁免弹窗用）
router.get('/:id/monitor/ports', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })
  const row = db.prepare(
    'SELECT ports_json FROM device_monitor_history WHERE device_id = ? ORDER BY id DESC LIMIT 1'
  ).get(id) as { ports_json: string } | undefined
  if (!row) return res.json({ code: 200, data: [] })
  try {
    const ports = JSON.parse(row.ports_json) as { name: string; status: string; speedBps: number | null }[]
    res.json({ code: 200, data: ports.filter(p => p.status === 'up').map(p => ({ name: p.name, speedBps: p.speedBps ?? null })) })
  } catch {
    res.json({ code: 200, data: [] })
  }
})
```

- [ ] **步骤 4：服务端类型检查**

运行：`npx tsc --noEmit -p tsconfig.server.json`
预期：exit 0，无错误。

- [ ] **步骤 5：接口验证（curl）**

用 Node 脚本验证三个端点（需先获取有效 token，参照 `scripts/gen_token.cjs` 用法）。先确认 token 生成方式：

运行：`ls scripts/ && head -20 scripts/gen_token.cjs`

验证 POST 添加豁免 → GET 列表出现 → DELETE 移除 → GET 列表消失，且 `operation_logs` 中 module='设备告警' 的两条记录存在。同时验证 `GET /:id/monitor/ports` 返回端口列表。

- [ ] **步骤 6：Commit**

```bash
git add server/routes/devices.ts
git commit -m "feat(alert): 端口豁免 GET/POST/DELETE API + 审计日志 + 端口列表端点"
```

---

### 任务 4：前端 API 封装

**文件：**
- 修改：`src/api/devices.ts`

- [ ] **步骤 1：新增豁免 API 函数**

在 `src/api/devices.ts` 的 `fetchDeviceAlerts`（第 147 行）之后追加：

```ts
// 端口豁免白名单
export interface PortWhitelistItem {
  id: number
  device_id: number
  device_name: string
  device_ip: string | null
  if_index: number
  if_name: string
  reason: string
  created_at: string
}

export async function fetchPortWhitelist(): Promise<PortWhitelistItem[]> {
  return request(`${BASE_DEVICES}/alerts/port-whitelist`)
}

export async function addPortWhitelist(data: { deviceId: number; ifName: string; reason?: string }): Promise<void> {
  await request(`${BASE_DEVICES}/alerts/port-whitelist`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function removePortWhitelist(id: number): Promise<void> {
  await request(`${BASE_DEVICES}/alerts/port-whitelist/${id}`, { method: 'DELETE' })
}
```

- [ ] **步骤 2：新增 fetchDeviceUpPorts**

在 `src/api/devices.ts` 追加（从最新 ports_json 读取 up 端口列表，不依赖监控开关/缓存）：

```ts
/** 读取设备最新采集到的 up 端口列表（用于豁免添加弹窗选择） */
export async function fetchDeviceUpPorts(deviceId: number): Promise<{ name: string; speedBps: number | null }[]> {
  return request(`${BASE_DEVICES}/${deviceId}/monitor/ports`)
}
```

> **说明**：该函数调用后端新增的 `GET /:id/monitor/ports` 端点（见任务 3 补充），直接从 `device_monitor_history` 最新 `ports_json` 读取，比走 snapshot 缓存更可靠——不依赖内存缓存存活、也不受监控开关影响（只要有历史采集数据即可）。

- [ ] **步骤 3：前端类型检查**

运行：`npm run typecheck:client`
预期：exit 0，无错误。

- [ ] **步骤 4：Commit**

```bash
git add src/api/devices.ts
git commit -m "feat(alert): 前端端口豁免 API 封装（列表/添加/删除/端口查询）"
```

---

### 任务 5：前端配置页豁免区块

**文件：**
- 修改：`src/views/admin/DeviceAlertConfig.vue`

- [ ] **步骤 1：新增豁免区块模板**

在 `DeviceAlertConfig.vue` 的 `</el-form>` 之后、`</div>` 之前追加豁免区块：

```html
    <el-divider content-position="left">低速端口豁免</el-divider>
    <div class="whitelist-panel" v-loading="wlLoading">
      <div class="wl-actions">
        <div class="wl-tip">豁免后，该端口协商速率低于 1Gbps 不再告警（如网卡本身只有 100M 属正常的端口）。添加即时生效，移除后下一轮采集恢复告警。</div>
        <el-button size="small" type="primary" @click="openAddDialog">+ 添加豁免</el-button>
      </div>
      <el-table :data="whitelist" size="small" style="width: 100%">
        <el-table-column prop="device_name" label="设备" min-width="140" show-overflow-tooltip />
        <el-table-column label="IP" width="140">
          <template #default="{ row }"><span class="ip-cell">{{ row.device_ip || '—' }}</span></template>
        </el-table-column>
        <el-table-column prop="if_name" label="端口" width="200" />
        <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.reason || '—' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="添加时间" width="160" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button size="small" type="danger" text @click="handleRemove(row)">移除</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无豁免配置" :image-size="50" /></template>
      </el-table>
    </div>

    <el-dialog v-model="addDialogVisible" title="添加端口豁免" width="480px">
      <el-form label-width="70px">
        <el-form-item label="设备">
          <el-select v-model="addForm.deviceId" filterable placeholder="选择设备" style="width: 100%"
            :disabled="addForm.loading" @change="onDeviceChange">
            <el-option v-for="d in devices" :key="d.id" :label="`${d.name} (${d.ip || '—'})`" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="端口">
          <el-select v-model="addForm.ifName" filterable placeholder="先选择设备" style="width: 100%" :disabled="!addForm.deviceId || portOptions.length === 0">
            <el-option v-for="p in portOptions" :key="p.name" :label="p.speedBps != null && p.speedBps < 1e9 ? `${p.name}（当前 ${Math.round(p.speedBps / 1e6)}M）` : p.name" :value="p.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="addForm.reason" placeholder="可选，如：网卡本身只有 100M" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addForm.saving" :disabled="!addForm.deviceId || !addForm.ifName" @click="handleAdd">保存</el-button>
      </template>
    </el-dialog>
```

- [ ] **步骤 2：新增脚本逻辑**

在 `DeviceAlertConfig.vue` script 中追加（import 补充 `fetchPortWhitelist, addPortWhitelist, removePortWhitelist, fetchDeviceUpPorts, fetchAllDevices`）：

```ts
// ============ 低速端口豁免 ============
const whitelist = ref<PortWhitelistItem[]>([])
const wlLoading = ref(false)
const devices = ref<{ id: number; name: string; ip: string | null }[]>([])
const addDialogVisible = ref(false)
const portOptions = ref<{ name: string; speedBps: number | null }[]>([])
const addForm = reactive({
  deviceId: null as number | null,
  ifName: '',
  reason: '',
  loading: false,
  saving: false,
})

async function loadWhitelist() {
  wlLoading.value = true
  try { whitelist.value = await fetchPortWhitelist() }
  catch (e: any) { ElMessage.error(e.message || '加载豁免列表失败') }
  finally { wlLoading.value = false }
}

async function openAddDialog() {
  addDialogVisible.value = true
  addForm.deviceId = null
  addForm.ifName = ''
  addForm.reason = ''
  portOptions.value = []
  if (devices.value.length === 0) {
    try {
      addForm.loading = true
      devices.value = (await fetchAllDevices()).map(d => ({ id: d.id, name: d.name, ip: d.ip }))
    } catch (e: any) { ElMessage.error(e.message || '加载设备失败') }
    finally { addForm.loading = false }
  }
}

async function onDeviceChange(deviceId: number) {
  addForm.ifName = ''
  portOptions.value = []
  try { portOptions.value = await fetchDeviceUpPorts(deviceId) }
  catch (e: any) { ElMessage.warning('读取端口列表失败: ' + e.message) }
}

async function handleAdd() {
  if (!addForm.deviceId || !addForm.ifName) return
  addForm.saving = true
  try {
    await addPortWhitelist({ deviceId: addForm.deviceId, ifName: addForm.ifName, reason: addForm.reason })
    ElMessage.success('豁免已添加，立即生效')
    addDialogVisible.value = false
    loadWhitelist()
  } catch (e: any) { ElMessage.error(e.message || '添加失败') }
  finally { addForm.saving = false }
}

async function handleRemove(row: PortWhitelistItem) {
  try {
    await ElMessageBox.confirm(`确定移除「${row.device_name} ${row.if_name}」的豁免？移除后该端口将恢复低速告警。`, '确认移除', { type: 'warning' })
    await removePortWhitelist(row.id)
    ElMessage.success('豁免已移除，下一轮采集恢复告警')
    loadWhitelist()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '移除失败')
  }
}

onMounted(() => {
  load()
  loadWhitelist()
})
```

- [ ] **步骤 3：补充 import**

更新 `DeviceAlertConfig.vue` 的 import：

```ts
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchConfig, saveConfig } from '../../api/admin'
import { fetchAllDevices, fetchPortWhitelist, addPortWhitelist, removePortWhitelist, fetchDeviceUpPorts, type PortWhitelistItem } from '../../api/devices'
import BackButton from '../../components/BackButton.vue'
```

- [ ] **步骤 4：补充样式**

在 `DeviceAlertConfig.vue` style 追加：

```css
.whitelist-panel { border: 1px solid var(--ops-border-card); border-radius: 8px; padding: 14px; }
.wl-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.wl-tip { font-size: 12px; color: var(--ops-text-tertiary); line-height: 1.6; }
.ip-cell { font-family: monospace; color: var(--ops-text-secondary); }
```

- [ ] **步骤 5：前端类型检查**

运行：`npm run typecheck:client`
预期：exit 0，无错误。

- [ ] **步骤 6：Commit**

```bash
git add src/views/admin/DeviceAlertConfig.vue
git commit -m "feat(alert): 设备告警配置页新增低速端口豁免区块"
```

---

### 任务 6：端到端验证

**文件：**（验证，无代码改动）

- [ ] **步骤 1：确认后端已用新代码运行**

运行：`netstat -ano | grep ":3001" | grep LISTENING`
预期：有监听。`tsx watch` 应已热重载所有改动。

- [ ] **步骤 2：浏览器验证后台配置页**

用 Playwright 打开 `http://localhost:5173/admin/devices/alerts-config`：
1. 「低速端口豁免」区块显示当前豁免列表（初始为空）
2. 点「+ 添加豁免」→ 弹窗：选设备（如「1F 网络交换机 S5730」）→ 端口下拉自动出现 up 端口（带当前速率标注）→ 填原因 → 保存
3. 列表出现该豁免条目
4. 后台操作日志页（`/admin/logs`）看到 module='设备告警' action='添加端口豁免' 记录

- [ ] **步骤 3：浏览器验证告警立即消失**

打开 `http://localhost:5173/devices` 数据中心页，确认「1F 网络交换机 S5730」的 16 条低速告警中，被豁免的端口告警消失（总数减 1）。

- [ ] **步骤 4：浏览器验证移除豁免**

回配置页移除该豁免 → 确认列表消失 → 操作日志出现 action='移除端口豁免' → 等待下一轮采集（≤5 分钟）或手动触发采集后，告警面板该端口重新出现。

- [ ] **步骤 5：验证告警引擎豁免逻辑**

运行（模拟白名单命中）：

```bash
node -e "
const db = require('better-sqlite3')('data/opshub.db', { readonly: true });
const rows = db.prepare('SELECT device_id, ports_json FROM device_monitor_history ORDER BY id DESC LIMIT 40').all();
const latest = new Map();
for (const r of rows) { if (!latest.has(r.device_id)) latest.set(r.device_id, r); }
let total = 0;
for (const [did, r] of latest) {
  const ports = JSON.parse(r.ports_json);
  total += ports.filter(p => p.status==='up' && p.speedBps!=null && p.speedBps<1e9).length;
}
console.log('当前低速端口总数:', total);
"
```

预期：输出低速端口总数，与豁免前告警数量一致（55）。

---

## 自检

**规格覆盖度：**
- 数据表 ✅ 任务 1
- 引擎豁免判定 ✅ 任务 2
- API + 审计日志 ✅ 任务 3（module='设备告警'，action 区分添加/移除，detail 含 deviceId/ifIndex/ifName/reason）
- 前端配置页 ✅ 任务 5
- 生效时序（添加立即恢复 / 删除下一轮恢复）✅ 任务 3 POST 中 recoverAlert + 任务 2 引擎 whitelist 分支
- 幂等（唯一约束 + INSERT OR IGNORE）✅ 任务 1 索引 + 任务 3 SQL

**占位符扫描：** 所有步骤均有具体代码、命令、预期输出。无 TODO/待定。

**类型一致性：**
- `evaluatePortAlerts(deviceId, prevPorts, currPorts, whitelist)` — 任务 2 定义，deviceMonitor 调用同步更新 ✅
- `readPortWhitelist(): Map<number, Map<number, string>>` — 引擎返回结构，POST 端点用 ifIndex 恢复 ✅
- 前端 `PortWhitelistItem` 字段与 GET 返回一致（id/device_id/device_name/device_ip/if_index/if_name/reason/created_at）✅
- `fetchDeviceUpPorts` 用 `fetchDeviceSnapshot` — snapshot 的 ports 含 name/status/rxBps/txBps/speedBps，需确认 MonitorSnapshot 类型含 speedBps。若缺失需在任务 4 补充。

**注意点：** 任务 4 的 `fetchDeviceUpPorts` 依赖 `fetchDeviceSnapshot` 返回的 snapshot.ports 是否含 `speedBps` 字段。若当前快照端口类型不含该字段，则只返回 name 列表（去掉 speedBps 标注），或改用独立查询。实现时先确认 `src/api/devices.ts` 中 `MonitorSnapshot` 类型定义。
