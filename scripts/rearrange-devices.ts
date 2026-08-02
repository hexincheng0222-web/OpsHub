// scripts/rearrange-devices.ts — 数据中心管理重排：移除虚拟设备，22 台真实设备摆入机柜
// 运行：node --import tsx scripts/rearrange-devices.ts
// 幂等：可重复运行
// 真实设备白名单（LibreNMS 22 台网络设备，来自 sync-librenms-devices.ts 录入）
import db from '../server/db'

const REAL_IDS = [3, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55]

// 22 台真实设备分组（按功能）：核心区 → rack-a1；楼层接入 → rack-a2；PoE+其他 → rack-b1
const LAYOUT: { rackId: string; deviceIds: number[] }[] = [
  // 核心区：路由器 AR2240C + 核心 S9303 + 核心 S5720 + 无线AC
  { rackId: 'rack-a1', deviceIds: [3, 35, 36, 55] },
  // 楼层接入 11 台：B1F×5 + 1F + 2F + 3F-01 + 4F + 3A + 1F网络
  { rackId: 'rack-a2', deviceIds: [37, 38, 39, 40, 41, 42, 43, 44, 45, 52, 54] },
  // PoE + 其他 7 台：6 台 PoE + 1F PoE S5735
  { rackId: 'rack-b1', deviceIds: [46, 47, 48, 49, 50, 51, 53] },
]

const realPh = REAL_IDS.map(() => '?').join(',')

// 1) 删除所有非真实设备（seed 虚拟设备）及其槽位
const toDelete = (db.prepare(`SELECT id FROM devices WHERE id NOT IN (${realPh})`).all(...REAL_IDS) as { id: number }[]).map(r => r.id)
if (toDelete.length) {
  const ph = toDelete.map(() => '?').join(',')
  db.prepare(`DELETE FROM rack_slots WHERE device_id IN (${ph})`).run(...toDelete)
  db.prepare(`DELETE FROM devices WHERE id IN (${ph})`).run(...toDelete)
  console.log(`[rearrange] 已移除 ${toDelete.length} 台虚拟设备及其槽位`)
} else {
  console.log('[rearrange] 无虚拟设备可移除')
}

// 2) 清理真实设备的孤儿监控历史（设备 id 不在真实白名单）
const histClean = db.prepare(`DELETE FROM device_monitor_history WHERE device_id NOT IN (${realPh})`).run(...REAL_IDS)
if (histClean.changes > 0) console.log(`[rearrange] 清理孤儿监控历史 ${histClean.changes} 条`)

// 3) 清空真实设备现有槽位（防重复运行累积），再按分组插入：每台 1U，offset 从 0 递增
db.prepare(`DELETE FROM rack_slots WHERE device_id IN (${realPh})`).run(...REAL_IDS)
const insertSlot = db.prepare('INSERT INTO rack_slots (rack_id, device_id, u_offset, u_size) VALUES (?, ?, ?, 1)')
for (const group of LAYOUT) {
  group.deviceIds.forEach((devId, i) => insertSlot.run(group.rackId, devId, i))
  console.log(`[rearrange] ${group.rackId} 放入 ${group.deviceIds.length} 台`)
}

// 4) 汇总
const total = (db.prepare('SELECT COUNT(*) c FROM devices').get() as { c: number }).c
const monitored = (db.prepare('SELECT COUNT(*) c FROM devices WHERE monitor_enabled = 1').get() as { c: number }).c
const inRack = (db.prepare('SELECT COUNT(DISTINCT device_id) c FROM rack_slots WHERE device_id IS NOT NULL').get() as { c: number }).c
console.log(`[rearrange] 完成：设备总数 ${total}，监控 ${monitored}，入柜 ${inRack}`)
