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

  // 检查账号是否被锁定
  if (user.locked_until) {
    const now = new Date().toISOString()
    if (user.locked_until > now) {
      const remaining = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000)
      return res.status(429).json({
        code: 429,
        message: `账号已锁定，请 ${remaining} 分钟后重试`,
      })
    }
    // 锁定时间已过，重置失败计数
    db.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?").run(user.id)
  }

  if (!user.is_active) {
    return res.status(403).json({ code: 403, message: '账号已被禁用' })
  }

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) {
    // 记录失败次数
    const newAttempts = (user.failed_attempts || 0) + 1
    if (newAttempts >= 5) {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      db.prepare("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?").run(
        newAttempts, lockedUntil, user.id
      )
      return res.status(429).json({ code: 429, message: '密码错误次数过多，账号已锁定 15 分钟' })
    }
    db.prepare("UPDATE users SET failed_attempts = ? WHERE id = ?").run(newAttempts, user.id)
    return res.status(401).json({ code: 401, message: '用户名或密码错误' })
  }

  // 登录成功，重置失败计数
  db.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?").run(user.id)

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
