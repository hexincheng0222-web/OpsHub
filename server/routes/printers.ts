import { Router, Request, Response } from 'express'
import db from '../db'
import { validateRequired } from '../utils/validate'

const router = Router()

function toApi(row: any) {
  return {
    id: row.id,
    floor: row.floor,
    location: row.location,
    manufacturer: row.manufacturer,
    model: row.model,
    tonerModel: row.toner_model,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// GET /api/v1/printers  — 列表
router.get('/', (req: Request, res: Response) => {
  const floor = req.query.floor as string
  const status = req.query.status as string
  const keyword = req.query.keyword as string

  let where = 'WHERE 1=1'
  const params: any[] = []

  if (floor) { where += ' AND floor = ?'; params.push(floor) }
  if (status) { where += ' AND status = ?'; params.push(status) }
  if (keyword) {
    where += ' AND (manufacturer LIKE ? OR model LIKE ? OR location LIKE ? OR toner_model LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw, kw)
  }

  const rows = db.prepare('SELECT * FROM printers ' + where + ' ORDER BY floor ASC, id ASC').all(...params)
  res.json({ code: 200, data: { list: rows.map(toApi), total: rows.length } })
})

// GET /api/v1/printers/stats  — 统计
router.get('/stats', (_req: Request, res: Response) => {
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM printers').get() as any).cnt
  const normal = (db.prepare("SELECT COUNT(*) as cnt FROM printers WHERE status = '正常'").get() as any).cnt
  const lowInk = (db.prepare("SELECT COUNT(*) as cnt FROM printers WHERE status = '缺墨'").get() as any).cnt
  const fault = (db.prepare("SELECT COUNT(*) as cnt FROM printers WHERE status = '故障'").get() as any).cnt
  res.json({ code: 200, data: { total, normal, lowInk, fault } })
})

// GET /api/v1/printers/export  — 导出 CSV
router.get('/export', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM printers ORDER BY id ASC').all() as any[]
  const BOM = '﻿'
  const header = '楼层,位置,厂商,型号,硒鼓型号,备注'
  const lines = rows.map(r =>
    [r.floor, r.location, r.manufacturer, r.model, r.toner_model, r.notes]
      .map(v => `"${(v || '').replace(/"/g, '""')}"`)
      .join(',')
  )
  const csv = BOM + header + '\n' + lines.join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=printers.csv')
  res.send(csv)
})

// GET /api/v1/printers/:id  — 详情
router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ code: 404, message: '打印机不存在' })
  res.json({ code: 200, data: toApi(row) })
})

// POST /api/v1/printers  — 新增
router.post('/', (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, [
      { name: 'floor', label: '楼层', maxLength: 50 },
      { name: 'location', label: '位置', maxLength: 100 },
      { name: 'manufacturer', label: '厂商', maxLength: 100 },
      { name: 'model', label: '型号', maxLength: 100 },
    ])
    if (err) return res.status(400).json({ code: 400, message: err })

    const { floor, location, manufacturer, model, tonerModel, notes, status } = req.body
    const result = db.prepare(
      'INSERT INTO printers (floor, location, manufacturer, model, toner_model, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(floor, location, manufacturer, model, tonerModel || '', notes || '', status || '正常')

    const row = db.prepare('SELECT * FROM printers WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({ code: 201, data: toApi(row) })
  } catch (err: any) {
    console.error('[server] 新增打印机失败:', err.message)
    res.status(500).json({ code: 500, message: '新增打印机失败' })
  }
})

