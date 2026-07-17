import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import db from '../db'

const router = Router()

/**
 * 操作日志脱敏 (#24)
 * 遮蔽敏感键（password/token/secret/key/api_key/passphrase），防止凭据明文落库
 */
const SENSITIVE_KEYS = /^(password|passwd|token|secret|key|api_key|apikey|passphrase|credential)$/i
function sanitizeDetail(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    safe[k] = SENSITIVE_KEYS.test(k) ? '***' : v
  }
  return JSON.stringify(safe)
}

// ========== 通用 CRUD 工厂 ==========

interface TableConfig {
  table: string
  columns: string[]       // 可写入的列
  listColumns: string     // 列表查询列
  module: string          // 操作日志模块名
  foreignKey?: { table: string; column: string; ref: string }
  nameColumn?: string     // 用于日志显示的“名称”字段，默认 name
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
    columns: ['name', 'ip', 'os', 'description', 'sort_order', 'category'],
    listColumns: 'id, name, ip, os, description, sort_order, category, created_at, updated_at',
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
  'computer-models': {
    table: 'computer_models',
    columns: ['name', 'sort_order'],
    listColumns: 'id, name, sort_order, created_at, updated_at',
    module: '电脑型号',
  },
  'phone-remarks': {
    table: 'phone_remarks',
    columns: ['extension', 'remark'],
    listColumns: 'id, extension, remark, created_at, updated_at',
    module: '话机备注',
    nameColumn: 'extension',
  },
  'phone-locations': {
    table: 'phone_locations',
    columns: ['extension', 'location', 'notes', 'sort_order'],
    listColumns: 'id, extension, location, notes, sort_order, created_at, updated_at',
    module: '话机位置',
    nameColumn: 'extension',
  },
}

// 记录操作日志（增强：IP / UA / 状态 / 错误 / 请求方法 / 路径 / 耗时）
function logOperation(params: {
  module: string
  action: string
  target: string
  detail?: string
  operator?: string
  ip?: string
  userAgent?: string
  status?: 'success' | 'fail'
  errorMessage?: string
  requestMethod?: string
  requestPath?: string
  durationMs?: number
}) {
  db.prepare(
    `INSERT INTO operation_logs (module, action, target, detail, operator, ip_address, user_agent, status, error_message, request_method, request_path, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.module, params.action, params.target, params.detail || '', params.operator || '',
    params.ip || '', params.userAgent || '', params.status || 'success',
    params.errorMessage || '', params.requestMethod || '', params.requestPath || '', params.durationMs || 0
  )
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

  logOperation({ module: '系统配置', action: '修改', target: configs.map(c => c.key).join(', '), detail: sanitizeDetail(configs), operator: req.user?.username || '', ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress, userAgent: req.headers['user-agent'] as string, requestMethod: req.method, requestPath: req.path })
  res.json({ code: 200, message: '配置已保存' })
})

// ========== 通用 CRUD（/:table 路由） ==========

// GET /api/v1/admin/:table  — 列表（支持分页）
router.get('/:table', (req: Request, res: Response) => {
  const config = tables[req.params.table]
  if (!config) return res.status(404).json({ code: 404, message: '未知表' })

  const hasPage = req.query.page !== undefined
  const hasPageSize = req.query.pageSize !== undefined

  // 无分页参数 → 返回全量（向后兼容）
  if (!hasPage && !hasPageSize) {
    const rows = db.prepare(`SELECT ${config.listColumns} FROM ${config.table} ORDER BY sort_order ASC, id ASC`).all()
    return res.json({ code: 200, data: rows })
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 20))

  const offset = (page - 1) * pageSize
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM ${config.table}`).get() as { cnt: number }).cnt
  const rows = db.prepare(`SELECT ${config.listColumns} FROM ${config.table} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`).all(pageSize, offset)
  res.json({ code: 200, data: { rows, total, page, pageSize } })
})

