import { Router, Request, Response } from 'express'
import db from '../db'

const router = Router()

// ========== 通用 CRUD 工厂 ==========

interface TableConfig {
  table: string
  columns: string[]       // 可写入的列
  listColumns: string     // 列表查询列
  module: string          // 操作日志模块名
  foreignKey?: { table: string; column: string; ref: string }
}

const tables: Record<string, TableConfig> = {
  'device-floors': {
    table: 'device_floors',
    columns: ['name', 'sort_order'],
    listColumns: 'id, name, sort_order, created_at, updated_at',
    module: '设备楼层',
  },
  'device-types': {
    table: 'device_types',
    columns: ['key', 'name', 'abbr', 'icon', 'color', 'sort_order'],
    listColumns: 'id, key, name, abbr, icon, color, sort_order, created_at, updated_at',
    module: '设备类型',
  },
  'device-models': {
    table: 'device_models',
    columns: ['name', 'type_key', 'manufacturer', 'u_size', 'ports', 'power_watts', 'description', 'sort_order'],
    listColumns: 'id, name, type_key, manufacturer, u_size, ports, power_watts, description, sort_order, created_at, updated_at',
    module: '设备型号',
  },
  'printer-brands': {
    table: 'printer_brands',
    columns: ['name', 'sort_order'],
    listColumns: 'id, name, sort_order, created_at, updated_at',
    module: '打印机品牌',
  },
  'printer-floors': {
    table: 'printer_floors',
    columns: ['name', 'sort_order'],
    listColumns: 'id, name, sort_order, created_at, updated_at',
    module: '打印机楼层',
  },
  'printer-models': {
    table: 'printer_models',
    columns: ['brand_id', 'name', 'sort_order'],
    listColumns: 'id, brand_id, name, sort_order, created_at, updated_at',
    module: '打印机型号',
    foreignKey: { table: 'printer_brands', column: 'brand_id', ref: 'brand' },
  },
  'toner-models': {
    table: 'toner_models',
    columns: ['name', 'brand_id', 'compatible', 'sort_order'],
    listColumns: 'id, name, brand_id, compatible, sort_order, created_at, updated_at',
    module: '墨粉型号',
  },
  'service-categories': {
    table: 'service_categories',
    columns: ['name', 'icon', 'color', 'sort_order'],
    listColumns: 'id, name, icon, color, sort_order, created_at, updated_at',
    module: '服务分类',
  },
  'service-hosts': {
    table: 'service_hosts',
    columns: ['name', 'ip', 'os', 'description', 'sort_order', 'device_id'],
    listColumns: 'id, name, ip, os, description, sort_order, device_id, created_at, updated_at',
    module: '服务主机',
  },
  'procurement-departments': {
    table: 'procurement_departments',
    columns: ['name', 'sort_order'],
    listColumns: 'id, name, sort_order, created_at, updated_at',
    module: '采购部门',
  },
  'procurement-handlers': {
    table: 'procurement_handlers',
    columns: ['name', 'sort_order'],
    listColumns: 'id, name, sort_order, created_at, updated_at',
    module: '采购经手人',
  },
  'phone-brands': {
    table: 'phone_brands',
    columns: ['name', 'sort_order'],
    listColumns: 'id, name, sort_order, created_at, updated_at',
    module: '手机品牌',
  },
  'phone-models': {
    table: 'phone_models',
    columns: ['brand_id', 'name', 'sort_order'],
    listColumns: 'id, brand_id, name, sort_order, created_at, updated_at',
    module: '手机型号',
    foreignKey: { table: 'phone_brands', column: 'brand_id', ref: 'brand' },
  },
  'computer-purchase-models': {
    table: 'computer_purchase_models',
    columns: ['name', 'sort_order'],
    listColumns: 'id, name, sort_order, created_at, updated_at',
    module: '电脑采购型号',
  },
  'computer-device-models': {
    table: 'computer_device_models',
    columns: ['purchase_model_id', 'name', 'sort_order'],
    listColumns: 'id, purchase_model_id, name, sort_order, created_at, updated_at',
    module: '电脑设备型号',
  },
}

