import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db'
import { authRequired, getJwtSecret } from '../middleware/auth'

const router = Router()

// POST /api/v1/auth/login — 登录
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '请输入用户名和密码' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any
  if (!user) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' })
  }

  if (!user.is_active) {
    return res.status(403).json({ code: 403, message: '账号已被禁用' })
  }

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' })
  }

  // 更新最后登录时间
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id)

  // 生成 token
  const secret = getJwtSecret()
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    secret,
    { expiresIn: '24h' }
  )

  res.json({
    code: 200,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    },
  })
})

// GET /api/v1/auth/me — 获取当前用户信息
router.get('/me', authRequired, (req: Request, res: Response) => {
  const user = db.prepare(
    'SELECT id, username, display_name, role, last_login_at FROM users WHERE id = ?'
  ).get(req.user!.id)

  if (!user) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  res.json({ code: 200, data: user })
})

// PUT /api/v1/auth/password — 修改自己的密码
router.put('/password', authRequired, (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ code: 400, message: '请输入旧密码和新密码' })
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as any
  if (!user) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  const valid = bcrypt.compareSync(oldPassword, user.password_hash)
  if (!valid) {
    return res.status(401).json({ code: 401, message: '旧密码错误' })
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    hash,
    req.user!.id
  )

  res.json({ code: 200, message: '密码修改成功' })
})

export default router
