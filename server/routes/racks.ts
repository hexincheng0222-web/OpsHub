import { Router, Request, Response } from 'express'
import db from '../db'

const router = Router()
const FLOORS = ['-1F', '1F', '2F', '3F', '4F']

// ============ 11. 获取楼层列表 ============
router.get('/floors', (_req: Request, res: Response) => {
  res.json({ code: 200, data: { floors: FLOORS } })
})

// ============ 10. 获取统计汇总 ============
router.get('/stats', (_req: Request, res: Response) => {
  const racks = db.prepare('SELECT * FROM racks').all() as any[]
  const devices = db.prepare(`
    SELECT d.* FROM devices d
    JOIN rack_slots rs ON rs.device_id = d.id
    GROUP BY d.id
  `).all() as any[]

  const totalDevices = devices.length
  const normalDevices = devices.filter(d => d.status === '正常').length
  const offlineDevices = devices.filter(d => d.status === '停用').length

  // 按楼层统计
  const byFloor: Record<string, any> = {}
  for (const f of FLOORS) {
    const floorRacks = racks.filter(r => r.floor === f)
    const totalU = floorRacks.reduce((sum, r) => sum + r.total_u, 0)
    const usedSlots = db.prepare(`
      SELECT COUNT(*) as cnt FROM rack_slots rs
      JOIN racks r ON r.id = rs.rack_id
      WHERE r.floor = ? AND rs.device_id IS NOT NULL
    `).get(f) as any
    const usedU = usedSlots.cnt
    byFloor[f] = {
      racks: floorRacks.length,
      totalU,
      usedU,
      usage: totalU > 0 ? Math.round((usedU / totalU) * 100) : 0,
    }
  }

  // 按类型统计
  const byType: Record<string, number> = {}
  const types = ['server', 'switch', 'storage', 'router', 'firewall', 'ups', 'pdu']
  for (const t of types) {
    const cnt = db.prepare(`
      SELECT COUNT(DISTINCT d.id) as cnt FROM devices d
      JOIN rack_slots rs ON rs.device_id = d.id
      WHERE d.type = ?
    `).get(t) as any
    byType[t] = cnt.cnt
  }

  const totalU = racks.reduce((sum, r) => sum + r.total_u, 0)
  const totalUsedU = Object.values(byFloor).reduce((sum: number, f: any) => sum + f.usedU, 0)

  res.json({
    code: 200,
    data: {
      totalDevices,
      normalDevices,
      offlineDevices,
      totalRacks: racks.length,
      overallUsagePercent: totalU > 0 ? Math.round((totalUsedU / totalU) * 100) : 0,
      byFloor,
      byType,
    },
  })
})

// ============ 1. 获取所有机柜 ============
router.get('/', (req: Request, res: Response) => {
  const floor = req.query.floor as string

  let racksQuery = 'SELECT * FROM racks'
  const params: any[] = []
  if (floor) {
    racksQuery += ' WHERE floor = ?'
    params.push(floor)
  }
  racksQuery += ' ORDER BY id ASC'

  const racks = db.prepare(racksQuery).all(...params) as any[]

  const rackList = racks.map(rack => {
    const deviceCount = db.prepare(
      'SELECT COUNT(DISTINCT device_id) as cnt FROM rack_slots WHERE rack_id = ? AND device_id IS NOT NULL'
    ).get(rack.id) as any
    const usedU = db.prepare(
      'SELECT COUNT(*) as cnt FROM rack_slots WHERE rack_id = ? AND device_id IS NOT NULL'
    ).get(rack.id) as any

    return {
      id: rack.id,
      name: rack.name,
      floor: rack.floor,
      totalU: rack.total_u,
      deviceCount: deviceCount.cnt,
      usedU: usedU.cnt,
    }
  })

  // 统计
  const allDevices = db.prepare(`
    SELECT DISTINCT d.* FROM devices d JOIN rack_slots rs ON rs.device_id = d.id
  `).all() as any[]

  const stats = {
    totalDevices: allDevices.length,
    normalDevices: allDevices.filter(d => d.status === '正常').length,
    offlineDevices: allDevices.filter(d => d.status === '停用').length,
    totalRacks: racks.length,
    overallUsage: 0,
  }

  const totalU = racks.reduce((sum, r: any) => sum + r.total_u, 0)
  const totalUsedU = rackList.reduce((sum, r) => sum + r.usedU, 0)
  stats.overallUsage = totalU > 0 ? Math.round((totalUsedU / totalU) * 100) : 0

  res.json({ code: 200, data: { racks: rackList, stats } })
})

