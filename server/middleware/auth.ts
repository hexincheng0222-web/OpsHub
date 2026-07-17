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

// 获取 JWT_SECRET — 优先读环境变量 (#36)
// - 生产模式：未配置 JWT_SECRET 则拒绝启动（由调用方在启动时检查）
// - 开发模式：未配置时自动生成并入库，打印警告
function getJwtSecret(): string {
  // 1) 优先读环境变量
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET
  }

  // 2) 从数据库读取已自动生成的 secret
  let secret = (db.prepare("SELECT value FROM system_config WHERE key = 'jwt_secret'").get() as { value: string } | undefined)?.value

  // 3) 开发模式自动生成；生产模式不自动生成（避免静默入库导致凭据集中风险）
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      // 生产模式必须显式配置 JWT_SECRET
      throw new Error('生产模式必须配置 JWT_SECRET 环境变量')
    }
    secret = crypto.randomBytes(32).toString('hex')
    db.prepare("INSERT OR REPLACE INTO system_config (key, value, description) VALUES (?, ?, ?)").run(
      'jwt_secret',
      secret,
      'JWT 签名密钥（开发模式自动生成，生产环境请用 JWT_SECRET 环境变量）'
    )
    console.warn('[auth] 开发模式自动生成 JWT_SECRET 并入库。生产环境请配置 JWT_SECRET 环境变量。')
  }
  return secret
}

// JWT 校验中间件 — 解析 token，挂载 user 到 req
// 支持两种 token 来源 (#11)：
//   1. Authorization: Bearer xxx（前端 localStorage 兼容）
//   2. Cookie: token=xxx（HttpOnly cookie，XSS 无法读取）
export function authRequired(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  let token: string | undefined
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else if (req.cookies?.token) {
    token = req.cookies.token
  }

  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' })
  }

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
