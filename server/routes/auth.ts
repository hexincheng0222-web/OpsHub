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
    // 使用时间戳比较，避免 ISO 字符串字典序比较的格式依赖问题 (#38)
    const nowMs = Date.now()
    const lockedMs = new Date(user.locked_until).getTime()
    if (lockedMs > nowMs) {
      const remaining = Math.ceil((lockedMs - nowMs) / 60000)
      return res.status(429).json({
        code: 429,
        message: `账号已锁定，请 ${remaining} 分钟后重试`,
      })
    }
    // 锁定时间已过 → 清除锁定标记，但保留 failed_attempts 累计威慑 (#34)
    // 仅在密码正确时才重置 failed_attempts，避免锁定到期即"重置计数→免费 4 次"的暴破窗口
    db.prepare("UPDATE users SET locked_until = NULL WHERE id = ?").run(user.id)
  }

  if (!user.is_active) {
    return res.status(403).json({ code: 403, message: '账号已被禁用' })
  }

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) {
    // 记录失败次数（锁定到期后 failed_attempts 保留累计威慑，见 #34）
    const newAttempts = (user.failed_attempts || 0) + 1
    // 累计错误 ≥5 即（重新）锁定 15 分钟
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

  // #11: 同时设置 HttpOnly cookie，前端 localStorage 作为兼容保留
  // R2 修复：SameSite=Lax → Strict（GET 导航请求也不发送 cookie，最强 CSRF 防护）
  // 生产环境用 Secure，开发环境（http）不用
  const isProd = process.env.NODE_ENV === 'production'
  const cookieFlags = [
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${24 * 60 * 60}`,
    isProd ? 'Secure' : '',
  ].filter(Boolean).join('; ')
  res.setHeader('Set-Cookie', `token=${token}; ${cookieFlags}`)

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

  // 新密码强度校验 (#39)
  const strengthError = validatePasswordStrength(newPassword)
  if (strengthError) {
    return res.status(400).json({ code: 400, message: strengthError })
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

/**
 * 校验密码强度 (#39)
 * - 长度 8-64
 * - 必须包含字母和数字
 * - 不能是纯数字或纯字母
 * 返回错误消息字符串，通过则返回空字符串
 */
export function validatePasswordStrength(pwd: string): string {
  if (!pwd) return '密码不能为空'
  if (pwd.length < 8) return '密码长度至少 8 字符'
  if (pwd.length > 64) return '密码长度最多 64 字符'
  if (!/[a-zA-Z]/.test(pwd)) return '密码必须包含字母'
  if (!/\d/.test(pwd)) return '密码必须包含数字'
  return ''
}

export default router
