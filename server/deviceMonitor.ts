// server/deviceMonitor.ts — 设备监控采集调度器（LibreNMS MySQL 轮询）
// 每 5 分钟轮询 monitor_enabled=1 且 IP 非空的设备，采集 CPU/内存/温度/端口，
// 写入 device_monitor_history 表（自存历史）+ 内存缓存（实时快照）。
// 采集间隔 5 分钟与 LibreNMS 自身 SNMP 轮询周期对齐：
//   - LibreNMS 每 5 分钟更新一次 ports.ifInOctets/ifOutOctets 累计 counter
//   - 同一周期内 octets 不变，更频繁采样只会产生「大部分 0 + 偶尔放大峰值」的失真速率
// 端口速率基于两次采样的 octets counter 差值计算（counter 翻转安全）。
import cron from 'node-cron'
import db from './db'
import { fetchHealth, fetchPorts, librenmsReady, type DeviceSnapshot } from './librenms'

// 内存缓存：实时快照（与轮询间隔一致，5 分钟过期）
const snapshotCache = new Map<number, { data: DeviceSnapshot; ts: number }>()
const CACHE_TTL_MS = 5 * 60_000

// 端口速率计算基线：device_id -> Map<ifIndex, { in, out, ts }>
const octetsBaseline = new Map<number, Map<number, { in: number; out: number; ts: number }>>()

let cronTask: ReturnType<typeof cron.schedule> | null = null
let lastRun: Date | null = null

export function startDeviceMonitor(): void {
  if (cronTask) return
  // 每 5 分钟轮询一次（与 LibreNMS 轮询周期对齐）
  cronTask = cron.schedule('*/5 * * * *', async () => { await runCollect() })
}

export function stopDeviceMonitor(): void {
  if (cronTask) { cronTask.stop(); cronTask = null }
}

export function getSchedulerStatus() {
  return { running: !!cronTask, lastRun }
}

/** 立即执行一次采集（启动预热 / 手动触发） */
export async function runCollect(): Promise<void> {
  lastRun = new Date()
  if (!librenmsReady()) return  // 未配置 MySQL，静默跳过

  const devices = db.prepare("SELECT id, ip FROM devices WHERE monitor_enabled = 1 AND ip IS NOT NULL AND ip != ''").all() as { id: number; ip: string }[]
  if (!devices.length) return

  const insert = db.prepare(
    `INSERT INTO device_monitor_history (device_id, cpu_usage, mem_used_mb, mem_total_mb, mem_usage, temperature, ports_json, collected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )

  const results = await Promise.allSettled(devices.map(async (d) => {
    try {
      const [health, ports] = await Promise.all([fetchHealth(d.ip), fetchPorts(d.ip)])
      const now = Date.now()
      const base = octetsBaseline.get(d.id) || new Map<number, { in: number; out: number; ts: number }>()

      const enriched = ports.map((p) => {
        const prev = base.get(p.ifIndex)
        let rxBps = 0, txBps = 0
        if (prev) {
          rxBps = calcRate(prev.in, p.ifInOctets, prev.ts, now)
          txBps = calcRate(prev.out, p.ifOutOctets, prev.ts, now)
        }
        base.set(p.ifIndex, { in: p.ifInOctets, out: p.ifOutOctets, ts: now })
        return { ifIndex: p.ifIndex, name: p.name, status: p.status, rxBps, txBps }
      })
      octetsBaseline.set(d.id, base)

      const snap: DeviceSnapshot = {
        cpuUsage: health.cpuUsage,
        memUsage: health.memUsage,
        memUsedMb: health.memUsedMb,
        memTotalMb: health.memTotalMb,
        temperature: health.temperature,
        ports: enriched,
        collectedAt: new Date().toISOString(),
      }

      insert.run(d.id, snap.cpuUsage, snap.memUsedMb, snap.memTotalMb, snap.memUsage, snap.temperature, JSON.stringify(snap.ports))
      snapshotCache.set(d.id, { data: snap, ts: Date.now() })
    } catch (e: any) {
      console.warn(`[device-monitor] 设备 ${d.ip} 采集失败: ${e.message}`)
      // 失败不清空旧缓存，保留上次数据
    }
  }))

  const ok = results.filter(r => r.status === 'fulfilled').length
  console.log(`[device-monitor] 采集完成 ok=${ok}/${devices.length}`)
}

/** 端口速率计算（counter 差值，秒为单位） */
function calcRate(prev: number, curr: number, prevTs: number, currTs: number): number {
  if (curr < prev) return 0  // counter 翻转
  const dt = (currTs - prevTs) / 1000
  if (dt <= 0) return 0
  return Math.max(0, Math.round((curr - prev) / dt))
}

/** 读缓存快照；无缓存或过期返回 null */
export function getDeviceSnapshot(id: number): DeviceSnapshot | null {
  const hit = snapshotCache.get(id)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data
  return null
}
