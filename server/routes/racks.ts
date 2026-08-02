import { Router, Request, Response } from 'express'
import db from '../db'
import { logOperation, logCtx } from '../logOperation'

const router = Router()

// 从数据库读取楼层列表
function getFloors(): string[] {
  const rows = db.prepare('SELECT name FROM device_floors ORDER BY sort_order ASC, id ASC').all() as { name: string }[]
  return rows.length > 0 ? rows.map(r => r.name) : ['-1F', '1F', '2F', '3F', '4F']
}

// ============ 11. 获取楼层列表 ============
router.get('/floors', (_req: Request, res: Response) => {
  res.json({ code: 200, data: { floors: getFloors() } })
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

  // 一次性查询所有楼层的已用 U 位数
  const floorUsedU = db.prepare(`
    SELECT r.floor, COUNT(*) as cnt FROM rack_slots rs
    JOIN racks r ON r.id = rs.rack_id
    WHERE rs.device_id IS NOT NULL
    GROUP BY r.floor
  `).all() as any[]
  const floorUsedMap: Record<string, number> = {}
  for (const row of floorUsedU) floorUsedMap[row.floor] = row.cnt

  // 一次性查询所有类型的设备数
  const typeRows = db.prepare(`
    SELECT d.type, COUNT(DISTINCT d.id) as cnt FROM devices d
    JOIN rack_slots rs ON rs.device_id = d.id
    GROUP BY d.type
  `).all() as any[]
  const byType: Record<string, number> = { server: 0, switch: 0, storage: 0, router: 0, firewall: 0, ups: 0, pdu: 0 }
  for (const row of typeRows) byType[row.type] = row.cnt

  // 按楼层统计
  const byFloor: Record<string, any> = {}
  for (const f of getFloors()) {
    const floorRacks = racks.filter(r => r.floor === f)
    const totalU = floorRacks.reduce((sum, r) => sum + r.total_u, 0)
    const usedU = floorUsedMap[f] || 0
    byFloor[f] = {
      racks: floorRacks.length,
      totalU,
      usedU,
      usage: totalU > 0 ? Math.round((usedU / totalU) * 100) : 0,
    }
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

// ============ 1. 获取所有机柜（可选包含设备布局） ============
router.get('/', (req: Request, res: Response) => {
  const floor = req.query.floor as string
  const includeDevices = req.query.include_devices === 'true'

  let racksQuery = 'SELECT * FROM racks'
  const params: any[] = []
  if (floor) {
    racksQuery += ' WHERE floor = ?'
    params.push(floor)
  }
  racksQuery += ' ORDER BY id ASC'

  const racks = db.prepare(racksQuery).all(...params) as any[]

  // 一次性查询所有机柜的设备数和已用 U 位
  const slotStats = db.prepare(`
    SELECT rack_id,
           COUNT(DISTINCT device_id) as deviceCount,
           COUNT(*) as usedU
    FROM rack_slots
    WHERE device_id IS NOT NULL
    GROUP BY rack_id
  `).all() as any[]
  const slotStatsMap: Record<string, { deviceCount: number; usedU: number }> = {}
  for (const row of slotStats) slotStatsMap[row.rack_id] = { deviceCount: row.deviceCount, usedU: row.usedU }

  // 可选：一次性获取所有 slot 和设备布局
  let allSlotsMap: Record<string, any[]> = {}
  if (includeDevices) {
    const allSlots = db.prepare(`
      SELECT rs.rack_id, rs.u_offset, rs.u_size, rs.device_id,
             d.name, d.type, d.model, d.u, d.ports, d.status, d.ip, d.monitor_enabled
      FROM rack_slots rs
      LEFT JOIN devices d ON d.id = rs.device_id
      ORDER BY rs.u_offset ASC
    `).all() as any[]

    for (const s of allSlots) {
      if (!allSlotsMap[s.rack_id]) allSlotsMap[s.rack_id] = []
      allSlotsMap[s.rack_id].push(s)
    }
  }

  const rackList = racks.map(rack => {
    const stats = slotStatsMap[rack.id] || { deviceCount: 0, usedU: 0 }
    const item: any = {
      id: rack.id,
      name: rack.name,
      floor: rack.floor,
      totalU: rack.total_u,
      deviceCount: stats.deviceCount,
      usedU: stats.usedU,
    }

    if (includeDevices) {
      const slots = allSlotsMap[rack.id] || []
      const slotMap = new Map<number, any>()
      for (const s of slots) {
        slotMap.set(s.u_offset, s)
      }
      const devices: (any | null)[] = []
      for (let i = 0; i < rack.total_u; i++) {
        const s = slotMap.get(i)
        if (s && s.device_id) {
          devices.push({ id: s.device_id, name: s.name, type: s.type, model: s.model, u: s.u, ports: s.ports, status: s.status, ip: s.ip, monitorEnabled: !!s.monitor_enabled })
          if (s.u_size > 1) i += s.u_size - 1 // skip spanned U slots
        } else {
          devices.push(null)
        }
      }
      item.devices = devices
    }

    return item
  })

  // 统计：一次性查询设备状态分布
  const statusCounts = db.prepare(`
    SELECT d.status, COUNT(DISTINCT d.id) as cnt FROM devices d
    JOIN rack_slots rs ON rs.device_id = d.id
    GROUP BY d.status
  `).all() as any[]

  let normalDevices = 0
  let totalDevices = 0
  for (const row of statusCounts) {
    totalDevices += row.cnt
    if (row.status === '正常') normalDevices = row.cnt
  }

  const stats = {
    totalDevices,
    normalDevices,
    offlineDevices: totalDevices - normalDevices,
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
  if (!floor || !getFloors().includes(floor)) return res.status(400).json({ code: 400, message: 'floor 必须是已配置的楼层之一' })
  if (!Number.isInteger(totalU) || totalU < 1 || totalU > 50) return res.status(400).json({ code: 400, message: 'totalU 必须为 1-50 的整数' })

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
    logOperation({ module: '机柜', action: '新增', target: name, detail: JSON.stringify({ floor, totalU }), operator: req.user?.username || '', ...logCtx(req) })
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
  try {
    const id = req.params.id
    const existing = db.prepare('SELECT * FROM racks WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ code: 404, message: '机柜不存在' })

    const { name, floor } = req.body
    if (!name) return res.status(400).json({ code: 400, message: 'name 为必填项' })

    db.prepare("UPDATE racks SET name = ?, floor = ?, updated_at = datetime('now') WHERE id = ?").run(name, floor || (existing as any).floor, id)

    const updated = db.prepare('SELECT * FROM racks WHERE id = ?').get(id)
    logOperation({ module: '机柜', action: '修改', target: (existing as any).name, detail: JSON.stringify({ name, floor }), operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, data: updated })
  } catch (err: any) {
    console.error('[server] 更新机柜失败:', err.message)
    res.status(500).json({ code: 500, message: '更新机柜失败' })
  }
})

// ============ 4. 删除机柜 ============
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const existing = db.prepare('SELECT name FROM racks WHERE id = ?').get(id) as { name: string } | undefined
    const result = db.prepare('DELETE FROM racks WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ code: 404, message: '机柜不存在' })
    logOperation({ module: '机柜', action: '删除', target: existing?.name || `ID:${id}`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
    res.status(204).send()
  } catch (err: any) {
    console.error('[server] 删除机柜失败:', err.message)
    res.status(500).json({ code: 500, message: '删除机柜失败' })
  }
})

// ============ 6. 添加设备到机柜 ============
router.post('/:rackId/devices', (req: Request, res: Response) => {
  try {
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

    // 使用事务保证设备创建和 slot 操作的原子性
    const addDevice = db.transaction(() => {
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

      return deviceId
    })

    const deviceId = addDevice()
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId)
    logOperation({ module: '机柜', action: '添加设备', target: name, detail: JSON.stringify({ rack: rackId, uOffset, u }), operator: req.user?.username || '', ...logCtx(req) })
    res.status(201).json({ code: 201, data: device })
  } catch (err: any) {
    console.error('[server] 添加设备到机柜失败:', err.message)
    res.status(500).json({ code: 500, message: '添加设备失败' })
  }
})

export default router