// DELETE /api/v1/admin/:table/batch  — 批量删除
router.delete('/:table/batch', (req: Request, res: Response) => {
  const config = tables[req.params.table]
  if (!config) return res.status(404).json({ code: 404, message: '未知表' })
  const { ids } = req.body
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ code: 400, message: 'ids 必填' })
  const ph = ids.map(() => '?').join(',')
  try {
    const n = db.prepare(`DELETE FROM ${config.table} WHERE id IN (${ph})`).run(...ids)
    logOperation({ module: config.module, action: '批量删除', target: `${ids.length} 条记录`, detail: '', operator: req.user?.username || '', ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress, userAgent: req.headers['user-agent'] as string, requestMethod: req.method, requestPath: req.path })
    res.json({ code: 200, message: `已删除 ${n.changes} 条` })
  } catch (err: any) {
    if (err.message?.includes('FOREIGN KEY')) return res.status(409).json({ code: 409, message: '部分记录被引用，无法删除' })
    res.status(500).json({ code: 500, message: '批量删除失败' })
  }
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
    logOperation({ module: config.module, action: '新增', target: String(req.body.name || ''), detail: sanitizeDetail(req.body), operator: req.user?.username || '', ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress, userAgent: req.headers['user-agent'] as string, requestMethod: req.method, requestPath: req.path })
    res.status(201).json({ code: 201, data: row })
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ code: 409, message: '名称已存在' })
    }
    if (err.message?.includes('FOREIGN KEY')) {
      return res.status(409).json({ code: 409, message: '引用的关联数据不存在' })
    }
    res.status(500).json({ code: 500, message: '服务器内部错误', traceId: crypto.randomBytes(4).toString('hex') })
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
    // 取旧 name（用于改名后同步 printers 表）
    const oldNameRow = req.body.name !== undefined
      ? db.prepare('SELECT name FROM ' + config.table + ' WHERE id = ?').get(req.params.id) as { name: string } | undefined
      : undefined

    db.prepare(`UPDATE ${config.table} SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).run(...values)
    const row = db.prepare(`SELECT ${config.listColumns} FROM ${config.table} WHERE id = ?`).get(req.params.id)

    // 字典改名后同步刷 printers 表（方案A）
    if (oldNameRow && req.body.name !== oldNameRow.name) {
      const newName = req.body.name
      if (req.params.table === 'printer-brands') {
        db.prepare('UPDATE printers SET manufacturer = ? WHERE manufacturer = ?').run(newName, oldNameRow.name)
      } else if (req.params.table === 'printer-models') {
        db.prepare('UPDATE printers SET model = ? WHERE model = ?').run(newName, oldNameRow.name)
      } else if (req.params.table === 'toner-models') {
        db.prepare('UPDATE printers SET toner_model = ? WHERE toner_model = ?').run(newName, oldNameRow.name)
      } else if (req.params.table === 'printer-floors') {
        db.prepare('UPDATE printers SET floor = ? WHERE floor = ?').run(newName, oldNameRow.name)
      }
    }

    logOperation({ module: config.module, action: '修改', target: String(req.body.name || `ID:${req.params.id}`), detail: sanitizeDetail(req.body), operator: req.user?.username || '', ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress, userAgent: req.headers['user-agent'] as string, requestMethod: req.method, requestPath: req.path })
    res.json({ code: 200, data: row })
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ code: 409, message: '名称已存在' })
    }
    res.status(500).json({ code: 500, message: '服务器内部错误', traceId: crypto.randomBytes(4).toString('hex') })
  }
})

// DELETE /api/v1/admin/:table/:id  — 删除
router.delete('/:table/:id', (req: Request, res: Response) => {
  const config = tables[req.params.table]
  if (!config) return res.status(404).json({ code: 404, message: '未知表' })

  const nameCol = config.nameColumn || 'name'
  const existing = db.prepare(`SELECT ${nameCol} FROM ${config.table} WHERE id = ?`).get(req.params.id) as any
  if (!existing) return res.status(404).json({ code: 404, message: '记录不存在' })

  try {
    db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(req.params.id)
    logOperation({ module: config.module, action: '删除', target: existing[nameCol] || `ID:${req.params.id}`, detail: '', operator: req.user?.username || '', ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress, userAgent: req.headers['user-agent'] as string, requestMethod: req.method, requestPath: req.path })
    res.status(204).send()
  } catch (err: any) {
    if (err.message?.includes('FOREIGN KEY')) {
      return res.status(409).json({ code: 409, message: '该记录被其他数据引用，无法删除' })
    }
    res.status(500).json({ code: 500, message: '服务器内部错误', traceId: crypto.randomBytes(4).toString('hex') })
  }
})

// ========== 操作日志 ==========

// GET /api/v1/admin/logs/list  — 日志列表 + 日期范围 + 模块筛选
router.get('/logs/list', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
  const module_ = (req.query.module as string) || ''
  const startDate = (req.query.startDate as string) || ''
  const endDate = (req.query.endDate as string) || ''
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: any[] = []
  if (module_) { conditions.push('module = ?'); params.push(module_) }
  if (startDate) { conditions.push("created_at >= ?"); params.push(startDate + ' 00:00:00') }
  if (endDate) { conditions.push("created_at <= ?"); params.push(endDate + ' 23:59:59') }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM operation_logs ${where}`).get(...params) as { cnt: number }).cnt
  const rows = db.prepare(
    `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset)

  res.json({ code: 200, data: { rows, total, page, pageSize } })
})

// GET /api/v1/admin/logs/modules  — 模块下拉选项（去重）
router.get('/logs/modules', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT DISTINCT module FROM operation_logs ORDER BY module ASC').all() as { module: string }[]
  res.json({ code: 200, data: rows.map(r => r.module).filter(Boolean) })
})

// DELETE /api/v1/admin/logs/clear  — 清空日志
router.delete('/logs/clear', (req: Request, res: Response) => {
  db.prepare('DELETE FROM operation_logs').run()
  logOperation({ module: '系统', action: '清空日志', target: '所有操作日志', detail: '', operator: req.user?.username || '', ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress, userAgent: req.headers['user-agent'] as string, requestMethod: req.method, requestPath: req.path })
  res.json({ code: 200, message: '日志已清空' })
})

// 启动时注册：每日 02:00 清理 30 天前操作日志（保留期管理）
import cron from 'node-cron'
const LOG_RETENTION_DAYS = 30
cron.schedule('0 2 * * *', () => {
  try {
    const n = db.prepare('DELETE FROM operation_logs WHERE created_at < datetime(\'now\', \'-' + LOG_RETENTION_DAYS + ' days\')').run()
    if (n.changes > 0) console.log('[logs] 已自动清理 ' + n.changes + ' 条 ' + LOG_RETENTION_DAYS + ' 天前操作日志')
  } catch (e) { console.warn('[logs] 自动清理失败:', e) }
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
    computerModels: cnt('computer_models'),
    totalLogs: cnt('operation_logs'),
    recentLogs: db.prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 10').all(),
  }
  res.json({ code: 200, data: stats })
})

// GET /api/v1/admin/overview/trend?days=7  — 近 N 天操作日志趋势
router.get('/overview/trend', (req: Request, res: Response) => {
  const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7))
  const rows = db.prepare(
    'SELECT DATE(created_at) AS date, COUNT(*) AS count FROM operation_logs WHERE created_at >= datetime(\'now\', ?) GROUP BY DATE(created_at) ORDER BY date ASC'
  ).all('-' + days + ' days') as { date: string; count: number }[]

  // 补全缺失日期（无日志的天填 0）
  const result: { date: string; count: number }[] = []
  const map = new Map(rows.map(r => [r.date, r.count]))
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    result.push({ date: key.slice(5), count: map.get(key) || 0 })
  }
  res.json({ code: 200, data: { days, trend: result } })
})

export default router
