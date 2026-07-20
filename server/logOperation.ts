import { Request } from 'express'
import db from './db'

export interface LogParams {
  module: string
  action: string
  target: string
  detail?: string
  operator?: string
  ip?: string
  userAgent?: string
  status?: 'success' | 'fail'
  errorMessage?: string
  requestMethod?: string
  requestPath?: string
  durationMs?: number
}

export function logOperation(p: LogParams) {
  db.prepare(
    `INSERT INTO operation_logs
       (module, action, target, detail, operator, ip_address, user_agent,
        status, error_message, request_method, request_path, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    p.module, p.action, p.target, p.detail || '', p.operator || '',
    p.ip || '', p.userAgent || '', p.status || 'success',
    p.errorMessage || '', p.requestMethod || '', p.requestPath || '',
    p.durationMs || 0
  )
}

/** 从 req 抽取 ip / ua / method / path，避免每个路由重复写 */
export function logCtx(req: Request) {
  return {
    ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] as string,
    requestMethod: req.method,
    requestPath: req.path,
  }
}
