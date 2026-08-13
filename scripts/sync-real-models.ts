// scripts/sync-real-models.ts — 从 LibreNMS 同步真实硬件型号到本地设备 + 型号库
// 运行：node --import tsx scripts/sync-real-models.ts
// 流程：对每台启用了监控且有 IP 的设备，查 LibreNMS 拿 hardware（即真实型号），
//      更新 devices.model；型号不在 device_models 则录入（type_key=本地 device.type）。
//      同步完成后防御性清理假型号 S57xx。幂等，可重复运行。
// 注意：db.ts 不加载 dotenv，本脚本必须自行加载，否则 LibreNMS MySQL 凭据读不到。
import 'dotenv/config'
import db from '../server/db'
import { fetchDeviceInfo, fetchPorts } from '../server/librenms'

// 华为型号前缀（S 交换机 / AR 路由 / AC 无线 / NE 核心路由 / CE 框式 / X 未知）
const HUAWEI_PREFIX = /^(S|AR|AC|NE|CE|X)\d/i
function inferManufacturer(model: string): string {
  return HUAWEI_PREFIX.test(model) ? '华为' : ''
}

const findModel = db.prepare('SELECT id FROM device_models WHERE name = ?')
const insertModel = db.prepare(
  `INSERT INTO device_models (name, type_key, manufacturer, u_size, ports, power_watts, description, sort_order)
   VALUES (?, ?, ?, ?, ?, 0, '从 LibreNMS 自动同步', 0)`
)
const updateDeviceModel = db.prepare("UPDATE devices SET model = ?, updated_at = datetime('now') WHERE id = ?")

async function main(): Promise<void> {
  const devices = db.prepare(
    "SELECT id, name, ip, type, model, u, ports FROM devices WHERE monitor_enabled = 1 AND ip IS NOT NULL AND ip != ''"
  ).all() as { id: number; name: string; ip: string; type: string; model: string; u: number | null; ports: number | null }[]

  console.log(`[sync] 待同步设备: ${devices.length} 台`)
  if (!devices.length) return

  // 先全量并行拉取（异步网络调用，不能放进 better-sqlite3 同步事务）
  const fetched = await Promise.allSettled(devices.map(async (d) => {
    const info = await fetchDeviceInfo(d.ip)
    const portCount = await fetchPorts(d.ip).then(p => p.length).catch(() => 0)
    return { device: d, hardware: info?.hardware?.trim() || '', portCount }
  }))

  let ok = 0, skipped = 0, failed = 0, newModels = 0
  const failedList: string[] = []

  const tx = db.transaction(() => {
    for (const r of fetched) {
      if (r.status === 'rejected') {
        failed++; failedList.push(r.reason?.message || '网络异常')
        continue
      }
      const { device, hardware, portCount } = r.value
      if (!hardware) { skipped++; continue }

      updateDeviceModel.run(hardware, device.id)
      ok++
      // 型号库：name UNIQUE，存在则跳过（幂等）
      if (!findModel.get(hardware)) {
        insertModel.run(
          hardware,
          device.type,
          inferManufacturer(hardware),
          device.u || 1,
          portCount || device.ports || 0
        )
        newModels++
      }
    }
    // 防御性清理假型号（devices.model 无 FK，删除无副作用；正常 changes=0）
    db.prepare("DELETE FROM device_models WHERE name = 'S57xx'").run()
  })
  tx()

  // 校验残留
  const remainDev = (db.prepare("SELECT COUNT(*) c FROM devices WHERE model LIKE '%S57xx%'").get() as any).c
  const remainModel = (db.prepare("SELECT COUNT(*) c FROM device_models WHERE name = 'S57xx'").get() as any).c

  console.log(`[sync] 完成：同步 ${ok}/${devices.length} 台，跳过 ${skipped}，失败 ${failed}，型号库新增 ${newModels}`)
  if (failedList.length) console.log(`[sync] 失败原因: ${failedList.join(' | ')}`)
  if (remainDev) console.warn(`[sync] ⚠️ 仍有 ${remainDev} 台设备 model 含 S57xx，请人工核查`)
  if (remainModel) console.warn(`[sync] ⚠️ 型号库仍有 S57xx，请人工核查`)
  else console.log('[sync] 校验通过：无 S57xx 残留')

  // 抽查 3 台关键设备
  for (const ip of ['10.252.0.1', '192.168.100.254', '192.168.100.253']) {
    const row = db.prepare('SELECT name, model FROM devices WHERE ip = ?').get(ip) as any
    console.log(`[sync] 抽查 ${ip} → ${row ? row.name + ' / ' + row.model : '不存在'}`)
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('[sync] 执行失败:', e.message)
  process.exit(1)
})
