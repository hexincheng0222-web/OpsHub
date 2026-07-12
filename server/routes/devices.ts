import { Router, Request, Response } from 'express'
import db from '../db'

const router = Router()

// ============ 1. 获取设备列表 ============
router.get('/', (req: Request, res: Response) => {
  const type = req.query.type as string
  let sql = 'SELECT id, name, type, model, ip, status FROM devices'
  const params: any[] = []
  if (type) {
    sql += ' WHERE type = ?'
    params.push(type)
  }
  sql += ' ORDER BY name ASC'
  const rows = db.prepare(sql).all(...params)
  res.json({ code: 0, data: rows })
})

// ============ 7. 更新设备 ============
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })

    const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ code: 404, message: '设备不存在' })

    const { name, type, model, ports, status, ip } = req.body

    db.prepare(`
      UPDATE devices SET name = ?, type = ?, model = ?, ports = ?, status = ?, ip = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || (existing as any).name,
      type || (existing as any).type,
      model || (existing as any).model,
      ports !== undefined ? ports : (existing as any).ports,
      status || (existing as any).status,
      ip !== undefined ? ip : (existing as any).ip,
      id
    )

    const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(id)
    res.json({ code: 200, data: updated })
  } catch (err: any) {
    console.error('[server] 更新设备失败:', err.message)
    res.status(500).json({ code: 500, message: '更新设备失败' })
  }
})

// ============ 8. 删除设备 ============
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })

    const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ code: 404, message: '设备不存在' })

    // 使用事务保证原子性
    const remove = db.transaction(() => {
      db.prepare('DELETE FROM rack_slots WHERE device_id = ?').run(id)
      db.prepare('DELETE FROM devices WHERE id = ?').run(id)
    })
    remove()

    res.status(204).send()
  } catch (err: any) {
    console.error('[server] 删除设备失败:', err.message)
    res.status(500).json({ code: 500, message: '删除设备失败' })
  }
})

// ============ 9. 移动设备 ============
router.post('/:id/move', (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(req.params.id)
    if (isNaN(deviceId)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })

    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any
    if (!device) return res.status(404).json({ code: 404, message: '设备不存在' })

    const { targetRackId, targetUOffset } = req.body
    if (!targetRackId || targetUOffset === undefined) {
      return res.status(400).json({ code: 400, message: 'targetRackId 和 targetUOffset 为必填项' })
    }

    const targetRack = db.prepare('SELECT * FROM racks WHERE id = ?').get(targetRackId) as any
    if (!targetRack) return res.status(404).json({ code: 404, message: '目标机柜不存在' })

    // 查找设备当前 slot
    const currentSlot = db.prepare('SELECT * FROM rack_slots WHERE device_id = ?').get(deviceId) as any
    if (!currentSlot) return res.status(409).json({ code: 409, message: '设备未放置在任何机柜中' })

    const sourceRackId = currentSlot.rack_id
    // 优先用 currentSlot.u_size（槽位历史值）做一致性检查，回退到 device.u
    const uSize = currentSlot.u_size || device.u
    if (!uSize || uSize < 1) {
      return res.status(400).json({ code: 400, message: '设备 U 数无效，请先修正设备 u 字段' })
    }

    // 检查目标位置是否有足够空间
    const conflict = db.prepare(`
      SELECT * FROM rack_slots
      WHERE rack_id = ? AND device_id IS NOT NULL AND device_id != ?
      AND u_offset < ? AND u_offset + u_size > ?
    `).all(targetRackId, deviceId, targetUOffset + uSize, targetUOffset) as any[]

    if (conflict.length > 0) {
      return res.status(409).json({ code: 409, message: '目标位置不够' })
    }

    // 事务操作
    const move = db.transaction(() => {
      // 删除目标位置的空 slot
      db.prepare('DELETE FROM rack_slots WHERE rack_id = ? AND device_id IS NULL AND u_offset >= ? AND u_offset < ?')
        .run(targetRackId, targetUOffset, targetUOffset + uSize)

      // 更新设备 slot
      db.prepare('UPDATE rack_slots SET rack_id = ?, u_offset = ?, u_size = ? WHERE device_id = ?')
        .run(targetRackId, targetUOffset, uSize, deviceId)

      // 如果跨机柜，源柜位置填入空 slot
      if (sourceRackId !== targetRackId) {
        for (let i = currentSlot.u_offset; i < currentSlot.u_offset + currentSlot.u_size; i++) {
          db.prepare('INSERT INTO rack_slots (rack_id, device_id, u_offset, u_size) VALUES (?, NULL, ?, 1)')
            .run(sourceRackId, i)
        }
      }
    })
    move()

    // 返回更新后的两个 rack 的 slots
    const sourceSlots = db.prepare(`
      SELECT rs.u_offset, rs.u_size, rs.device_id, d.name, d.type, d.model, d.u, d.ports, d.status, d.ip
      FROM rack_slots rs LEFT JOIN devices d ON d.id = rs.device_id
      WHERE rs.rack_id = ? ORDER BY rs.u_offset
    `).all(sourceRackId)

    const targetSlots = db.prepare(`
      SELECT rs.u_offset, rs.u_size, rs.device_id, d.name, d.type, d.model, d.u, d.ports, d.status, d.ip
      FROM rack_slots rs LEFT JOIN devices d ON d.id = rs.device_id
      WHERE rs.rack_id = ? ORDER BY rs.u_offset
    `).all(targetRackId)

    res.json({
      code: 200,
      data: {
        sourceRackId,
        targetRackId,
        sourceSlots,
        targetSlots,
      },
    })
  } catch (err: any) {
    console.error('[server] 移动设备失败:', err.message)
    res.status(500).json({ code: 500, message: '移动设备失败' })
  }
})

export default router
