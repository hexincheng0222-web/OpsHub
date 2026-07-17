import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db'
import { authRequired, requireRole } from '../middleware/auth'
import { validatePasswordStrength } from './auth'

const router = Router()

// 所有用户管理路由需要登录 + admin 权限
router.use(authRequired, requireRole('admin', 'superadmin'))

// GET /api/v1/users — 用户列表 + 分页 + 搜索 + 角色筛选
router.get('/', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
  const keyword = (req.query.keyword as string)?.trim() || ''
  const roleFilter = (req.query.role as string)?.trim() || ''
  const offset = (page - 1) * pageSize

  // 权限过滤（管理员只看普通用户）
  const roleScope = req.user!.role === 'superadmin' ? null : 'user'

  const conditions: string[] = []
  const params: any[] = []

  if (roleScope) {
    conditions.push('role = ?')
    params.push(roleScope)
  }
  if (roleFilter) {
    if (roleScope && roleFilter !== roleScope) {
      // 筛选范围超出权限，返回空
      return res.json({ code: 200, data: { rows: [], total: 0 } })
    }
    if (!roleScope) {
      conditions.push('role = ?')
      params.push(roleFilter)
    }
  }
  if (keyword) {
    conditions.push('(username LIKE ? OR display_name LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM users ${where}`).get(...params) as { cnt: number }).cnt
  const rows = db.prepare(
    `SELECT id, username, display_name, role, is_active, last_login_at, created_at, updated_at
     FROM users ${where} ORDER BY id ASC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset)

  res.json({ code: 200, data: { rows, total } })
})

// POST /api/v1/users — 创建用户
router.post('/', (req: Request, res: Response) => {
  const { username, password, display_name, role } = req.body

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' })
  }

  // 权限检查
  const targetRole = role || 'user'
  if (req.user!.role !== 'superadmin' && targetRole !== 'user') {
    return res.status(403).json({ code: 403, message: '管理员只能创建普通用户' })
  }

  // 检查用户名是否已存在
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    return res.status(409).json({ code: 409, message: '用户名已存在' })
  }

  const hash = bcrypt.hashSync(password, 10)
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)'
  ).run(username, hash, display_name || '', targetRole)

  const user = db.prepare(
    'SELECT id, username, display_name, role, is_active, created_at FROM users WHERE id = ?'
  ).get(result.lastInsertRowid)

  res.status(201).json({ code: 201, data: user })
})

// PUT /api/v1/users/:id — 修改用户
router.put('/:id', (req: Request, res: Response) => {
  const targetId = parseInt(String(req.params.id))
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any

  if (!target) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  // 权限检查：admin 不能操作 superadmin 和其他 admin
  if (req.user!.role !== 'superadmin' && target.role !== 'user') {
    return res.status(403).json({ code: 403, message: '无权操作此用户' })
  }

  // 不能修改自己的角色（防止降级）
  if (targetId === req.user!.id && req.body.role && req.body.role !== target.role) {
    return res.status(400).json({ code: 400, message: '不能修改自己的角色' })
  }

  const { display_name, role, is_active } = req.body

  // 权限检查：非 superadmin 不能设置 admin/superadmin 角色
  if (req.user!.role !== 'superadmin' && role && role !== 'user') {
    return res.status(403).json({ code: 403, message: '管理员只能设置普通用户角色' })
  }

  const updates: string[] = []
  const values: any[] = []

  if (display_name !== undefined) {
    updates.push('display_name = ?')
    values.push(display_name)
  }
  if (role !== undefined) {
    updates.push('role = ?')
    values.push(role)
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?')
    values.push(is_active ? 1 : 0)
  }

  if (updates.length === 0) {
    return res.status(400).json({ code: 400, message: '缺少要更新的字段' })
  }

  updates.push("updated_at = datetime('now')")
  values.push(targetId)

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  const user = db.prepare(
    'SELECT id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM users WHERE id = ?'
  ).get(targetId)

  res.json({ code: 200, data: user })
})

// DELETE /api/v1/users/:id — 删除用户
router.delete('/:id', (req: Request, res: Response) => {
  const targetId = parseInt(String(req.params.id))
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any

  if (!target) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  // 不能删除自己
  if (targetId === req.user!.id) {
    return res.status(400).json({ code: 400, message: '不能删除自己' })
  }

  // 权限检查
  if (req.user!.role !== 'superadmin' && target.role !== 'user') {
    return res.status(403).json({ code: 403, message: '无权删除此用户' })
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId)
  res.status(204).send()
})

// PUT /api/v1/users/:id/reset-password — 重置密码
router.put('/:id/reset-password', (req: Request, res: Response) => {
  const targetId = parseInt(String(req.params.id))
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any

  if (!target) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  // 权限检查
  if (req.user!.role !== 'superadmin' && target.role !== 'user') {
    return res.status(403).json({ code: 403, message: '无权重置此用户密码' })
  }

  const { newPassword } = req.body
  if (!newPassword) {
    return res.status(400).json({ code: 400, message: '新密码不能为空' })
  }

  // 新密码强度校验 (#39)
  const strengthError = validatePasswordStrength(newPassword)
  if (strengthError) {
    return res.status(400).json({ code: 400, message: strengthError })
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    hash,
    targetId
  )

  res.json({ code: 200, message: '密码重置成功' })
})

export default router
