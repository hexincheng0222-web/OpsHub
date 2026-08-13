// server/librenms.ts — LibreNMS MySQL 查询客户端（只读，直连采集实时状态）
// LibreNMS REST API 不提供实时值的 JSON（/health 只返回图表列表，/ports 只返回端口名），
// 实时值存储在 LibreNMS 的 MySQL 库中（每 5 分钟轮询写入）。
// 本模块用 mysql2 直连查询 CPU/内存/温度/端口状态/累计 octets。
import mysql from 'mysql2/promise'
import db from './db'

export interface LibrenmsDbConfig {
  host: string
  port: number
  user: string
  pass: string
  name: string
}

export function getLibrenmsDbConfig(): LibrenmsDbConfig {
  const rows = db.prepare("SELECT key, value FROM system_config WHERE key IN ('librenms_db_host','librenms_db_port','librenms_db_user','librenms_db_pass','librenms_db_name')").all() as { key: string; value: string }[]
  const map: Record<string, string> = {}
  rows.forEach(r => { map[r.key] = r.value })
  return {
    host: map['librenms_db_host'] || process.env.LIBRENMS_DB_HOST || '10.3.0.141',
    port: parseInt(map['librenms_db_port'] || process.env.LIBRENMS_DB_PORT || '3306', 10) || 3306,
    user: map['librenms_db_user'] || process.env.LIBRENMS_DB_USER || '',
    pass: map['librenms_db_pass'] || process.env.LIBRENMS_DB_PASS || '',
    name: map['librenms_db_name'] || process.env.LIBRENMS_DB_NAME || 'librenms',
  }
}

/** 是否已配置 MySQL 账号（未配置则监控功能禁用） */
export function librenmsReady(): boolean {
  const cfg = getLibrenmsDbConfig()
  return !!(cfg.user && cfg.pass)
}

let pool: mysql.Pool | null = null

function getPool(): mysql.Pool {
  if (!pool) {
    const cfg = getLibrenmsDbConfig()
    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.pass,
      database: cfg.name,
      connectionLimit: 2,
      connectTimeout: 5000,
      charset: 'utf8mb4',
    })
  }
  return pool
}

/** 重置连接池（配置变更后调用，让下次请求用新配置） */
export function resetLibrenmsPool(): void {
  if (pool) { pool.end().catch(() => {}); pool = null }
}

async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params)
  return rows as T[]
}

export interface HealthData {
  cpuUsage: number | null
  memUsage: number | null
  memUsedMb: number | null
  memTotalMb: number | null
  temperature: number | null
}

export interface PortData {
  ifIndex: number
  name: string
  status: 'up' | 'down'
  ifInOctets: number
  ifOutOctets: number
  /** 端口速率能力（bit/s，如 1G=1e9、10G=1e10）；虚拟口/未上报可能为 0 或 null */
  ifSpeed: number | null
}

export interface DeviceSnapshot {
  cpuUsage: number | null
  memUsage: number | null
  memUsedMb: number | null
  memTotalMb: number | null
  temperature: number | null
  totalRxBps: number
  totalTxBps: number
  ports: Array<{ ifIndex: number; name: string; status: 'up' | 'down'; rxBps: number; txBps: number; speedBps: number | null }>
  collectedAt: string
}

