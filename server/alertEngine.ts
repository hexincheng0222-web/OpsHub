// server/alertEngine.ts — 本地自建设备告警引擎（纯同步 + SQLite）
// 由 deviceMonitor.runCollect() 每 5 分钟调用，规则判定后写入 device_alerts 表。
// 阈值存 system_config（alert_% 前缀），改配置下一轮采集生效。
import db from './db'
import type { DeviceSnapshot } from './librenms'

export type RuleType = 'cpu' | 'mem' | 'temp' | 'offline' | 'port_speed' | 'port_status'
export type Severity = 'critical' | 'warning' | 'info'

export interface PortSnap {
  ifIndex: number
  name: string
  status: 'up' | 'down'
  rxBps: number
  txBps: number
  speedBps: number | null
}

export interface AlertConfig {
  enabled: boolean
  cpuThreshold: number
  memThreshold: number
  tempThreshold: number
  offlineMinutes: number
}

const ALERT_DEFAULTS: Record<string, string> = {
  alert_enabled: 'true',
  alert_cpu_threshold: '90',
  alert_mem_threshold: '90',
  alert_temp_threshold: '75',
  alert_offline_minutes: '15',
}

/** 读取告警配置（每轮重读，改动即时生效） */
export function readAlertConfig(): AlertConfig {
  const rows = db.prepare(
    "SELECT key, value FROM system_config WHERE key LIKE 'alert_%'"
  ).all() as { key: string; value: string }[]
  const map: Record<string, string> = {}
  rows.forEach(r => { map[r.key] = r.value })

  const num = (key: string, fallback: number): number => {
    const v = parseFloat(map[key] ?? ALERT_DEFAULTS[key] ?? String(fallback))
    return isFinite(v) ? v : fallback
  }

  return {
    enabled: (map['alert_enabled'] ?? ALERT_DEFAULTS['alert_enabled']) !== 'false',
    cpuThreshold: num('alert_cpu_threshold', 90),
    memThreshold: num('alert_mem_threshold', 90),
    tempThreshold: num('alert_temp_threshold', 75),
    offlineMinutes: Math.max(1, Math.round(num('alert_offline_minutes', 15))),
  }
}

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

/** 读取设备最新一次采集的端口快照（无数据或解析失败返回空数组） */
export function getLatestPorts(deviceId: number): { ifIndex: number; name: string; status: string; speedBps: number | null }[] {
  const row = db.prepare(
    'SELECT ports_json FROM device_monitor_history WHERE device_id = ? ORDER BY id DESC LIMIT 1'
  ).get(deviceId) as { ports_json: string } | undefined
  if (!row) return []
  try { return JSON.parse(row.ports_json) } catch { return [] }
}

const upsert = db.prepare(`
  INSERT INTO device_alerts (device_id, rule_type, severity, status, target, message, detail)
  VALUES (?, ?, ?, 'active', ?, ?, ?)
  ON CONFLICT(device_id, rule_type, target) WHERE status = 'active'
  DO UPDATE SET last_seen = datetime('now'), message = excluded.message, detail = excluded.detail, severity = excluded.severity
`)

const recoverStmt = db.prepare(`
  UPDATE device_alerts SET status = 'recovered', recovered_at = datetime('now')
  WHERE device_id = ? AND rule_type = ? AND target = ? AND status = 'active'
`)

/** 触发或刷新一条活跃告警（去重键 device_id+rule_type+target） */
export function upsertActiveAlert(a: {
  deviceId: number
  ruleType: RuleType
  severity: Severity
  target: string
  message: string
  detail?: object
}): void {
  upsert.run(a.deviceId, a.ruleType, a.severity, a.target, a.message, a.detail ? JSON.stringify(a.detail) : '')
}

/** 恢复活跃告警（保留历史行，置 recovered + recovered_at） */
export function recoverAlert(deviceId: number, ruleType: RuleType, target: string): void {
  recoverStmt.run(deviceId, ruleType, target)
}

/** 速率格式化（1000 进制）：1e9 → "1 Gbps" */
export function formatSpeedBps(bps: number): string {
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps']
  let i = 0; let n = bps
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++ }
  return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