// ============ 5. 获取机柜详情（含设备布局） ============
router.get('/:rackId/slots', (req: Request, res: Response) => {
  const rackId = req.params.rackId
  const rack = db.prepare('SELECT * FROM racks WHERE id = ?').get(rackId) as any
  if (!rack) {
    return res.status(404).json({ code: 404, message: '机柜不存在' })
  }

  // 获取所有 slot，带设备信息
  const slots = db.prepare(`
    SELECT rs.u_offset, rs.u_size, rs.device_id,
           d.name, d.type, d.model, d.u, d.ports, d.status, d.ip
    FROM rack_slots rs
    LEFT JOIN devices d ON d.id = rs.device_id
    WHERE rs.rack_id = ?
    ORDER BY rs.u_offset ASC
  `).all(rackId) as any[]

  // 构建 totalU 长度的 slots 数组
  const slotMap = new Map<number, any>()
  for (const s of slots) {
    slotMap.set(s.u_offset, s)
  }

  const result = []
  for (let i = 0; i < rack.total_u; i++) {
    const s = slotMap.get(i)
    if (s && s.device_id) {
      result.push({
        uOffset: i,
        device: {
          id: s.device_id,
          name: s.name,
          type: s.type,
          model: s.model,
          u: s.u,
          ports: s.ports,
          status: s.status,
          ip: s.ip,
        },
      })
    } else {
      result.push({ uOffset: i, device: null })
    }
  }

  res.json({
    code: 200,
    data: {
      rack: { id: rack.id, name: rack.name, floor: rack.floor, totalU: rack.total_u },
      slots: result,
    },
  })
})

// ============ 2. 创建机柜 ============
router.post('/', (req: Request, res: Response) => {
  const { id, name, floor, totalU = 42 } = req.body

  if (!name) return res.status(400).json({ code: 400, message: 'name 为必填项' })
  if (!floor || !FLOORS.includes(floor)) return res.status(400).json({ code: 400, message: 'floor 必须是 ' + FLOORS.join(', ') + ' 之一' })

  const rackId = id || 'rack-' + Date.now()

  try {
    db.prepare('INSERT INTO racks (id, name, floor, total_u) VALUES (?, ?, ?, ?)').run(rackId, name, floor, totalU)

    // 生成空 slot
    const insertSlot = db.prepare('INSERT INTO rack_slots (rack_id, device_id, u_offset, u_size) VALUES (?, NULL, ?, 1)')
    const insertMany = db.transaction(() => {
      for (let i = 0; i < totalU; i++) {
        insertSlot.run(rackId, i)
      }
    })
    insertMany()

    const rack = db.prepare('SELECT * FROM racks WHERE id = ?').get(rackId)
    res.status(201).json({ code: 201, data: rack })
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ code: 409, message: '机柜 ID 已存在' })
    }
    throw err
  }
})

// ============ 3. 更新机柜 ============
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM racks WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ code: 404, message: '机柜不存在' })

  const { name, floor } = req.body
  if (!name) return res.status(400).json({ code: 400, message: 'name 为必填项' })

  db.prepare("UPDATE racks SET name = ?, floor = ?, updated_at = datetime('now') WHERE id = ?").run(name, floor || (existing as any).floor, id)

  const updated = db.prepare('SELECT * FROM racks WHERE id = ?').get(id)
  res.json({ code: 200, data: updated })
})

// ============ 4. 删除机柜 ============
router.delete('/:id', (req: Request, res: Response) => {
  const id = req.params.id
  const result = db.prepare('DELETE FROM racks WHERE id = ?').run(id)
  if (result.changes === 0) return res.status(404).json({ code: 404, message: '机柜不存在' })
  res.status(204).send()
})

// ============ 6. 添加设备到机柜 ============
router.post('/:rackId/devices', (req: Request, res: Response) => {
  const rackId = req.params.rackId
  const rack = db.prepare('SELECT * FROM racks WHERE id = ?').get(rackId) as any
  if (!rack) return res.status(404).json({ code: 404, message: '机柜不存在' })

  const { name, type, model, u = 1, uOffset, ports = 0, status = '正常', ip} = req.body

  if (!name || !type || !model || uOffset === undefined) {
    return res.status(400).json({ code: 400, message: 'name、type、model、uOffset 为必填项' })
  }

  // 检查 U 位是否可用
  const occupied = db.prepare(`
    SELECT u_offset, u_size FROM rack_slots
    WHERE rack_id = ? AND device_id IS NOT NULL
    AND u_offset < ? AND u_offset + u_size > ?
  `).all(rackId, uOffset + u, uOffset) as any[]

  if (occupied.length > 0) {
    return res.status(409).json({ code: 409, message: 'U 位被占用，无法放置' })
  }

  // 创建设备
  const devResult = db.prepare(`
    INSERT INTO devices (name, type, model, u, ports, status, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, type, model, u, ports, status, ip || null)

  const deviceId = devResult.lastInsertRowid

  // 删除目标位置的空 slot
  db.prepare('DELETE FROM rack_slots WHERE rack_id = ? AND device_id IS NULL AND u_offset >= ? AND u_offset < ?')
    .run(rackId, uOffset, uOffset + u)

  // 插入设备 slot
  db.prepare('INSERT INTO rack_slots (rack_id, device_id, u_offset, u_size) VALUES (?, ?, ?, ?)')
    .run(rackId, deviceId, uOffset, u)

  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId)
  res.status(201).json({ code: 201, data: device })
})

export default router
