// scripts/sync-librenms-devices.ts — 一次性录入 22 台 LibreNMS 真实设备
// 运行：node --import tsx scripts/sync-librenms-devices.ts
// 策略：IP 已存在 → 启用监控 + 更新名称；不存在 → 新增（monitor_enabled=1）
import db from '../server/db'

// [IP, 名称, 类型]
const REAL_DEVICES: [string, string, string][] = [
  ['10.252.0.1', '核心路由器 AR2240C', 'router'],
  ['192.168.100.1', '核心交换机 S9303', 'switch'],
  ['192.168.100.254', '核心交换机 S5720-32X-EI', 'switch'],
  ['192.168.100.10', 'B1F-01 接入交换机', 'switch'],
  ['192.168.100.12', 'B1F-02 接入交换机', 'switch'],
  ['192.168.100.13', 'B1F-03 接入交换机', 'switch'],
  ['192.168.100.14', 'B1F-04 接入交换机', 'switch'],
  ['192.168.100.15', 'B1F-05 接入交换机', 'switch'],
  ['192.168.100.16', '1F 接入交换机', 'switch'],
  ['192.168.100.21', '2F 接入交换机', 'switch'],
  ['192.168.100.31', '3F-01 接入交换机', 'switch'],
  ['192.168.100.41', '4F 接入交换机', 'switch'],
  ['192.168.100.201', '1F PoE 交换机', 'switch'],
  ['192.168.100.202', '2A PoE 交换机', 'switch'],
  ['192.168.100.203', '2F PoE 交换机', 'switch'],
  ['192.168.100.204', '3F-01 PoE 交换机', 'switch'],
  ['192.168.100.205', '3F-02 PoE 交换机', 'switch'],
  ['192.168.100.206', '3A PoE 交换机', 'switch'],
  ['192.168.100.207', '3A 接入交换机', 'switch'],
  ['192.168.100.208', '1F PoE 交换机 S5735', 'switch'],
  ['192.168.100.209', '1F 网络交换机 S5730', 'switch'],
  ['192.168.100.253', '无线AC控制器 AC6005', 'router'],
]

const find = db.prepare('SELECT id, name, type FROM devices WHERE ip = ?')
// 已存在 → 更新名称/类型/型号 + 启用监控（幂等，可重复运行）
const update = db.prepare("UPDATE devices SET monitor_enabled = 1, name = ?, type = ?, model = ? WHERE id = ?")
const insert = db.prepare("INSERT INTO devices (name, type, model, u, ports, status, ip, monitor_enabled) VALUES (?, ?, ?, 1, 0, '正常', ?, 1)")

const tx = db.transaction(() => {
  for (const [ip, name, type] of REAL_DEVICES) {
    const existing = find.get(ip) as { id: number; name: string; type: string } | undefined
    if (existing) {
      const model = type === 'router' ? 'AR2240C-S' : 'S57xx'
      update.run(name, type, model, existing.id)
    } else {
      insert.run(name, type, type === 'router' ? 'AR2240C-S' : 'S57xx', ip)
    }
  }
})
tx()
const n = db.prepare('SELECT COUNT(*) c FROM devices WHERE monitor_enabled = 1').get() as { c: number }
console.log(`[sync] 完成，启用监控设备数: ${n.c}`)