// 记录操作日志
function logOperation(module: string, action: string, target: string, detail: string = '') {
  db.prepare(
    'INSERT INTO operation_logs (module, action, target, detail) VALUES (?, ?, ?, ?)'
  ).run(module, action, target, detail)
}

// ========== 系统配置（必须在 /:table 之前） ==========

// GET /api/v1/admin/config/list — 获取所有配置项
router.get('/config/list', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT key, value, description, updated_at FROM system_config ORDER BY key').all()
  res.json({ code: 200, data: rows })
})

// GET /api/v1/admin/config/:key — 获取单个配置项
router.get('/config/:key', (req: Request, res: Response) => {
  const row = db.prepare('SELECT key, value, description FROM system_config WHERE key = ?').get(req.params.key)
  if (!row) return res.status(404).json({ code: 404, message: '配置项不存在' })
  res.json({ code: 200, data: row })
})

// PUT /api/v1/admin/config — 更新配置（批量或单个）
router.put('/config', (req: Request, res: Response) => {
  const configs = req.body.configs as Array<{ key: string; value: string }>
  if (!Array.isArray(configs) || configs.length === 0) {
    return res.status(400).json({ code: 400, message: '缺少 configs 数组' })
  }

  const update = db.prepare("UPDATE system_config SET value = ?, updated_at = datetime('now') WHERE key = ?")
  const insert = db.prepare("INSERT OR REPLACE INTO system_config (key, value, description, updated_at) VALUES (?, ?, '', datetime('now'))")

  const tx = db.transaction(() => {
    for (const cfg of configs) {
      const existing = db.prepare('SELECT key FROM system_config WHERE key = ?').get(cfg.key)
      if (existing) {
        update.run(cfg.value, cfg.key)
      } else {
        insert.run(cfg.key, cfg.value)
      }
    }
  })
  tx()

  logOperation('系统配置', '修改', configs.map(c => c.key).join(', '), JSON.stringify(configs))
  res.json({ code: 200, message: '配置已保存' })
})

// ========== 通用 CRUD（/:table 路由） ==========

// GET /api/v1/admin/:table  — 列表
router.get('/:table', (req: Request, res: Response) => {
  const config = tables[req.params.table]
  if (!config) return res.status(404).json({ code: 404, message: '未知表' })

  const rows = db.prepare(`SELECT ${config.listColumns} FROM ${config.table} ORDER BY sort_order ASC, id ASC`).all()
  res.json({ code: 200, data: rows })
})

// POST /api/v1/admin/:table  — 新增
router.post('/:table', (req: Request, res: Response) => {
  const config = tables[req.params.table]
  if (!config) return res.status(404).json({ code: 404, message: '未知表' })

  const cols = config.columns.filter(c => req.body[c] !== undefined)
  if (cols.length === 0) return res.status(400).json({ code: 400, message: '缺少必填字段' })

  const placeholders = cols.map(() => '?').join(', ')
  const values = cols.map(c => req.body[c])

  try {
    const result = db.prepare(`INSERT INTO ${config.table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...values)
    const row = db.prepare(`SELECT ${config.listColumns} FROM ${config.table} WHERE id = ?`).get(result.lastInsertRowid)
    logOperation(config.module, '新增', String(req.body.name || ''), JSON.stringify(req.body))
    res.status(201).json({ code: 201, data: row })
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ code: 409, message: '名称已存在' })
    }
    if (err.message?.includes('FOREIGN KEY')) {
      return res.status(409).json({ code: 409, message: '引用的关联数据不存在' })
    }
    res.status(500).json({ code: 500, message: err.message })
  }
})

// PUT /api/v1/admin/:table/:id  — 修改
router.put('/:table/:id', (req: Request, res: Response) => {
  const config = tables[req.params.table]
  if (!config) return res.status(404).json({ code: 404, message: '未知表' })

  const cols = config.columns.filter(c => req.body[c] !== undefined)
  if (cols.length === 0) return res.status(400).json({ code: 400, message: '缺少要更新的字段' })

  const setClauses = cols.map(c => `${c} = ?`).join(', ')
  const values = [...cols.map(c => req.body[c]), req.params.id]

  try {
    db.prepare(`UPDATE ${config.table} SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).run(...values)
    const row = db.prepare(`SELECT ${config.listColumns} FROM ${config.table} WHERE id = ?`).get(req.params.id)
    logOperation(config.module, '修改', String(req.body.name || `ID:${req.params.id}`), JSON.stringify(req.body))
    res.json({ code: 200, data: row })
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ code: 409, message: '名称已存在' })
    }
    res.status(500).json({ code: 500, message: err.message })
  }
})

