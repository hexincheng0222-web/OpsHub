// server/routes/topology.ts — 网络拓扑（节点 + 连线），本地自建数据
import { Router, Request, Response } from 'express'
import db from '../db'
import { logOperation, logCtx } from '../logOperation'

const router = Router()

function parseCoord(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isFinite(n) ? Math.max(0, Math.min(10000, n)) : fallback
}

/** 节点查询：join 设备信息 + 类型缩写/颜色 */
const NODE_SELECT = `
  SELECT tn.device_id, tn.x, tn.y,
         d.name, d.type, d.model, d.status, d.ip, d.monitor_enabled,
         dt.abbr, dt.color
  FROM topology_nodes tn
  JOIN devices d ON d.id = tn.device_id
  LEFT JOIN device_types dt ON dt.key = d.type
`

// ============ GET /api/v1/topology — 一次拉全量 ============
router.get('/', (req: Request, res: Response) => {
  try {
    const nodes = db.prepare(NODE_SELECT + ' ORDER BY tn.device_id').all()
    const edges = db.prepare(`
      SELECT e.id, e.source_device_id, sd.name AS source_device_name, e.source_port,
             e.target_device_id, td.name AS target_device_name, e.target_port, e.protocol
      FROM topology_edges e
      JOIN devices sd ON sd.id = e.source_device_id
      JOIN devices td ON td.id = e.target_device_id
      ORDER BY e.id
    `).all()
    res.json({ code: 200, data: { nodes, edges } })
  } catch (err: any) {
    console.error('[topology] 查询失败:', err.message)
    res.status(500).json({ code: 500, message: '查询拓扑失败' })
  }
})

// ============ POST /api/v1/topology/nodes — 添加设备到画布 ============
router.post('/nodes', (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(String(req.body?.device_id))
    if (isNaN(deviceId)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })

    const device = db.prepare('SELECT id, name FROM devices WHERE id = ?').get(deviceId) as any
    if (!device) return res.status(404).json({ code: 404, message: '设备不存在' })

    const exists = db.prepare('SELECT device_id FROM topology_nodes WHERE device_id = ?').get(deviceId)
    if (exists) return res.status(409).json({ code: 409, message: '设备已在画布上' })

    const x = parseCoord(req.body?.x, 0)
    const y = parseCoord(req.body?.y, 0)
    db.prepare('INSERT INTO topology_nodes (device_id, x, y) VALUES (?, ?, ?)').run(deviceId, x, y)

    const node = db.prepare(NODE_SELECT + ' WHERE tn.device_id = ?').get(deviceId)
    logOperation({ module: '拓扑', action: '添加节点', target: device.name, detail: JSON.stringify({ deviceId }), operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, data: node })
  } catch (err: any) {
    console.error('[topology] 添加节点失败:', err.message)
    res.status(500).json({ code: 500, message: '添加节点失败' })
  }
})

// ============ PUT /api/v1/topology/nodes/:deviceId — 保存单个节点位置 ============
router.put('/nodes/:deviceId', (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(String(req.params.deviceId))
    if (isNaN(deviceId)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })

    const exists = db.prepare('SELECT device_id FROM topology_nodes WHERE device_id = ?').get(deviceId)
    if (!exists) return res.status(404).json({ code: 404, message: '节点不存在' })

    const x = parseCoord(req.body?.x, 0)
    const y = parseCoord(req.body?.y, 0)
    db.prepare('UPDATE topology_nodes SET x = ?, y = ?, updated_at = datetime(\'now\') WHERE device_id = ?').run(x, y, deviceId)
    res.json({ code: 200, data: { device_id: deviceId, x, y } })
  } catch (err: any) {
    console.error('[topology] 更新节点失败:', err.message)
    res.status(500).json({ code: 500, message: '更新节点失败' })
  }
})

// ============ PUT /api/v1/topology/nodes — 批量保存位置（自动布局用） ============
router.put('/nodes', (req: Request, res: Response) => {
  try {
    const list = Array.isArray(req.body?.nodes) ? req.body.nodes : []
    if (!list.length) return res.status(400).json({ code: 400, message: 'nodes 不能为空' })

    const upd = db.prepare("UPDATE topology_nodes SET x = ?, y = ?, updated_at = datetime('now') WHERE device_id = ?")
    const tx = db.transaction((items: { device_id: number; x: number; y: number }[]) => {
      for (const it of items) {
        const deviceId = parseInt(String(it.device_id))
        if (isNaN(deviceId)) continue
        upd.run(parseCoord(it.x, 0), parseCoord(it.y, 0), deviceId)
      }
    })
    tx(list)
    res.json({ code: 200, data: { updated: list.length } })
  } catch (err: any) {
    console.error('[topology] 批量更新节点失败:', err.message)
    res.status(500).json({ code: 500, message: '批量更新节点失败' })
  }
})

