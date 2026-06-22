import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import db from '../db'

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        username: string
        role: string
      }
    }
  }
}

// 获取 JWT_SECRET（从 system_config 读取或自动生成）
function getJwtSecret(): string {
  let secret = (db.prepare("SELECT value FROM system_config WHERE key = 'jwt_secret'").get() as { value: string } | undefined)?.value
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex')
    db.prepare("INSERT OR REPLACE INTO system_config (key, value, description) VALUES (?, ?, ?)").run(
      'jwt_secret',
      secret,
      'JWT 签名密钥（系统自动生成，请勿修改）'
    )
    console.log('[auth] 已自动生成 JWT_SECRET')
  }
  return secret
}

// JWT 校验中间件 — 解析 token，挂载 user 到 req
export function authRequired(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录' })
  }

  const token = authHeader.slice(7)
  try {
    const secret = getJwtSecret()
    const payload = jwt.verify(token, secret) as { id: number; username: string; role: string }
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期' })
  }
}

// 角色校验中间件工厂 — 检查 role 是否在允许列表中
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '无权限访问' })
    }
    next()
  }
}

// 导出获取 secret 的函数供路由使用
export { getJwtSecret }
