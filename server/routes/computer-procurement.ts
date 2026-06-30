import { Router, Request, Response } from 'express'
import db from '../db'
import '../middleware/auth'

const router = Router()

function logOperation(module: string, action: string, target: string, detail: string = '', operator: string = '') {
  db.prepare('INSERT INTO operation_logs (module, action, target, detail, operator) VALUES (?, ?, ?, ?, ?)').run(module, action, target, detail, operator)
}

function toApi(row: any) {
  return {
    id: row.id, model: row.model, department: row.department, applicant: row.applicant,
    macAddress: row.mac_address, deviceModel: row.device_model, ceNumber: row.ce_number,
    actualUser: row.actual_user, approvalNumber: row.approval_number, receiveDate: row.receive_date,
    assetNumber: row.asset_number, deliveryDate: row.delivery_date, deliveryPerson: row.delivery_person,
    pickupApproval: row.pickup_approval, ceProcessed: !!row.ce_processed, price: row.price,
  }
}

// GET / — 列表
router.get('/', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(10000, Math.max(1, parseInt(req.query.pageSize as string) || 20))
  const search = req.query.search as string
  const department = req.query.department as string

  let where = 'WHERE 1=1'
  const params: any[] = []

  if (search) {
    where += ' AND (model LIKE ? OR department LIKE ? OR applicant LIKE ? OR mac_address LIKE ? OR device_model LIKE ? OR asset_number LIKE ?)'
    const kw = '%' + search + '%'
    params.push(kw, kw, kw, kw, kw, kw)
  }
  if (department) { where += ' AND department = ?'; params.push(department) }

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM computer_procurement ' + where).get(...params) as any).cnt
  const rows = db.prepare('SELECT * FROM computer_procurement ' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(...params, pageSize, (page - 1) * pageSize)
  res.json({ code: 200, data: { list: rows.map(toApi), total } })
})

// GET /:id
router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM computer_procurement WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ code: 404, message: '记录不存在' })
  res.json({ code: 200, data: toApi(row) })
})

// POST /
router.post('/', (req: Request, res: Response) => {
  try {
    const d = req.body
    const result = db.prepare(
      `INSERT INTO computer_procurement (model,department,applicant,mac_address,device_model,ce_number,actual_user,approval_number,receive_date,asset_number,delivery_date,delivery_person,pickup_approval,ce_processed,price)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(d.model||'', d.department||'', d.applicant||'', d.macAddress||'', d.deviceModel||'',
      d.ceNumber||'', d.actualUser||'', d.approvalNumber||'', d.receiveDate||'', d.assetNumber||'',
      d.deliveryDate||'', d.deliveryPerson||'', d.pickupApproval||'', d.ceProcessed?1:0, d.price||0)
    const row = db.prepare('SELECT * FROM computer_procurement WHERE id = ?').get(result.lastInsertRowid)
    logOperation('电脑采购', '新增', d.model || `ID:${result.lastInsertRowid}`, '', req.user?.username || '')
    res.status(201).json({ code: 201, data: toApi(row) })
  } catch (err: any) {
    console.error('[server] 新增电脑采购失败:', err.message)
    res.status(500).json({ code: 500, message: '新增失败' })
  }
})

// PUT /:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM computer_procurement WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ code: 404, message: '记录不存在' })

    const mapping: Record<string, string> = {
      model:'model', department:'department', applicant:'applicant', macAddress:'mac_address',
      deviceModel:'device_model', ceNumber:'ce_number', actualUser:'actual_user',
      approvalNumber:'approval_number', receiveDate:'receive_date', assetNumber:'asset_number',
      deliveryDate:'delivery_date', deliveryPerson:'delivery_person', pickupApproval:'pickup_approval',
      ceProcessed:'ce_processed', price:'price',
    }
    const fields: string[] = [], values: any[] = []
    for (const [key, col] of Object.entries(mapping)) {
      if (req.body[key] !== undefined) {
        fields.push(col + ' = ?')
        values.push(key === 'ceProcessed' ? (req.body[key] ? 1 : 0) : req.body[key])
      }
    }
    if (fields.length === 0) return res.status(400).json({ code: 400, message: '至少提供一个更新字段' })
    fields.push("updated_at = datetime('now')")
    values.push(req.params.id)
    db.prepare('UPDATE computer_procurement SET ' + fields.join(', ') + ' WHERE id = ?').run(...values)
    const row = db.prepare('SELECT * FROM computer_procurement WHERE id = ?').get(req.params.id)
    logOperation('电脑采购', '修改', (row as any).model || `ID:${req.params.id}`, '', req.user?.username || '')
    res.json({ code: 200, data: toApi(row) })
  } catch (err: any) {
    console.error('[server] 更新电脑采购失败:', err.message)
    res.status(500).json({ code: 500, message: '更新失败' })
  }
})

// DELETE /:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT model FROM computer_procurement WHERE id = ?').get(req.params.id) as any
    if (!existing) return res.status(404).json({ code: 404, message: '记录不存在' })

    db.prepare('DELETE FROM computer_procurement WHERE id = ?').run(req.params.id)
    logOperation('电脑采购', '删除', existing.model || `ID:${req.params.id}`, '', req.user?.username || '')
    res.status(204).send()
  } catch (err: any) {
    console.error('[server] 删除电脑采购失败:', err.message)
    res.status(500).json({ code: 500, message: '删除失败' })
  }
})

// POST /batch-delete
router.post('/batch-delete', (req: Request, res: Response) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ code: 400, message: 'ids 必填' })
    const validIds = ids.filter((id: any) => Number.isInteger(id) && id > 0)
    if (validIds.length === 0) return res.status(400).json({ code: 400, message: '无有效 ID' })
    const ph = validIds.map(() => '?').join(',')
    db.prepare(`DELETE FROM computer_procurement WHERE id IN (${ph})`).run(...validIds)
    logOperation('电脑采购', '批量删除', `${validIds.length} 条记录`, '', req.user?.username || '')
    res.json({ code: 200, message: `已删除 ${validIds.length} 条` })
  } catch (err: any) {
    console.error('[server] 批量删除失败:', err.message)
    res.status(500).json({ code: 500, message: '批量删除失败' })
  }
})

// POST /import
router.post('/import', (req: Request, res: Response) => {
  const { rows } = req.body
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ code: 400, message: 'rows 必填' })
  const insert = db.prepare(
    `INSERT INTO computer_procurement (model,department,applicant,mac_address,device_model,ce_number,actual_user,approval_number,receive_date,asset_number,delivery_date,delivery_person,pickup_approval,ce_processed,price)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
  let imported = 0
  const errors: string[] = []
  const batch = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      try {
        insert.run(r.model||'', r.department||'', r.applicant||'', r.macAddress||'', r.deviceModel||'',
          r.ceNumber||'', r.actualUser||'', r.approvalNumber||'', r.receiveDate||'', r.assetNumber||'',
          r.deliveryDate||'', r.deliveryPerson||'', r.pickupApproval||'', r.ceProcessed?1:0, r.price||0)
        imported++
      } catch (e: any) { errors.push(`第${i+1}行: ${e.message}`) }
    }
  })
  batch()
  res.json({ code: 200, data: { imported, errors } })
})

export default router