// ============ DELETE /api/v1/topology/nodes/:deviceId — 移除节点（显式级联删连线） ============
router.delete('/nodes/:deviceId', (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(String(req.params.deviceId))
    if (isNaN(deviceId)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })

    const node = db.prepare('SELECT device_id FROM topology_nodes WHERE device_id = ?').get(deviceId) as any
    if (!node) return res.status(404).json({ code: 404, message: '节点不存在' })

    // 显式删除与该节点相关的连线（edges 外键指向 devices，删节点不会自动级联）
    const edgeCount = db.prepare(
      'SELECT COUNT(*) c FROM topology_edges WHERE source_device_id = ? OR target_device_id = ?'
    ).get(deviceId, deviceId) as { c: number }
    db.prepare('DELETE FROM topology_edges WHERE source_device_id = ? OR target_device_id = ?').run(deviceId, deviceId)
    db.prepare('DELETE FROM topology_nodes WHERE device_id = ?').run(deviceId)

    const name = (db.prepare('SELECT name FROM devices WHERE id = ?').get(deviceId) as any)?.name || ''
    logOperation({ module: '拓扑', action: '移除节点', target: name, detail: JSON.stringify({ deviceId, edgesRemoved: edgeCount.c }), operator: req.user?.username || '', ...logCtx(req) })
    res.status(204).send()
  } catch (err: any) {
    console.error('[topology] 移除节点失败:', err.message)
    res.status(500).json({ code: 500, message: '移除节点失败' })
  }
})

// ============ POST /api/v1/topology/edges — 添加连线 ============
router.post('/edges', (req: Request, res: Response) => {
  try {
    let sourceDeviceId = parseInt(String(req.body?.source_device_id))
    let targetDeviceId = parseInt(String(req.body?.target_device_id))
    let sourcePort = String(req.body?.source_port ?? '').trim()
    let targetPort = String(req.body?.target_port ?? '').trim()
    const protocol = String(req.body?.protocol ?? '').trim()

    if (isNaN(sourceDeviceId) || isNaN(targetDeviceId)) return res.status(400).json({ code: 400, message: '无效的设备 ID' })
    if (sourceDeviceId === targetDeviceId) return res.status(400).json({ code: 400, message: '不能连接同一台设备' })
    if (!sourcePort || !targetPort) return res.status(400).json({ code: 400, message: '两端端口不能为空' })
    if (sourcePort.length > 128 || targetPort.length > 128) return res.status(400).json({ code: 400, message: '端口名过长' })

    // 校验两端设备存在且在画布上
    for (const id of [sourceDeviceId, targetDeviceId]) {
      const dev = db.prepare('SELECT id FROM devices WHERE id = ?').get(id)
      if (!dev) return res.status(404).json({ code: 404, message: `设备 ${id} 不存在` })
      const onCanvas = db.prepare('SELECT device_id FROM topology_nodes WHERE device_id = ?').get(id)
      if (!onCanvas) return res.status(400).json({ code: 400, message: '请先把设备添加到画布' })
    }

    // 方向归一化：device_id 小的一端作为 source（端口随设备走）
    if (sourceDeviceId > targetDeviceId) {
      const tmpId = sourceDeviceId; sourceDeviceId = targetDeviceId; targetDeviceId = tmpId
      const tmpPort = sourcePort; sourcePort = targetPort; targetPort = tmpPort
    }

    try {
      db.prepare(
        'INSERT INTO topology_edges (source_device_id, source_port, target_device_id, target_port, protocol) VALUES (?, ?, ?, ?, ?)'
      ).run(sourceDeviceId, sourcePort, targetDeviceId, targetPort, protocol)
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ code: 409, message: '该连接已存在' })
      throw e
    }

    const edge = db.prepare(`
      SELECT e.id, e.source_device_id, sd.name AS source_device_name, e.source_port,
             e.target_device_id, td.name AS target_device_name, e.target_port, e.protocol
      FROM topology_edges e
      JOIN devices sd ON sd.id = e.source_device_id
      JOIN devices td ON td.id = e.target_device_id
      WHERE e.id = last_insert_rowid()
    `).get()
    logOperation({ module: '拓扑', action: '添加连线', target: `${sourcePort} ↔ ${targetPort}`, detail: JSON.stringify({ sourceDeviceId, targetDeviceId }), operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, data: edge })
  } catch (err: any) {
    console.error('[topology] 添加连线失败:', err.message)
    res.status(500).json({ code: 500, message: '添加连线失败' })
  }
})

// ============ DELETE /api/v1/topology/edges/:id — 删除连线 ============
router.delete('/edges/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id))
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的连线 ID' })

    const edge = db.prepare('SELECT id FROM topology_edges WHERE id = ?').get(id) as any
    if (!edge) return res.status(404).json({ code: 404, message: '连线不存在' })

    db.prepare('DELETE FROM topology_edges WHERE id = ?').run(id)
    logOperation({ module: '拓扑', action: '删除连线', target: `#${id}`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
    res.status(204).send()
  } catch (err: any) {
    console.error('[topology] 删除连线失败:', err.message)
    res.status(500).json({ code: 500, message: '删除连线失败' })
  }
})

export default router
