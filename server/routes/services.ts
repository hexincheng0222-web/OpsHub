import { Router, Request, Response } from 'express'
import db from '../db'

const router = Router()

// 从数据库读取服务分类
function getCategories(): string[] {
  const rows = db.prepare('SELECT name FROM service_categories ORDER BY sort_order ASC, id ASC').all() as { name: string }[]
  return rows.length > 0 ? rows.map(r => r.name) : ['DevOps', '监控', '基础设施', '协作']
}
const STATUSES = ['online', 'offline', 'maintenance']

function toApi(row: any) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
    notes: row.notes,
    icon: row.icon,
    category: row.category,
    status: row.status,
    hostId: row.host_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// 1. 获取服务列表
router.get('/', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
  const keyword = (req.query.keyword as string) || ''
  const category = req.query.category as string
  const status = req.query.status as string

  let where = 'WHERE 1=1'
  const params: any[] = []

  if (keyword) {
    where += ' AND (name LIKE ? OR description LIKE ? OR url LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw)
  }
  if (category) {
    where += ' AND category = ?'
    params.push(category)
  }
  if (status) {
    where += ' AND status = ?'
    params.push(status)
  }
  if (req.query.hostId) {
    where += ' AND host_id = ?'
    params.push(parseInt(req.query.hostId as string))
  }

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM services ' + where).get(...params) as any).cnt
  const list = db.prepare('SELECT * FROM services ' + where + ' ORDER BY id ASC LIMIT ? OFFSET ?')
    .all(...params, pageSize, (page - 1) * pageSize)

  res.json({
    code: 200,
    data: {
      list: (list as any[]).map(toApi),
      total,
      page,
      pageSize,
    },
  })
})

// 2. 获取分类列表（必须在 /:id 之前）
router.get('/categories', (_req: Request, res: Response) => {
  res.json({ code: 200, data: { categories: getCategories() } })
})

// 3. 获取单个服务
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id)
  if (!row) {
    return res.status(404).json({ code: 404, message: '服务不存在' })
  }
  res.json({ code: 200, data: toApi(row) })
})

// 3. 创建服务
router.post('/', (req: Request, res: Response) => {
  const { name, url, description = '', notes = '', icon = 'Setting', category, status = 'online' } = req.body

  if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
    return res.status(400).json({ code: 400, message: 'name 为必填项，1-100 字符' })
  }
  if (!url || typeof url !== 'string' || url.length > 500) {
    return res.status(400).json({ code: 400, message: 'url 为必填项，最多 500 字符' })
  }
  if (!category || !getCategories().includes(category)) {
    return res.status(400).json({ code: 400, message: 'category 必须是已配置的服务分类之一' })
  }
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ code: 400, message: 'status 必须是 ' + STATUSES.join(', ') + ' 之一' })
  }

  try {
    const result = db.prepare(
      'INSERT INTO services (name, url, description, notes, icon, category, status, host_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, url, description, notes, icon, category, status, req.body.hostId || null)

    const created = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({ code: 201, data: toApi(created) })
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ code: 409, message: '服务名称或地址已存在' })
    }
    throw err
  }
})

// 4. 全量更新
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id)
  if (!existing) {
    return res.status(404).json({ code: 404, message: '服务不存在' })
  }

  const { name, url, description = '', notes = '', icon = 'Setting', category, status } = req.body
  if (!name || !url || !category) {
    return res.status(400).json({ code: 400, message: 'name、url、category 为必填项' })
  }

  try {
    db.prepare(
      "UPDATE services SET name=?, url=?, description=?, notes=?, icon=?, category=?, status=?, host_id=?, updated_at=datetime('now') WHERE id=?"
    ).run(name, url, description, notes, icon, category, status || 'online', req.body.hostId || null, id)

    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(id)
    res.json({ code: 200, data: toApi(updated) })
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ code: 409, message: '服务名称或地址已存在' })
    }
    throw err
  }
})

// 5. 部分更新
router.patch('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id)
  if (!existing) {
    return res.status(404).json({ code: 404, message: '服务不存在' })
  }

  const allowedFields = ['status', 'notes', 'description', 'name', 'url', 'icon', 'category']
  const updates: string[] = []
  const values: any[] = []

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(field + ' = ?')
      values.push(req.body[field])
    }
  }
  // host_id 映射
  if (req.body.hostId !== undefined) {
    updates.push('host_id = ?')
    values.push(req.body.hostId || null)
  }

  if (updates.length === 0) {
    return res.status(400).json({ code: 400, message: '至少提供一个更新字段' })
  }

  if (req.body.status && !STATUSES.includes(req.body.status)) {
    return res.status(400).json({ code: 400, message: 'status 必须是 ' + STATUSES.join(', ') + ' 之一' })
  }

  updates.push("updated_at = datetime('now')")
  values.push(id)

  try {
    db.prepare('UPDATE services SET ' + updates.join(', ') + ' WHERE id = ?').run(...values)
    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(id)
    res.json({ code: 200, data: toApi(updated) })
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ code: 409, message: '服务名称或地址已存在' })
    }
    throw err
  }
})

// 6. 删除服务
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const result = db.prepare('DELETE FROM services WHERE id = ?').run(id)
  if (result.changes === 0) {
    return res.status(404).json({ code: 404, message: '服务不存在' })
  }
  res.status(204).send()
})

// 7. 批量检测连通性
router.post('/check-all', async (_req: Request, res: Response) => {
  const services = db.prepare("SELECT * FROM services WHERE status != 'maintenance'").all() as any[]
  const skipped = db.prepare("SELECT * FROM services WHERE status = 'maintenance'").all() as any[]

  const checkOne = async (svc: any): Promise<any> => {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      await fetch(svc.url, { method: 'HEAD', signal: controller.signal })
      clearTimeout(timeout)
      return { id: svc.id, name: svc.name, status: 'online', latencyMs: Date.now() - start }
    } catch {
      return { id: svc.id, name: svc.name, status: 'offline', latencyMs: null, error: '连接超时' }
    }
  }

  const results = await Promise.allSettled(services.map(checkOne))
  const allResults: any[] = []
  const updateStmt = db.prepare("UPDATE services SET status = ?, updated_at = datetime('now') WHERE id = ?")

  for (const r of results) {
    if (r.status === 'fulfilled') {
      allResults.push(r.value)
      updateStmt.run(r.value.status, r.value.id)
    }
  }

  for (const s of skipped) {
    allResults.push({ id: s.id, name: s.name, status: 'maintenance', latencyMs: null })
  }

  const summary = {
    total: allResults.length,
    online: allResults.filter(r => r.status === 'online').length,
    offline: allResults.filter(r => r.status === 'offline').length,
    maintenance: allResults.filter(r => r.status === 'maintenance').length,
  }

  res.json({ code: 200, data: { results: allResults, summary } })
})

// 8. 单个检测连通性
router.post('/:id/check', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any
  if (!svc) {
    return res.status(404).json({ code: 404, message: '服务不存在' })
  }

  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    await fetch(svc.url, { method: 'HEAD', signal: controller.signal })
    clearTimeout(timeout)
    const latencyMs = Date.now() - start
    db.prepare("UPDATE services SET status = 'online', updated_at = datetime('now') WHERE id = ?").run(id)
    res.json({ code: 200, data: { id, status: 'online', latencyMs } })
  } catch {
    db.prepare("UPDATE services SET status = 'offline', updated_at = datetime('now') WHERE id = ?").run(id)
    res.json({ code: 200, data: { id, status: 'offline', latencyMs: null, error: '连接超时' } })
  }
})

export default router