/** 查询单个设备的实时健康值（CPU/内存/温度） */
export async function fetchHealth(host: string): Promise<HealthData> {
  const procs = await query<{ processor_usage: number | null }>(
    `SELECT p.processor_usage FROM processors p
     JOIN devices d ON d.device_id = p.device_id WHERE d.hostname = ?`,
    [host]
  )
  const mems = await query<{ mempool_used: number | null; mempool_total: number | null; mempool_perc: number | null }>(
    `SELECT m.mempool_used, m.mempool_total, m.mempool_perc FROM mempools m
     JOIN devices d ON d.device_id = m.device_id WHERE d.hostname = ?`,
    [host]
  )
  const temps = await query<{ sensor_current: number | null }>(
    `SELECT s.sensor_current FROM sensors s
     JOIN devices d ON d.device_id = s.device_id
     WHERE d.hostname = ? AND s.sensor_class = 'temperature'`,
    [host]
  )

  // CPU：多个 processor 取平均
  const cpuVals = procs.map(p => p.processor_usage).filter((v): v is number => v != null)
  const cpuUsage = cpuVals.length ? Math.round(cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length * 10) / 10 : null

  // 内存：取第一个 mempool
  let memUsage: number | null = null
  let memUsedMb: number | null = null
  let memTotalMb: number | null = null
  if (mems.length) {
    const m = mems[0]
    memUsedMb = m.mempool_used != null ? Math.round(m.mempool_used / 1048576 * 10) / 10 : null  // 字节→MB
    memTotalMb = m.mempool_total != null ? Math.round(m.mempool_total / 1048576 * 10) / 10 : null
    if (m.mempool_perc != null) memUsage = m.mempool_perc
    else if (memUsedMb != null && memTotalMb && memTotalMb > 0) memUsage = Math.round(memUsedMb / memTotalMb * 1000) / 10
  }

  // 温度：取第一个 temperature sensor
  const tempVals = temps.map(t => t.sensor_current).filter((v): v is number => v != null)
  const temperature = tempVals.length ? tempVals[0] : null

  return { cpuUsage, memUsage, memUsedMb, memTotalMb, temperature }
}

/** 查询单个设备的端口状态 + 累计 octets（counter，用于速率差值计算）+ 速率能力 */
export async function fetchPorts(host: string): Promise<PortData[]> {
  const rows = await query<{ ifIndex: number; ifName: string; ifOperStatus: string; ifInOctets: number | null; ifOutOctets: number | null; ifSpeed: number | null }>(
    `SELECT p.ifIndex, p.ifName, p.ifOperStatus, p.ifInOctets, p.ifOutOctets, p.ifSpeed FROM ports p
     JOIN devices d ON d.device_id = p.device_id WHERE d.hostname = ? ORDER BY p.ifIndex ASC`,
    [host]
  )
  return rows.map(r => ({
    ifIndex: r.ifIndex,
    name: r.ifName || `if${r.ifIndex}`,
    status: r.ifOperStatus === 'up' ? 'up' as const : 'down' as const,
    ifInOctets: r.ifInOctets ?? 0,
    ifOutOctets: r.ifOutOctets ?? 0,
    ifSpeed: r.ifSpeed != null && r.ifSpeed > 0 ? r.ifSpeed : null,
  }))
}

export interface DeviceInfo {
  uptime: number | null
  os: string | null
  version: string | null
  hardware: string | null
  sysDescr: string | null
  location: string | null
  lastPolled: string | null
}

/** 查询单个设备的静态信息（uptime/os/version/hardware 等），LibreNMS 查无此设备返回 null */
export async function fetchDeviceInfo(host: string): Promise<DeviceInfo | null> {
  // 用 SELECT * 取整行再按列名安全取，避免对列名做假设
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM devices WHERE hostname = ? LIMIT 1',
    [host]
  )
  if (!rows.length) return null
  const r = rows[0]
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null)
  const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null)
  return {
    uptime: num(r['uptime']),
    os: str(r['os']),
    version: str(r['version']),
    hardware: str(r['hardware']),
    sysDescr: str(r['sysDescr']),
    location: str(r['location']),
    lastPolled: str(r['last_polled']),
  }
}

/** 探测某 IP 是否在 LibreNMS 中存在 */
export async function checkDeviceExists(host: string): Promise<boolean> {
  const rows = await query<{ cnt: number }>('SELECT COUNT(*) cnt FROM devices WHERE hostname = ?', [host])
  return rows.length > 0 && rows[0].cnt > 0
}

/** 关闭连接池（优雅关闭时调用） */
export async function closeLibrenms(): Promise<void> {
  if (pool) { await pool.end().catch(() => {}); pool = null }
}