// DELETE /api/v1/admin/:table/:id  — 删除
router.delete('/:table/:id', (req: Request, res: Response) => {
  const config = tables[req.params.table]
  if (!config) return res.status(404).json({ code: 404, message: '未知表' })

  const existing = db.prepare(`SELECT name FROM ${config.table} WHERE id = ?`).get(req.params.id) as { name: string } | undefined
  if (!existing) return res.status(404).json({ code: 404, message: '记录不存在' })

  try {
    db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(req.params.id)
    logOperation(config.module, '删除', existing.name)
    res.status(204).send()
  } catch (err: any) {
    if (err.message?.includes('FOREIGN KEY')) {
      return res.status(409).json({ code: 409, message: '该记录被其他数据引用，无法删除' })
    }
    res.status(500).json({ code: 500, message: err.message })
  }
})

// ========== 操作日志 ==========

// GET /api/v1/admin/logs/list  — 日志列表
router.get('/logs/list', (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1
  const pageSize = parseInt(req.query.pageSize as string) || 20
  const module_ = req.query.module as string
  const offset = (page - 1) * pageSize

  let where = ''
  const params: any[] = []
  if (module_) {
    where = 'WHERE module = ?'
    params.push(module_)
  }

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM operation_logs ${where}`).get(...params) as { cnt: number }).cnt
  const rows = db.prepare(
    `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset)

  res.json({ code: 200, data: { rows, total, page, pageSize } })
})

// DELETE /api/v1/admin/logs/clear  — 清空日志
router.delete('/logs/clear', (_req: Request, res: Response) => {
  db.prepare('DELETE FROM operation_logs').run()
  logOperation('系统', '清空日志', '所有操作日志')
  res.json({ code: 200, message: '日志已清空' })
})

// ========== 概览统计 ==========

// GET /api/v1/admin/overview  — 各模块数据统计
router.get('/overview/stats', (_req: Request, res: Response) => {
  const cnt = (table: string) => (db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number }).cnt
  const stats = {
    deviceFloors: cnt('device_floors'),
    deviceTypes: cnt('device_types'),
    deviceModels: cnt('device_models'),
    printerFloors: cnt('printer_floors'),
    printerBrands: cnt('printer_brands'),
    printerModels: cnt('printer_models'),
    tonerModels: cnt('toner_models'),
    serviceCategories: cnt('service_categories'),
    serviceHosts: cnt('service_hosts'),
    procurementDepartments: cnt('procurement_departments'),
    procurementHandlers: cnt('procurement_handlers'),
    phoneBrands: cnt('phone_brands'),
    phoneModels: cnt('phone_models'),
    computerPurchaseModels: cnt('computer_purchase_models'),
    computerDeviceModels: cnt('computer_device_models'),
    totalLogs: cnt('operation_logs'),
    recentLogs: db.prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 10').all(),
  }
  res.json({ code: 200, data: stats })
})

export default router
