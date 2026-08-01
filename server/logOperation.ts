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
  // 设计规格第 9 节：日志写入失败绝不影响主业务（如 SQLITE_BUSY/磁盘满）
  // 失败仅打印告警，不向调用方抛出，避免“业务已成功却返回 500”的假失败
  try {
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
  } catch (err) {
    console.error('[logOperation] 操作日志写入失败（不影响主业务）:', err)
  }
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
