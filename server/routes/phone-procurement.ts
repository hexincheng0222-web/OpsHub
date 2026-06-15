import { Router, Request, Response } from 'express'
import db from '../db'

const router = Router()

function logOperation(module: string, action: string, target: string, detail: string = '') {
  db.prepare('INSERT INTO operation_logs (module, action, target, detail) VALUES (?, ?, ?, ?)').run(module, action, target, detail)
}

function toApi(row: any) {
  return {
    id: row.id, assetNumber: row.asset_number, partNo: row.part_no, serialNo: row.serial_no,
    imei: row.imei, arrivalDate: row.arrival_date, pickupDate: row.pickup_date,
    brand: row.brand, model: row.model, assetLink: row.asset_link, department: row.department,
    handler: row.handler, recipient: row.recipient, dingtalkCreator: row.dingtalk_creator,
    purchaseType: row.purchase_type, dingtalkFlow: row.dingtalk_flow,
    originalOwner: row.original_owner, notes: row.notes,
  }
}

// 生成资产编号
function generateAssetNumber(): string {
  const year = new Date().getFullYear()
  const prefix = `IT-PH-${year}-`
  const last = db.prepare("SELECT asset_number FROM phone_procurement WHERE asset_number LIKE ? ORDER BY asset_number DESC LIMIT 1")
    .get(prefix + '%') as { asset_number: string } | undefined
  const seq = last ? parseInt(last.asset_number.split('-').pop()!) + 1 : 1
  return `${prefix}${String(seq).padStart(3, '0')}`
}

// GET /
router.get('/', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(10000, Math.max(1, parseInt(req.query.pageSize as string) || 20))
  const search = req.query.search as string
  const department = req.query.department as string
  const purchaseType = req.query.purchaseType as string

  let where = 'WHERE 1=1'
  const params: any[] = []

  if (search) {
    where += ' AND (brand LIKE ? OR model LIKE ? OR recipient LIKE ? OR imei LIKE ? OR asset_number LIKE ? OR part_no LIKE ? OR department LIKE ?)'
    const kw = '%' + search + '%'
    params.push(kw, kw, kw, kw, kw, kw, kw)
  }
  if (department) { where += ' AND department = ?'; params.push(department) }
  if (purchaseType) { where += ' AND purchase_type = ?'; params.push(purchaseType) }

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM phone_procurement ' + where).get(...params) as any).cnt
  const rows = db.prepare('SELECT * FROM phone_procurement ' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(...params, pageSize, (page - 1) * pageSize)
  res.json({ code: 200, data: { list: rows.map(toApi), total } })
})

// GET /:id
router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM phone_procurement WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ code: 404, message: '记录不存在' })
  res.json({ code: 200, data: toApi(row) })
})

// POST /
router.post('/', (req: Request, res: Response) => {
  try {
    const d = req.body
    const assetNumber = d.assetNumber || generateAssetNumber()
    const result = db.prepare(
      `INSERT INTO phone_procurement (asset_number,part_no,serial_no,imei,arrival_date,pickup_date,brand,model,asset_link,department,handler,recipient,dingtalk_creator,purchase_type,dingtalk_flow,original_owner,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(assetNumber, d.partNo||'', d.serialNo||'', d.imei||'', d.arrivalDate||'', d.pickupDate||'',
      d.brand||'', d.model||'', d.assetLink||'', d.department||'', d.handler||'', d.recipient||'',
      d.dingtalkCreator||'', d.purchaseType||'新购', d.dingtalkFlow||'', d.originalOwner||'', d.notes||'')
    const row = db.prepare('SELECT * FROM phone_procurement WHERE id = ?').get(result.lastInsertRowid)
    logOperation('手机采购', '新增', d.model || assetNumber)
    res.status(201).json({ code: 201, data: toApi(row) })
  } catch (err: any) {
    console.error('[server] 新增手机采购失败:', err.message)
    res.status(500).json({ code: 500, message: '新增失败' })
  }
})

// PUT /:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM phone_procurement WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ code: 404, message: '记录不存在' })

    const mapping: Record<string, string> = {
      assetNumber:'asset_number', partNo:'part_no', serialNo:'serial_no', imei:'imei',
      arrivalDate:'arrival_date', pickupDate:'pickup_date', brand:'brand', model:'model',
      assetLink:'asset_link', department:'department', handler:'handler', recipient:'recipient',
      dingtalkCreator:'dingtalk_creator', purchaseType:'purchase_type', dingtalkFlow:'dingtalk_flow',
      originalOwner:'original_owner', notes:'notes',
    }
    const fields: string[] = [], values: any[] = []
    for (const [key, col] of Object.entries(mapping)) {
      if (req.body[key] !== undefined) { fields.push(col + ' = ?'); values.push(req.body[key]) }
    }
    if (fields.length === 0) return res.status(400).json({ code: 400, message: '至少提供一个更新字段' })
    fields.push("updated_at = datetime('now')")
    values.push(req.params.id)
    db.prepare('UPDATE phone_procurement SET ' + fields.join(', ') + ' WHERE id = ?').run(...values)
    const row = db.prepare('SELECT * FROM phone_procurement WHERE id = ?').get(req.params.id)
    logOperation('手机采购', '修改', (row as any).model || `ID:${req.params.id}`)
    res.json({ code: 200, data: toApi(row) })
  } catch (err: any) {
    console.error('[server] 更新手机采购失败:', err.message)
    res.status(500).json({ code: 500, message: '更新失败' })
  }
})

// DELETE /:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT model, asset_number FROM phone_procurement WHERE id = ?').get(req.params.id) as any
    if (!existing) return res.status(404).json({ code: 404, message: '记录不存在' })

    db.prepare('DELETE FROM phone_procurement WHERE id = ?').run(req.params.id)
    logOperation('手机采购', '删除', existing.model || existing.asset_number || `ID:${req.params.id}`)
    res.json({ code: 200, message: '删除成功' })
  } catch (err: any) {
    console.error('[server] 删除手机采购失败:', err.message)
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
    db.prepare(`DELETE FROM phone_procurement WHERE id IN (${ph})`).run(...validIds)
    logOperation('手机采购', '批量删除', `${validIds.length} 条记录`)
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
    `INSERT INTO phone_procurement (asset_number,part_no,serial_no,imei,arrival_date,pickup_date,brand,model,asset_link,department,handler,recipient,dingtalk_creator,purchase_type,dingtalk_flow,original_owner,notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
  let imported = 0
  const errors: string[] = []
  const batch = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      try {
        const assetNumber = r.assetNumber || generateAssetNumber()
        insert.run(assetNumber, r.partNo||'', r.serialNo||'', r.imei||'', r.arrivalDate||'', r.pickupDate||'',
          r.brand||'', r.model||'', r.assetLink||'', r.department||'', r.handler||'', r.recipient||'',
          r.dingtalkCreator||'', r.purchaseType||'新购', r.dingtalkFlow||'', r.originalOwner||'', r.notes||'')
        imported++
      } catch (e: any) { errors.push(`第${i+1}行: ${e.message}`) }
    }
  })
  batch()
  res.json({ code: 200, data: { imported, errors } })
})

export default router