/** 阈值类告警：CPU / 内存 / 温度 ≥ 阈值触发，< 阈值恢复；null 跳过（无传感器设备） */
export function evaluateThresholdAlerts(deviceId: number, snap: DeviceSnapshot, cfg: AlertConfig): void {
  if (snap.cpuUsage != null) {
    if (snap.cpuUsage >= cfg.cpuThreshold) {
      upsertActiveAlert({
        deviceId, ruleType: 'cpu', severity: 'warning', target: '',
        message: `CPU 使用率 ${snap.cpuUsage}% 超过阈值 ${cfg.cpuThreshold}%`,
        detail: { value: snap.cpuUsage, threshold: cfg.cpuThreshold },
      })
    } else {
      recoverAlert(deviceId, 'cpu', '')
    }
  }

  if (snap.memUsage != null) {
    if (snap.memUsage >= cfg.memThreshold) {
      upsertActiveAlert({
        deviceId, ruleType: 'mem', severity: 'warning', target: '',
        message: `内存使用率 ${snap.memUsage}% 超过阈值 ${cfg.memThreshold}%`,
        detail: { value: snap.memUsage, threshold: cfg.memThreshold },
      })
    } else {
      recoverAlert(deviceId, 'mem', '')
    }
  }

  if (snap.temperature != null) {
    if (snap.temperature >= cfg.tempThreshold) {
      upsertActiveAlert({
        deviceId, ruleType: 'temp', severity: 'critical', target: '',
        message: `温度 ${snap.temperature}°C 超过阈值 ${cfg.tempThreshold}°C`,
        detail: { value: snap.temperature, threshold: cfg.tempThreshold },
      })
    } else {
      recoverAlert(deviceId, 'temp', '')
    }
  }
}

/** 端口类告警：状态翻转 + 协商速率变化（对比上一条历史 ports_json） */
export function evaluatePortAlerts(
  deviceId: number,
  prevPorts: PortSnap[],
  currPorts: PortSnap[],
  whitelist: Map<number, Map<number, string>>,
): void {
  const prevMap = new Map(prevPorts.map(p => [p.ifIndex, p]))
  const currMap = new Map(currPorts.map(p => [p.ifIndex, p]))

  // 当前存在且上一轮也存在的端口才对比
  for (const [ifIndex, curr] of currMap) {
    const prev = prevMap.get(ifIndex)
    if (!prev) continue
    const target = String(ifIndex)

    // 端口状态：up→down 建告警；down→up 恢复
    if (prev.status === 'up' && curr.status === 'down') {
      upsertActiveAlert({
        deviceId, ruleType: 'port_status', severity: 'warning', target,
        message: `端口 ${curr.name} 状态变为 down`,
        detail: { port: curr.name, from: prev.status, to: curr.status },
      })
    } else if (prev.status === 'down' && curr.status === 'up') {
      recoverAlert(deviceId, 'port_status', target)
    }

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
  }
}

/** 离线告警：按历史表新鲜度判（最近采集距今 > offlineMinutes），LibreNMS 整体失败时由调用方跳过 */
export function evaluateOfflineAlerts(monitoredIds: number[], cfg: AlertConfig): void {
  for (const id of monitoredIds) {
    const row = db.prepare(
      "SELECT MAX(collected_at) AS last_at FROM device_monitor_history WHERE device_id = ?"
    ).get(id) as { last_at: string | null }
    if (!row.last_at) continue  // 从未成功采集过，不判离线（等首次基线）

    const lastTs = new Date(row.last_at + 'Z').getTime()
    if (isNaN(lastTs)) continue
    const staleMinutes = (Date.now() - lastTs) / 60000

    if (staleMinutes > cfg.offlineMinutes) {
      upsertActiveAlert({
        deviceId: id, ruleType: 'offline', severity: 'critical', target: '',
        message: `设备 ${Math.round(staleMinutes)} 分钟无成功采集，疑似离线`,
        detail: { staleMinutes: Math.round(staleMinutes), threshold: cfg.offlineMinutes },
      })
    } else {
      recoverAlert(id, 'offline', '')
    }
  }
}
