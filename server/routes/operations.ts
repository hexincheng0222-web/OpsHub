import { Router, Request, Response } from 'express'
import db from '../db'

const router = Router()

// ========== 文件夹 ==========

// GET /api/v1/operations/folders
router.get('/folders', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM manual_folders ORDER BY sort_order ASC, rowid ASC').all()
  const folders = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    icon: '',
    sort_order: r.sort_order,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
  res.json({ code: 200, data: folders })
})

// POST /api/v1/operations/folders
router.post('/folders', (req: Request, res: Response) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ code: 400, message: 'name 必填' })

    const id = 'folder-' + Date.now()
    db.prepare('INSERT INTO manual_folders (id, name) VALUES (?, ?)').run(id, name)
    const row = db.prepare('SELECT * FROM manual_folders WHERE id = ?').get(id) as any
    res.status(201).json({ code: 201, data: { id: row.id, name: row.name, icon: '' } })
  } catch (err: any) {
    console.error('[server] 创建文件夹失败:', err.message)
    res.status(500).json({ code: 500, message: '创建文件夹失败' })
  }
})

// PUT /api/v1/operations/folders/:id
router.put('/folders/:id', (req: Request, res: Response) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ code: 400, message: 'name 必填' })

    const existing = db.prepare('SELECT id FROM manual_folders WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ code: 404, message: '文件夹不存在' })

    db.prepare("UPDATE manual_folders SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, req.params.id)
    const row = db.prepare('SELECT * FROM manual_folders WHERE id = ?').get(req.params.id) as any
    res.json({ code: 200, data: { id: row.id, name: row.name, icon: '' } })
  } catch (err: any) {
    console.error('[server] 更新文件夹失败:', err.message)
    res.status(500).json({ code: 500, message: '更新文件夹失败' })
  }
})

// DELETE /api/v1/operations/folders/:id
router.delete('/folders/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM manual_folders WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ code: 404, message: '文件夹不存在' })

    // 使用事务保证原子性
    const remove = db.transaction(() => {
      db.prepare('DELETE FROM manual_docs WHERE folder_id = ?').run(req.params.id)
      db.prepare('DELETE FROM manual_folders WHERE id = ?').run(req.params.id)
    })
    remove()

    res.status(204).send()
  } catch (err: any) {
    console.error('[server] 删除文件夹失败:', err.message)
    res.status(500).json({ code: 500, message: '删除文件夹失败' })
  }
})

// ========== 文档 ==========

// GET /api/v1/operations/docs
router.get('/docs', (req: Request, res: Response) => {
  const folderId = req.query.folderId as string
  const keyword = req.query.keyword as string
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50))

  let where = 'WHERE 1=1'
  const params: any[] = []

  if (folderId) {
    where += ' AND folder_id = ?'
    params.push(folderId)
  }
  if (keyword) {
    where += ' AND (title LIKE ? OR content LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw)
  }

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM manual_docs ' + where).get(...params) as any).cnt
  const rows = db.prepare('SELECT * FROM manual_docs ' + where + ' ORDER BY updated_at DESC LIMIT ? OFFSET ?')
    .all(...params, pageSize, (page - 1) * pageSize)

  const list = rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    folderId: r.folder_id,
    author: r.author,
    createTime: r.created_at,
    updateTime: r.updated_at,
  }))

  res.json({ code: 200, data: { list, total, page, pageSize } })
})

// GET /api/v1/operations/docs/:id
router.get('/docs/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM manual_docs WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ code: 404, message: '文档不存在' })

  res.json({ code: 200, data: {
    id: row.id, title: row.title, content: row.content,
    folderId: row.folder_id, author: row.author,
    createTime: row.created_at, updateTime: row.updated_at,
  }})
})

// POST /api/v1/operations/docs
router.post('/docs', (req: Request, res: Response) => {
  try {
    const { title, content, folderId } = req.body
    if (!title || !folderId) return res.status(400).json({ code: 400, message: 'title 和 folderId 必填' })

    const result = db.prepare('INSERT INTO manual_docs (title, content, folder_id, author) VALUES (?, ?, ?, ?)')
      .run(title, content || '', folderId, req.body.author || '')

    const row = db.prepare('SELECT * FROM manual_docs WHERE id = ?').get(result.lastInsertRowid) as any
    res.status(201).json({ code: 201, data: {
      id: row.id, title: row.title, content: row.content,
      folderId: row.folder_id, author: row.author,
      createTime: row.created_at, updateTime: row.updated_at,
    }})
  } catch (err: any) {
    console.error('[server] 创建文档失败:', err.message)
    res.status(500).json({ code: 500, message: '创建文档失败' })
  }
})

// PUT /api/v1/operations/docs/:id
router.put('/docs/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM manual_docs WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ code: 404, message: '文档不存在' })

    const fields: string[] = []
    const values: any[] = []

    if (req.body.title !== undefined) { fields.push('title = ?'); values.push(req.body.title) }
    if (req.body.content !== undefined) { fields.push('content = ?'); values.push(req.body.content) }
    if (req.body.folderId !== undefined) { fields.push('folder_id = ?'); values.push(req.body.folderId) }
    if (req.body.author !== undefined) { fields.push('author = ?'); values.push(req.body.author) }

    if (fields.length === 0) return res.status(400).json({ code: 400, message: '至少提供一个更新字段' })

    fields.push("updated_at = datetime('now')")
    values.push(req.params.id)

    db.prepare('UPDATE manual_docs SET ' + fields.join(', ') + ' WHERE id = ?').run(...values)
    const row = db.prepare('SELECT * FROM manual_docs WHERE id = ?').get(req.params.id) as any
    res.json({ code: 200, data: {
      id: row.id, title: row.title, content: row.content,
      folderId: row.folder_id, author: row.author,
      createTime: row.created_at, updateTime: row.updated_at,
    }})
  } catch (err: any) {
    console.error('[server] 更新文档失败:', err.message)
    res.status(500).json({ code: 500, message: '更新文档失败' })
  }
})

// DELETE /api/v1/operations/docs/:id
router.delete('/docs/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM manual_docs WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ code: 404, message: '文档不存在' })

    db.prepare('DELETE FROM manual_docs WHERE id = ?').run(req.params.id)
    res.status(204).send()
  } catch (err: any) {
    console.error('[server] 删除文档失败:', err.message)
    res.status(500).json({ code: 500, message: '删除文档失败' })
  }
})

export default router