// PUT /api/v1/printers/:id  — 更新
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM printers WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ code: 404, message: '打印机不存在' })

    const fields: string[] = []
    const values: any[] = []
    const mapping: Record<string, string> = {
      floor: 'floor', location: 'location', manufacturer: 'manufacturer',
      model: 'model', tonerModel: 'toner_model', notes: 'notes', status: 'status',
    }

    const lengthLimits: Record<string, number> = {
      floor: 16, location: 255, manufacturer: 64, model: 128, toner_model: 128, notes: 10000, status: 16,
    }
    for (const [key, col] of Object.entries(mapping)) {
      if (req.body[key] !== undefined) {
        const val = req.body[key]
        if (typeof val === 'string' && val.length > (lengthLimits[col] || 255)) {
          return res.status(400).json({ code: 400, message: `${key} 不能超过 ${lengthLimits[col]} 字符` })
        }
        if (key === 'status' && !['正常', '缺墨', '故障'].includes(val)) {
          return res.status(400).json({ code: 400, message: 'status 必须为 正常/缺墨/故障' })
        }
        fields.push(col + ' = ?')
        values.push(val)
      }
    }
    if (fields.length === 0) return res.status(400).json({ code: 400, message: '至少提供一个更新字段' })

    fields.push("updated_at = datetime('now')")
    values.push(req.params.id)

    db.prepare('UPDATE printers SET ' + fields.join(', ') + ' WHERE id = ?').run(...values)
    const row = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id)
    res.json({ code: 200, data: toApi(row) })
  } catch (err: any) {
    console.error('[server] 更新打印机失败:', err.message)
    res.status(500).json({ code: 500, message: '更新打印机失败' })
  }
})

// DELETE /api/v1/printers/:id  — 删除单台
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM printers WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ code: 404, message: '打印机不存在' })
    db.prepare('DELETE FROM printers WHERE id = ?').run(req.params.id)
    res.status(204).send()
  } catch (err: any) {
    console.error('[server] 删除打印机失败:', err.message)
    res.status(500).json({ code: 500, message: '删除打印机失败' })
  }
})

// POST /api/v1/printers/batch-delete  — 批量删除
router.post('/batch-delete', (req: Request, res: Response) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ code: 400, message: 'ids 必填' })

    const placeholders = ids.map(() => '?').join(',')
    db.prepare(`DELETE FROM printers WHERE id IN (${placeholders})`).run(...ids)
    res.json({ code: 200, message: `已删除 ${ids.length} 台` })
  } catch (err: any) {
    console.error('[server] 批量删除打印机失败:', err.message)
    res.status(500).json({ code: 500, message: '批量删除失败' })
  }
})

// POST /api/v1/printers/import  — CSV 导入（带厂商字典校验 + autoCreateDict）
router.post('/import', (req: Request, res: Response) => {
  const { rows, autoCreateDict = false } = req.body
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ code: 400, message: 'rows 必填' })

  const insert = db.prepare(
    'INSERT INTO printers (floor, location, manufacturer, model, toner_model, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const brandCache = new Map<string, number>()
  let imported = 0
  const errors: string[] = []
  const tx = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      // 厂商校验
      if (r.manufacturer) {
        if (!brandCache.has(r.manufacturer)) {
          const b = db.prepare('SELECT id FROM printer_brands WHERE name=?').get(r.manufacturer) as any
          if (b) brandCache.set(r.manufacturer, b.id)
          else if (autoCreateDict) {
            const nb = db.prepare('INSERT INTO printer_brands (name) VALUES (?)').run(r.manufacturer)
            brandCache.set(r.manufacturer, nb.lastInsertRowid as number)
          } else {
            errors.push(`第 ${i+1} 行: 厂商「${r.manufacturer}」不在字典，请先在后台添加`)
            continue
          }
        }
      }
      // TODO: model / tonerModel 校验同模式（评审文档 v2 中形式如此；本任务暂不强制实现）
      try {
        insert.run(r.floor || '', r.location || '', r.manufacturer || '', r.model || '',
                   r.tonerModel || '', r.notes || '', r.status || '正常')
        imported++
      } catch (e: any) { errors.push(`第 ${i+1} 行: ${e.message}`) }
    }
  })
  tx()
  res.json({ code: 200, data: { imported, errors } })
})

// POST /api/v1/printers/batch-create  — 原子批量新增（用于撤销恢复）
router.post('/batch-create', (req: Request, res: Response) => {
  const { rows } = req.body
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ code: 400, message: 'rows 必填' })
  const insert = db.prepare(
    'INSERT INTO printers (floor, location, manufacturer, model, toner_model, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  let imported = 0
  const errors: string[] = []
  const tx = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      try {
        insert.run(r.floor || '', r.location || '', r.manufacturer || '',
                  r.model || '', r.tonerModel || '', r.notes || '', r.status || '正常')
        imported++
      } catch (e: any) { errors.push(`第 ${i+1} 行: ${e.message}`) }
    }
  })
  tx()
  res.json({ code: 200, data: { imported, errors } })
})

export default router
